import type { Counterfactual, GameConfig, GameState, OutcomeType } from './types';
import { evaluateAttendance, normalizeChoices } from './attendance';
import { present, transition } from './shared';

export function classifyOutcome(config: GameConfig, state: GameState, now: number, conceded = false): GameState {
  const final_vote = [...state.votes].reverse().find(v => v.track === 1);
  const passed = !conceded && !!final_vote?.passed;
  const table = present(config, state);
  const absent_major = config.rules.major_powers.filter(id => !table.includes(id));
  const opposing_major = config.rules.major_powers.filter(id => final_vote?.details.some(d => d.delegation === id && d.vote === 'no'));
  let type: OutcomeType = state.track2.annex ? 'expert_consensus' : 'no_agreement';
  if (passed) type = state.parallel ? 'split_standards' : absent_major.length ? 'club_standard' : opposing_major.length ? 'paper_standard' : 'full_agreement';
  return transition({ ...state, outcome: { type, passed, final_vote, absent_major, opposing_major,
    parallel: state.parallel, annex: state.track2.annex } }, 'outcome', now);
}

export function counterfactuals(config: GameConfig, state: GameState): Counterfactual[] {
  const choices = state.track === 2 ? state.track2.stash?.choices ?? state.choices : state.choices;
  if (!choices) return [];
  const attendance = state.track === 2 ? state.track2.stash?.attendance ?? state.attendance : state.attendance;
  const walkouts = state.track === 2 ? state.track2.stash?.walkouts ?? state.walkouts : state.walkouts;
  // Attendance scores retain the trust used before exclusion penalties were applied.
  const trust = { ...state.trust };
  for (const result of attendance) {
    const delegation = config.delegations.find(d => d.id === result.delegation);
    if (!delegation) continue;
    const base = choices.format === 'track2' ? delegation.attendance.track2_willingness : delegation.attendance.base_willingness[choices.forum] ?? 0;
    trust[result.delegation] = result.score - base - result.reasons.reduce((sum, reason) => sum + (reason.modifier ?? 0), 0);
  }
  const hypothetical = { ...state, trust };
  const missing = config.rules.major_powers.filter(id => id !== state.seat
    && (!attendance.some(a => a.delegation === id && a.status === 'attend') || walkouts.some(w => w.delegation === id)));
  const result: Counterfactual[] = [];
  for (const id of missing) {
    const name = config.delegations.find(d => d.id === id)?.name ?? id;
    const dimensions = [
      config.convene.agenda_scopes.filter(a => a.id !== choices.agenda_scope).map(a => ({ change: { agenda_scope: a.id }, description: `With the ${a.label} agenda, ${name} would have attended.` })),
      config.forums.filter(f => f.id !== choices.forum && (!f.members_fixed || f.members_fixed.includes(state.seat))).map(f => ({ change: { forum: f.id }, description: `At ${f.name}, ${name} would have attended.` })),
      choices.format === 'track1' && config.rules.track2.enabled ? [{ change: { format: 'track2' as const }, description: `In the expert channel, ${name} would have attended.` }] : [],
      !choices.invited.includes(id) ? [{ change: { invited: [...choices.invited, id] }, description: `With an invitation, ${name} would have attended.` }] : [],
    ];
    let count = 0;
    for (const options of dimensions) {
      const option = options.find(option => {
        const input = normalizeChoices(config, state, { ...choices, ...option.change });
        return input && evaluateAttendance(config, hypothetical, input).some(a => a.delegation === id && a.status === 'attend');
      });
      if (option) { result.push({ delegation: id, ...option }); count += 1; }
      if (count === 2) break;
    }
  }
  return result;
}
