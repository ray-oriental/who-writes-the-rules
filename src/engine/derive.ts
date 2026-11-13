import type { DerivedView } from '../game/api';
import type { GameConfig, GameState } from './types';
import { quorumMet } from './attendance';
import { canReconvene, canStartTrack2 } from './flow';
import { canRequestReport, canSpeak, clauseBriefs } from './negotiation';
import { counterfactuals } from './outcome';
import { allowedTemplates, present, roundsInCycle } from './shared';
import { computeVote } from './voting';

export function derive(config: GameConfig, state: GameState): DerivedView {
  const table = present(config, state);
  const voters = table.filter(id => config.rules.voting_mode === 'all_delegations'
    || config.delegations.some(d => d.id === id && (d.type === 'state' || d.type === 'regional')));
  const stances: DerivedView['stances'] = Object.fromEntries(state.clauses.map(c => [c.id, {}]));
  for (const id of table) for (const brief of clauseBriefs(config, state, id)) stances[brief.id][id] = brief.position === 'red_line' ? 'oppose' : brief.position;
  const leanings: DerivedView['leanings'] = {};
  if ((state.phase === 'negotiate' || state.phase === 'report') && state.clauses.length >= config.rules.min_clauses_to_vote) {
    for (const detail of computeVote(config, state)) {
      if (detail.delegation === state.seat) continue;
      // "Wavering" means: would vote no today, but is close enough to be won. A yes is a yes, however narrow.
      leanings[detail.delegation] = detail.vote === 'no' && detail.red_lines_hit.length === 0 && detail.in_swing_band ? 'wavering' : detail.vote;
    }
  }
  return { present: table, voters, leanings, votes_needed: Math.ceil(2 * voters.length / 3), quorum_met: quorumMet(config, state),
    rounds_in_cycle: roundsInCycle(config, state), can_speak: canSpeak(config, state), can_request_report: canRequestReport(config, state),
    can_call_vote: state.phase === 'report' && state.clauses.length >= config.rules.min_clauses_to_vote && state.reports.some(r => r.track === state.track && r.cycle === state.cycle),
    can_reconvene: canReconvene(config, state), can_start_track2: canStartTrack2(config, state),
    side_payments_left: Math.max(0, config.rules.side_payments_per_cycle - state.side_payments.filter(p => p.track === state.track && p.cycle === state.cycle).length),
    allowed_templates: allowedTemplates(config, state).map(t => t.id),
    selectable_forums: config.forums.filter(f => !f.members_fixed || f.members_fixed.includes(state.seat)).map(f => f.id), stances,
    counterfactuals: ['outcome', 'debrief', 'postquiz', 'done'].includes(state.phase) ? counterfactuals(config, state) : [] };
}
