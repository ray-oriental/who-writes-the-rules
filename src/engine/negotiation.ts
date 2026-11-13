import type { Clause, GameConfig, GameState, Params, TagHit } from './types';
import type { ClauseBrief, DelegateOutput } from '../llm/types';
import { hasClauseKeys, matchClauseCond, matchConveneCond } from './match';
import { allowedTemplates, appendMessage, makeClause, present, roundsInCycle, validateParams } from './shared';
import { chairLine } from './chair';

export function evaluateWalkouts(config: GameConfig, state: GameState): GameState {
  if (!state.choices) return state;
  let next = state;
  for (const id of present(config, state)) {
    const delegation = config.delegations.find(d => d.id === id)!;
    const trigger = delegation.walkout_triggers.find(w => hasClauseKeys(w.when) && matchClauseCond(w.when, next.clauses)
      && matchConveneCond(w.when, { config, choices: state.choices!, seat: state.seat, delegation: id, annex_exists: state.track2.annex !== undefined }));
    if (!trigger) continue;
    next = { ...next, walkouts: [...next.walkouts, { delegation: id, cycle: state.cycle, round: state.round, trigger: trigger.id, say: trigger.say }],
      suggestions: next.suggestions.filter(s => s.from !== id) };
    next = appendMessage(next, { speaker: id, kind: 'walkout', text: trigger.say });
  }
  return next;
}

export function proposeClause(config: GameConfig, state: GameState, templateId: string, input: Params): GameState {
  if (state.phase !== 'negotiate') return state;
  const template = allowedTemplates(config, state).find(t => t.id === templateId);
  if (!template) return state;
  const params = validateParams(template, input);
  if (!params) return state;
  const previous = state.clauses.find(c => c.template === templateId);
  const clause = makeClause(template, params, state, state.seat, previous);
  const clauses = previous ? state.clauses.map(c => c.id === previous.id ? clause : c) : [...state.clauses, clause];
  return evaluateWalkouts(config, { ...state, clauses });
}

export function editClause(config: GameConfig, state: GameState, clauseId: string, params: Params): GameState {
  const clause = state.clauses.find(c => c.id === clauseId);
  return clause ? proposeClause(config, state, clause.template, { ...clause.params, ...params }) : state;
}

export function withdrawClause(config: GameConfig, state: GameState, clauseId: string): GameState {
  const clause = state.clauses.find(c => c.id === clauseId);
  if (state.phase !== 'negotiate' || !clause) return state;
  // The frozen state contract has no withdrawn-clause archive, so preserve its history in the transcript.
  const history = clause.history.map(version =>
    `Version ${version.version} in cycle ${version.cycle}, round ${version.round} read "${version.text}" with parameters ${JSON.stringify(version.params)}.`);
  const next = appendMessage({ ...state, clauses: state.clauses.filter(c => c.id !== clauseId) }, {
    speaker: 'system', kind: 'system', text: [`Withdrawn clause ${clause.template}.`, ...history].join('\n'),
  });
  return evaluateWalkouts(config, next);
}

export function acceptSuggestion(config: GameConfig, state: GameState, suggestionId: string): GameState {
  const suggestion = state.suggestions.find(s => s.id === suggestionId);
  if (!suggestion || state.phase !== 'negotiate') return state;
  const next = proposeClause(config, state, suggestion.template, suggestion.params);
  if (next === state) return state;
  return {
    ...next,
    clauses: next.clauses.map(clause => clause.template === suggestion.template ? { ...clause, proposed_by: suggestion.from } : clause),
    suggestions: next.suggestions.filter(s => s.id !== suggestionId),
  };
}

export function dismissSuggestion(state: GameState, suggestionId: string): GameState {
  return state.phase === 'negotiate' ? { ...state, suggestions: state.suggestions.filter(s => s.id !== suggestionId) } : state;
}

export function clauseBriefs(config: GameConfig, state: GameState, delegationId: string): ClauseBrief[] {
  const delegation = config.delegations.find(d => d.id === delegationId);
  if (!delegation) return [];
  const names = (when: { clause?: string; clause_present?: string; clause_absent?: string }, clause: Clause) =>
    [when.clause, when.clause_present, when.clause_absent].includes(clause.template);
  return state.clauses.map(clause => {
    const red = delegation.red_lines.find(r => names(r.when, clause) && matchClauseCond(r.when, state.clauses));
    if (red) return { id: clause.id, text: clause.text, position: 'red_line', reason: red.say };
    const items = delegation.must_haves.filter(m => names(m.when, clause));
    const support = items.find(m => matchClauseCond(m.when, state.clauses));
    if (support) return { id: clause.id, text: clause.text, position: 'support', reason: support.say };
    return { id: clause.id, text: clause.text, position: items.length ? 'oppose' : 'neutral', reason: items[0]?.say };
  });
}

export function pickVoice(config: GameConfig, state: GameState, delegationId: string): string | undefined {
  const d = config.delegations.find(d => d.id === delegationId);
  if (!d) return undefined;
  const red = d.red_lines.find(r => matchClauseCond(r.when, state.clauses));
  if (red?.voice) return red.voice;
  const missing = d.must_haves.filter(m => !matchClauseCond(m.when, state.clauses)).sort((a, b) => b.weight - a.weight);
  return missing[0]?.voice ?? d.voices[0]?.id;
}

export function pickResponders(config: GameConfig, state: GameState, addressee?: string, count = config.rules.max_responders_per_round): string[] {
  const candidates = present(config, state).filter(id => id !== state.seat);
  const conflict = (id: string): number => {
    const d = config.delegations.find(d => d.id === id)!;
    return 10 * d.red_lines.filter(r => matchClauseCond(r.when, state.clauses)).length
      + d.must_haves.filter(m => !matchClauseCond(m.when, state.clauses)).reduce((sum, m) => sum + m.weight, 0);
  };
  const lastSpoke = (id: string) => state.messages.map(m => m.kind === 'speech' ? m.speaker : '').lastIndexOf(id);
  candidates.sort((a, b) => Number(b === addressee) - Number(a === addressee) || conflict(b) - conflict(a)
    || lastSpoke(a) - lastSpoke(b) || config.scenario.seats.indexOf(a) - config.scenario.seats.indexOf(b));
  const limit = Math.min(candidates.length, Math.max(config.rules.min_responders_per_round, Math.min(config.rules.max_responders_per_round, count)));
  return candidates.slice(0, limit);
}

export function canSpeak(config: GameConfig, state: GameState): boolean {
  return state.phase === 'negotiate' && state.round >= 1 && state.round <= roundsInCycle(config, state);
}

export function canRequestReport(config: GameConfig, state: GameState): boolean {
  return state.phase === 'negotiate' && state.round - 1 >= Math.min(config.rules.allow_early_report_after, roundsInCycle(config, state));
}

export function playerSpeak(config: GameConfig, state: GameState, input: { text: string; addressee?: string; tags: TagHit[]; now: number }): { state: GameState; responders: string[] } {
  if (!canSpeak(config, state)) return { state, responders: [] };
  const seen = new Set<string>();
  const tags = input.tags.filter(t => {
    if (seen.has(t.tag) || !Number.isFinite(t.confidence) || t.confidence < config.rules.tagger_confidence_min || !config.tags.some(item => item.id === t.tag)) return false;
    seen.add(t.tag);
    return true;
  }).slice(0, 2);
  const next = appendMessage(state, { speaker: state.seat, from_player: true, kind: 'speech', text: input.text, addressed_to: input.addressee, tags });
  const events = [...next.soften_log];
  for (const tag of tags) for (const id of present(config, state).filter(id => id !== state.seat)) {
    if (events.some(e => e.tag === tag.tag && e.delegation === id && e.track === state.track && e.cycle === state.cycle)) continue;
    const d = config.delegations.find(d => d.id === id)!;
    for (const item of d.must_haves.filter(m => m.softenable_by?.includes(tag.tag))) {
      const already = events.filter(e => e.delegation === id && e.must_have === item.id).reduce((sum, e) => sum + e.amount, 0);
      const amount = Math.min(item.soften_amount ?? 1, (item.max_soften ?? 1) - already);
      if (amount > 0) events.push({ message_id: next.messages.at(-1)!.id, tag: tag.tag, delegation: id, must_have: item.id, amount, track: state.track, cycle: state.cycle });
    }
  }
  const softened = { ...next, soften_log: events };
  return { state: softened, responders: pickResponders(config, softened, input.addressee) };
}

export function recordSpeech(config: GameConfig, state: GameState, input: { delegation: string; text: string; voice?: string; amendment?: DelegateOutput['amendment']; fallback?: boolean }): GameState {
  if (state.phase !== 'negotiate' || !present(config, state).includes(input.delegation) || input.delegation === state.seat) return state;
  let next = appendMessage(state, { speaker: input.delegation, kind: 'speech', text: input.text, voice: input.voice, fallback: input.fallback });
  const amendment = input.amendment;
  if (!amendment) return next;
  const template = allowedTemplates(config, state).find(t => t.id === amendment.template);
  if (!template) return next;
  const params = validateParams(template, amendment.params);
  if (!params) return next;
  const clause = makeClause(template, params, state, input.delegation);
  const table = [...state.clauses.filter(c => c.template !== clause.template), clause];
  const d = config.delegations.find(d => d.id === input.delegation)!;
  if (d.red_lines.some(r => matchClauseCond(r.when, table))) return next;
  next = { ...next, suggestions: [...next.suggestions.filter(s => s.from !== input.delegation), {
    id: `s-${input.delegation}-${next.messages.length}`, from: input.delegation, template: template.id, params, text: clause.text,
    replaces: state.clauses.find(c => c.template === template.id)?.id, note: amendment.note,
  }] };
  return next;
}

export function endRound(config: GameConfig, state: GameState): GameState {
  return canSpeak(config, state) ? chairLine(config, { ...state, round: state.round + 1 }, 'round') : state;
}

export function offerSidePayment(config: GameConfig, state: GameState, delegation: string, payment: string): GameState {
  const used = state.side_payments.filter(p => p.track === state.track && p.cycle === state.cycle);
  if (state.phase !== 'negotiate' || !present(config, state).includes(delegation) || delegation === state.seat
    || !config.side_payments.some(p => p.id === payment) || used.length >= config.rules.side_payments_per_cycle
    || used.some(p => p.delegation === delegation && p.payment === payment)) return state;
  return appendMessage({ ...state, side_payments: [...state.side_payments, { track: state.track, cycle: state.cycle, delegation, payment }] },
    { speaker: state.seat, kind: 'side_payment', addressed_to: delegation, text: `We offer ${config.side_payments.find(p => p.id === payment)!.label} to ${config.delegations.find(d => d.id === delegation)!.name}.` });
}
