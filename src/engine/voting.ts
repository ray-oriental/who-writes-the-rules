import type { GameConfig, GameState, MustHave, Report, VoteDetail } from './types';
import type { RapporteurOutput } from '../llm/types';
import { matchClauseCond } from './match';
import { clamp, present, transition } from './shared';
import { chairLine } from './chair';
import { quorumMet } from './attendance';
import { canRequestReport, clauseBriefs } from './negotiation';

export function startReport(config: GameConfig, state: GameState, now: number): GameState {
  return canRequestReport(config, state) ? chairLine(config, transition(state, 'report', now), 'report') : state;
}

export function reportPositions(config: GameConfig, state: GameState): { delegation: string; supports: string[]; opposes: string[] }[] {
  return present(config, state).map(id => {
    const briefs = clauseBriefs(config, state, id);
    return { delegation: id, supports: briefs.filter(b => b.position === 'support').map(b => b.text),
      opposes: briefs.filter(b => b.position === 'oppose' || b.position === 'red_line').map(b => b.text) };
  });
}

export function setReport(state: GameState, report: RapporteurOutput & Partial<Report>): GameState {
  if (state.phase !== 'report') return state;
  const index = state.reports.findIndex(r => r.track === state.track && r.cycle === state.cycle);
  const previous = state.reports[index];
  if (previous && (previous.revised || !previous.objection)) return state;
  const snapshot: Report = {
    track: state.track, cycle: state.cycle, summary: report.summary, positions: structuredClone(report.positions),
    open_issues: [...report.open_issues], clauses: state.clauses.map(c => ({ id: c.id, text: c.text, proposed_by: c.proposed_by })),
    objection: previous?.objection, revised: !!previous, fallback: report.fallback,
  };
  return { ...state, reports: index < 0 ? [...state.reports, snapshot] : state.reports.map((r, i) => i === index ? snapshot : r) };
}

export function objectToReport(state: GameState, text: string): GameState {
  if (state.phase !== 'report' || !text.trim()) return state;
  return { ...state, reports: state.reports.map(r => r.track === state.track && r.cycle === state.cycle && !r.revised && !r.objection
    ? { ...r, objection: text } : r) };
}

function sameParams(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) =>
    Array.isArray(value) ? Array.isArray(b[key]) && value.length === (b[key] as unknown[]).length && value.every((v, i) => v === (b[key] as unknown[])[i]) : value === b[key]);
}

export function computeVote(config: GameConfig, state: GameState): VoteDetail[] {
  const thin = state.clauses.length < config.rules.min_clauses_to_vote;
  return present(config, state).map(id => {
    const d = config.delegations.find(d => d.id === id)!;
    const active = (item: { voice?: string }) => d.internal_resolution !== 'lead_voice' || !item.voice || item.voice === d.lead_voice;
    const red = d.red_lines.filter(r => active(r) && matchClauseCond(r.when, state.clauses));
    const items = d.must_haves.filter(active);
    const satisfied = items.filter(m => matchClauseCond(m.when, state.clauses));
    const missing = items.filter(m => !matchClauseCond(m.when, state.clauses));
    const softened = (item: MustHave) => state.soften_log.filter(e => e.delegation === id && e.must_have === item.id).reduce((sum, e) => sum + e.amount, 0);
    const itemScore = (list: MustHave[]) => list.reduce((sum, m) => sum + (matchClauseCond(m.when, state.clauses) ? m.weight : -m.weight + softened(m)), 0);
    let preferenceScore = itemScore(items);
    let soften = missing.reduce((sum, m) => sum + softened(m), 0);
    if (d.internal_resolution === 'average' && d.voices.length) {
      preferenceScore = d.voices.reduce((sum, v) => sum + itemScore(items.filter(m => !m.voice || m.voice === v.id)), 0) / d.voices.length;
      soften = d.voices.reduce((sum, v) => sum + missing.filter(m => !m.voice || m.voice === v.id).reduce((s, m) => s + softened(m), 0), 0) / d.voices.length;
    }
    const paymentIds = new Set(state.side_payments.filter(p => p.delegation === id).map(p => p.payment));
    const side_payment = [...paymentIds].reduce((sum, payment) => sum + (d.side_payment_values[payment] ?? 0), 0);
    const trust = state.trust[id] ?? 0;
    const track2_bonus = state.track === 1 && state.track2.annex?.some(a => state.clauses.some(c => c.template === a.template && sameParams(c.params, a.params))) ? config.rules.track2.bonus : 0;
    const score = preferenceScore + side_payment + trust + track2_bonus;
    const player = id === state.seat;
    const forced = red.length > 0 || (!player && thin);
    return { delegation: id, eligible: config.rules.voting_mode === 'all_delegations' || d.type === 'state' || d.type === 'regional',
      vote: forced ? 'no' : player || score >= d.vote_threshold ? 'yes' : 'no', score, threshold: d.vote_threshold,
      red_lines_hit: red.map(r => r.id), satisfied: satisfied.map(m => m.id), missing: missing.map(m => m.id),
      soften, side_payment, trust, track2_bonus, swing: 0,
      in_swing_band: !player && !forced && Math.abs(score - d.vote_threshold) <= config.rules.swing_band,
      statement: player && red.length ? `Your capital overruled you: ${red.map(r => r.say).join(' ')}`
        : !player && thin ? 'The text is too thin to vote on.' : '',
    };
  });
}

export function finalizeVote(config: GameConfig, state: GameState, statements: { delegation: string; statement: string; adjust: number; fallback?: boolean }[], now: number): GameState {
  if (state.phase !== 'report' || !state.reports.some(r => r.track === state.track && r.cycle === state.cycle)) return state;
  const details = computeVote(config, state).map(detail => {
    const statement = statements.find(s => s.delegation === detail.delegation);
    const swing = detail.in_swing_band && Number.isFinite(statement?.adjust) ? clamp(statement!.adjust, -1, 1) : 0;
    return { ...detail, swing, score: detail.score + swing,
      vote: detail.in_swing_band ? (detail.score + swing >= detail.threshold ? 'yes' : 'no') as 'yes' | 'no' : detail.vote,
      statement: detail.statement || statement?.statement || '', fallback: statement?.fallback };
  });
  const eligible = details.filter(d => d.eligible);
  const yes = eligible.filter(d => d.vote === 'yes').length;
  const no = eligible.length - yes;
  const needed = Math.ceil(2 * eligible.length / 3);
  const passed = quorumMet(config, state) && eligible.length > 0 && state.clauses.length >= config.rules.min_clauses_to_vote && yes >= needed
    && (config.rules.pass_rule.type !== 'iso_double' || no / eligible.length <= config.rules.pass_rule.negative_cap);
  const result = { track: state.track, cycle: state.cycle, details, yes, no, needed, passed };
  return chairLine(config, transition({ ...state, votes: [...state.votes, result] }, 'vote', now), 'vote');
}
