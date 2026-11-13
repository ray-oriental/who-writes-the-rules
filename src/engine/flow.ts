import type { GameConfig, GameState } from './types';
import { convene, quorumMet } from './attendance';
import { allowedTemplates, makeClause, transition, validateParams } from './shared';
import { chairLine } from './chair';
import { classifyOutcome } from './outcome';
import { evaluateWalkouts } from './negotiation';

export function createGame(config: GameConfig, input: { id: string; seed: number; now: number }): GameState {
  return { schema: 1, id: input.id, seed: input.seed, started_at: input.now, seat: '', phase: 'seat', track: 1,
    cycle: 1, round: 0, convene_attempts: 0, attendance: [], walkouts: [],
    trust: Object.fromEntries(config.delegations.map(d => [d.id, d.trust_initial])), clauses: [], suggestions: [],
    messages: [], soften_log: [], side_payments: [], reports: [], votes: [], track2: { used: 0 }, quiz: {},
    timeline: [{ phase: 'seat', track: 1, at: input.now }] };
}

export function chooseSeat(config: GameConfig, state: GameState, seat: string, now: number): GameState {
  return state.phase === 'seat' && config.delegations.some(d => d.id === seat && d.playable)
    ? transition({ ...state, seat }, 'rolecard', now) : state;
}

export function leaveRoleCard(config: GameConfig, state: GameState, now: number): GameState {
  return state.phase === 'rolecard' ? transition(state, config.quiz.enabled ? 'prequiz' : 'convene', now) : state;
}

export function submitQuiz(state: GameState, kind: 'pre' | 'post', answers: string[], now: number): GameState {
  if (state.phase !== (kind === 'pre' ? 'prequiz' : 'postquiz')) return state;
  return transition({ ...state, quiz: { ...state.quiz, [kind]: [...answers] } }, kind === 'pre' ? 'convene' : 'done', now);
}

function tableAnnex(config: GameConfig, state: GameState): GameState {
  const allowed = allowedTemplates(config, state);
  const annex = (state.track2.annex ?? []).flatMap(clause => {
    const template = allowed.find(t => t.id === clause.template);
    if (!template) return [];
    const params = validateParams(template, clause.params);
    if (!params) return [];
    const previous = state.clauses.find(c => c.template === clause.template);
    return [{ ...makeClause(template, params, state, clause.proposed_by, previous), from_annex: true }];
  });
  const templates = annex.map(c => c.template);
  return evaluateWalkouts(config, { ...state, clauses: [...state.clauses.filter(c => !templates.includes(c.template)), ...annex] });
}

export function enterRoom(config: GameConfig, state: GameState, now: number): GameState {
  if (state.phase !== 'attendance' || !quorumMet(config, state)) return state;
  let next = transition({ ...state, cycle: state.track === 2 ? 1 : state.cycle, round: 1 }, 'negotiate', now);
  if (next.track === 1 && next.track2.annex) next = tableAnnex(config, next);
  return chairLine(config, next, 'opening');
}

export function canReconvene(config: GameConfig, state: GameState): boolean {
  return state.phase === 'attendance' && (state.convene_attempts <= config.rules.reconvene_attempts
    || (state.track === 2 && state.track2.return_to !== undefined));
}

export function reconvene(config: GameConfig, state: GameState, now: number): GameState {
  if (!canReconvene(config, state)) return state;
  if (state.track === 2 && state.track2.return_to === 'negotiate' && state.track2.stash) {
    return resumeOfficial(config, state, now);
  }
  return transition({ ...state, track: 1, cycle: state.track2.stash?.cycle ?? state.cycle, round: 0,
    track2: { ...state.track2, return_to: undefined, stash: undefined } }, 'convene', now);
}

export function concede(config: GameConfig, state: GameState, now: number): GameState {
  const quorumLost = state.phase === 'negotiate' && !quorumMet(config, state);
  return state.phase === 'attendance' || state.phase === 'convene' || quorumLost
    ? classifyOutcome(config, state, now, true) : state;
}

export function canStartTrack2(config: GameConfig, state: GameState): boolean {
  const last = state.votes.at(-1);
  return config.rules.track2.enabled && state.track === 1 && state.track2.used < config.rules.track2.uses_per_game
    && (state.phase === 'attendance' || (state.phase === 'negotiate' && !quorumMet(config, state))
      || (state.phase === 'vote' && last?.track === 1 && !last.passed));
}

export function startTrack2(config: GameConfig, state: GameState, now: number): GameState {
  if (!canStartTrack2(config, state) || !state.choices) return state;
  const fromVote = state.phase === 'vote';
  const stash = fromVote || state.phase === 'negotiate'
    ? { choices: structuredClone(state.choices), attendance: structuredClone(state.attendance),
    walkouts: structuredClone(state.walkouts), clauses: structuredClone(state.clauses), cycle: state.cycle } : undefined;
  const next = convene(config, { ...state, phase: 'convene', clauses: [], suggestions: [], walkouts: [] }, { ...state.choices, format: 'track2' }, now);
  if (next.phase !== 'attendance') return state;
  return { ...next, convene_attempts: state.convene_attempts, cycle: 1, round: 0,
    track2: { ...next.track2, stash, return_to: fromVote ? 'negotiate' : 'convene' } };
}

export function continueAfterVote(config: GameConfig, state: GameState, now: number): GameState {
  const vote = state.votes.at(-1);
  if (state.phase !== 'vote' || !vote || vote.track !== state.track || vote.cycle !== state.cycle) return state;
  if (state.track === 1) {
    if (vote.passed || state.cycle >= config.rules.max_cycles) return classifyOutcome(config, state, now);
    return chairLine(config, transition({ ...state, cycle: state.cycle + 1, round: 1, suggestions: [] }, 'negotiate', now), 'opening');
  }
  const track2 = { ...state.track2, annex: vote.passed ? structuredClone(state.clauses) : state.track2.annex };
  return resumeOfficial(config, { ...state, track2 }, now);
}

function resumeOfficial(config: GameConfig, state: GameState, now: number): GameState {
  const { return_to, stash, ...track2 } = state.track2;
  if (return_to === 'negotiate' && stash) {
    const restored = { ...state, ...stash, track: 1 as const, track2, suggestions: [] };
    if (stash.cycle >= config.rules.max_cycles) return classifyOutcome(config, restored, now);
    const next = tableAnnex(config, { ...restored, cycle: stash.cycle + 1, round: 1 });
    return chairLine(config, transition(next, 'negotiate', now), 'opening');
  }
  return transition({ ...state, track: 1, cycle: stash?.cycle ?? 1, round: 0,
    clauses: [], attendance: [], walkouts: [], suggestions: [], track2 }, 'convene', now);
}

export function openDebrief(state: GameState, now: number): GameState {
  return state.phase === 'outcome' ? transition(state, 'debrief', now) : state;
}

export function finishDebrief(config: GameConfig, state: GameState, now: number): GameState {
  return state.phase === 'debrief' ? transition(state, config.quiz.enabled ? 'postquiz' : 'done', now) : state;
}

export function replay(config: GameConfig, state: GameState, input: { id: string; now: number }): GameState {
  const fresh = createGame(config, { ...input, seed: state.seed });
  const vote = [...state.votes].reverse().find(v => v.track === 1);
  return transition({ ...fresh, seat: state.seat, previous: state.choices && state.outcome ? {
    choices: structuredClone(state.choices), outcome: state.outcome.type,
    attended: [state.seat, ...state.attendance.filter(a => a.status === 'attend').map(a => a.delegation)],
    yes: vote?.yes ?? 0, no: vote?.no ?? 0,
  } : undefined }, 'convene', input.now);
}
