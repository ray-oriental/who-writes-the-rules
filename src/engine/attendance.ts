import type { AttendanceResult, ConveneChoices, GameConfig, GameState, ParallelForum } from './types';
import { hasClauseKeys, matchConveneCond } from './match';
import { clamp, renderClause, transition, validateParams } from './shared';

export function normalizeChoices(config: GameConfig, state: GameState, choices: ConveneChoices): ConveneChoices | undefined {
  const forum = config.forums.find(f => f.id === choices.forum);
  if (!forum || (forum.members_fixed && !forum.members_fixed.includes(state.seat))) return undefined;
  if (!config.convene.agenda_scopes.some(a => a.id === choices.agenda_scope)
    || !config.convene.formats.some(f => f.id === choices.format)) return undefined;
  const requested = new Set(choices.invited);
  const invited = config.scenario.seats.filter(id =>
    id !== state.seat && requested.has(id) && (!forum.members_fixed || forum.members_fixed.includes(id)));
  return { ...choices, invited };
}

/** Uses trust before the convening's exclusion penalties. */
export function evaluateAttendance(config: GameConfig, state: GameState, choices: ConveneChoices): AttendanceResult[] {
  return config.delegations.filter(d => d.id !== state.seat).map(d => {
    const ctx = { config, choices, seat: state.seat, delegation: d.id, annex_exists: state.track2.annex !== undefined };
    const conditions = d.attendance.conditions.filter(c => matchConveneCond(c.when, ctx));
    const walkouts = d.walkout_triggers.filter(w => !hasClauseKeys(w.when) && matchConveneCond(w.when, ctx));
    const score = (choices.format === 'track2' ? d.attendance.track2_willingness : d.attendance.base_willingness[choices.forum] ?? 0)
      + conditions.reduce((sum, c) => sum + (c.modifier ?? 0), 0) + (state.trust[d.id] ?? 0);
    const reasons = [
      ...conditions.map(c => ({ id: c.id, say: c.say, modifier: c.modifier, action: c.action })),
      ...walkouts.map(w => ({ id: w.id, say: w.say, action: 'refuse' })),
    ];
    const refused = conditions.some(c => c.action === 'refuse') || walkouts.length > 0;
    return { delegation: d.id, score, threshold: d.attendance.attend_threshold, reasons,
      status: !choices.invited.includes(d.id) ? 'excluded' : !refused && score >= d.attendance.attend_threshold ? 'attend' : 'decline' };
  });
}

function parallelForum(config: GameConfig, attendance: AttendanceResult[]): ParallelForum | undefined {
  const conveners = config.delegations.filter(d => attendance.some(a => a.delegation === d.id && a.status !== 'attend')
    && d.attendance.parallel_forum_propensity >= config.rules.parallel_threshold);
  if (!conveners.length) return undefined;
  const clauses: ParallelForum['clauses'] = [];
  for (const d of conveners) for (const item of d.must_haves) {
    const { clause, param, equals, in: values } = item.when;
    if (!clause || !param || (equals === undefined && !values?.length) || clauses.some(c => c.template === clause)) continue;
    const template = config.catalog.find(t => t.id === clause);
    if (!template) continue;
    const params = validateParams(template, { [param]: equals ?? values![0] });
    if (params) clauses.push({ template: template.id, params, text: renderClause(template, params) });
  }
  return { convened_by: conveners.map(d => d.id), clauses };
}

export function convene(config: GameConfig, state: GameState, input: ConveneChoices, now: number): GameState {
  if (state.phase !== 'convene') return state;
  const choices = normalizeChoices(config, state, input);
  if (!choices) return state;
  if (choices.format === 'track2' && (!config.rules.track2.enabled || state.track2.used >= config.rules.track2.uses_per_game)) return state;
  const attendance = evaluateAttendance(config, state, choices);
  const forum = config.forums.find(f => f.id === choices.forum)!;
  const trust = { ...state.trust };
  for (const d of config.delegations) {
    if (d.id === state.seat) continue;
    const fixedNonmember = forum.members_fixed && !forum.members_fixed.includes(d.id);
    const penalty = fixedNonmember ? config.rules.trust.exclusive_forum_nonmember
      : !choices.invited.includes(d.id) ? config.rules.trust.excluded : 0;
    trust[d.id] = clamp((trust[d.id] ?? 0) + penalty, config.rules.trust.min, config.rules.trust.max);
  }
  const technical = choices.format === 'track2';
  return transition({ ...state, choices, attendance, trust, walkouts: [], suggestions: [],
    convene_attempts: state.convene_attempts + 1, track: technical ? 2 : 1,
    track2: technical ? { ...state.track2, used: state.track2.used + 1, return_to: 'convene' } : state.track2,
    parallel: technical ? state.parallel : parallelForum(config, attendance),
  }, 'attendance', now);
}

export function setDeclineLetters(state: GameState, letters: Record<string, string> | { delegation: string; letter: string }[]): GameState {
  const byId = Array.isArray(letters) ? Object.fromEntries(letters.map(l => [l.delegation, l.letter])) : letters;
  return { ...state, attendance: state.attendance.map(a => a.status !== 'attend' && byId[a.delegation] !== undefined ? { ...a, letter: byId[a.delegation] } : a) };
}

export function quorumMet(config: GameConfig, state: GameState): boolean {
  return state.seat !== '' && state.attendance.filter(a => a.status === 'attend' && !state.walkouts.some(w => w.delegation === a.delegation)).length
    + (state.walkouts.some(w => w.delegation === state.seat) ? 0 : 1) >= config.rules.quorum;
}
