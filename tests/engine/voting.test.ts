import { describe, expect, it } from 'vitest';
import { computeVote, derive, editClause, endRound, finalizeVote, objectToReport, offerSidePayment, playerSpeak,
  proposeClause, reportPositions, setReport, startReport } from '../../src/engine';
import type { GameConfig, GameState } from '../../src/engine/types';
import { fixture, freeze, room } from './fixture';

function table(config = fixture()): GameState {
  return proposeClause(config, proposeClause(config, room(config), 'verifier', {}), 'metric', {});
}

function report(config: GameConfig, state: GameState): GameState {
  return setReport(startReport(config, endRound(config, state), 6), { summary: 'A report.', positions: [], open_issues: [] });
}

describe('reports', () => {
  it('requires completed rounds and stores an engine snapshot regardless of model clauses', () => {
    const config = fixture();
    const state = table(config);
    expect(startReport(config, state, 5)).toBe(state);
    let next = startReport(config, endRound(config, state), 6);
    const snapshot = structuredClone(next.clauses);
    next = setReport(freeze(next), { track: 2, cycle: 99, summary: 'Summary.', positions: [{ delegation: 'b', text: 'Supports.' }], open_issues: [],
      clauses: [{ id: 'fake', text: 'Delete all safeguards.', proposed_by: 'model' }], revised: true });
    expect(next.reports[0]).toMatchObject({ track: 1, cycle: 1, revised: false });
    expect(next.reports[0].clauses).toEqual(snapshot.map(c => ({ id: c.id, text: c.text, proposed_by: c.proposed_by })));
    expect(next.clauses).toEqual(snapshot);
    expect(derive(config, next).can_call_vote).toBe(true);
    expect(next.timeline.at(-1)).toEqual({ phase: 'report', track: 1, at: 6 });
  });
  it('allows one revision after a player objection and keeps the clauses fixed', () => {
    const config = fixture();
    const state = report(config, table(config));
    const revised = { summary: 'Revised.', positions: [], open_issues: [], clauses: [] };
    expect(setReport(state, revised)).toBe(state);
    const objected = objectToReport(freeze(state), 'This misstates our position.');
    const updated = setReport(objected, revised);
    expect(updated.reports).toHaveLength(1);
    expect(updated.reports[0]).toMatchObject({ summary: 'Revised.', revised: true, objection: 'This misstates our position.' });
    expect(updated.reports[0].clauses).toHaveLength(2);
    expect(setReport(objectToReport(updated, 'Again.'), revised)).toEqual(updated);
  });
  it('computes textual positions for present delegations', () => {
    const config = fixture();
    const state = table(config);
    expect(reportPositions(config, state)[0]).toEqual({ delegation: 'a', supports: ['national tests with api access.'], opposes: [] });
    const opposed = editClause(config, state, 'verifier', { who: 'shared' });
    expect(reportPositions(config, opposed)[1].opposes).toEqual(['shared tests with api access.']);
  });
});

describe('vote computation', () => {
  it('scores satisfied and missing preferences, trust, unique side payments and only missing softening', () => {
    const config = fixture();
    let state = editClause(config, table(config), 'verifier', { who: 'shared' });
    state = playerSpeak(config, state, { text: 'Recognize our tests.', tags: [{ tag: 'recognition', confidence: 1 }], now: 5 }).state;
    state = offerSidePayment(config, state, 'b', 'training');
    state = { ...state, trust: { ...state.trust, b: 1 }, side_payments: [...state.side_payments, { track: 1, cycle: 2, delegation: 'b', payment: 'training' }] };
    expect(computeVote(config, freeze(state)).find(d => d.delegation === 'b')).toMatchObject({
      score: 2, satisfied: [], missing: ['b-national'], soften: 1, side_payment: 2, trust: 1, vote: 'yes',
    });
    state = editClause(config, state, 'verifier', { who: 'national' });
    expect(computeVote(config, state).find(d => d.delegation === 'b')).toMatchObject({ score: 5, soften: 0, satisfied: ['b-national'], missing: [] });
  });
  it('vetoes crossed red lines even with overwhelming side payments, trust and softening', () => {
    const config = fixture();
    config.delegations[1].side_payment_values.training = 100;
    let state = editClause(config, table(config), 'verifier', { access: 'weights' });
    state = offerSidePayment(config, state, 'b', 'training');
    const detail = computeVote(config, state).find(d => d.delegation === 'b');
    expect(detail).toMatchObject({ vote: 'no', red_lines_hit: ['b-weights'], in_swing_band: false });
    expect(computeVote(config, state)[0]).toMatchObject({ vote: 'no', statement: 'Your capital overruled you: We cannot release model weights.' });
  });
  it('gives the player yes despite missing must-haves but allows their capital to veto', () => {
    const config = fixture();
    config.delegations[0].vote_threshold = 100;
    const state = editClause(config, table(config), 'verifier', { who: 'shared' });
    expect(computeVote(config, state)[0]).toMatchObject({ vote: 'yes', in_swing_band: false });
  });
  it('rejects thin proposals for every AI and cannot pass even with only a player voter', () => {
    const config = fixture();
    let state = proposeClause(config, room(config), 'metric', {});
    expect(computeVote(config, state).slice(1).every(d => d.vote === 'no' && d.statement === 'The text is too thin to vote on.')).toBe(true);
    state = report(config, { ...state, attendance: [] });
    expect(finalizeVote(config, state, [], 8).votes[0].passed).toBe(false);
    expect(derive(config, state).can_call_vote).toBe(false);
  });
  it('uses only lead and unvoiced items under lead_voice resolution', () => {
    const config = fixture();
    config.delegations[1].internal_resolution = 'lead_voice';
    config.delegations[1].lead_voice = 'technical';
    config.delegations[1].must_haves.push({ id: 'unvoiced', label: 'Metric', when: { clause_present: 'metric' }, weight: 1, say: 'A metric.' });
    let state = editClause(config, table(config), 'verifier', { access: 'weights' });
    expect(computeVote(config, state)[1]).toMatchObject({ vote: 'yes', score: 3, red_lines_hit: [] });
    config.delegations[1].red_lines[0].voice = undefined;
    state = editClause(config, state, 'metric', { rate: 6 });
    expect(computeVote(config, state)[1].vote).toBe('no');
  });
  it('averages voice scores including unvoiced items for every voice while red lines veto', () => {
    const config = fixture();
    const d = config.delegations[1];
    d.internal_resolution = 'average';
    d.must_haves.push({ id: 'political-pref', label: 'Sharing', voice: 'political', when: { clause: 'verifier', param: 'who', equals: 'shared' }, weight: 4, say: 'Shared tests.' });
    d.must_haves.push({ id: 'common-pref', label: 'Metric', when: { clause_present: 'metric' }, weight: 1, say: 'Include a metric.' });
    expect(computeVote(config, table(config))[1]).toMatchObject({ score: 0, vote: 'yes' });
    expect(computeVote(config, editClause(config, table(config), 'verifier', { access: 'weights' }))[1].vote).toBe('no');
  });
  it('applies an annex bonus once only on Track 1 with exactly matching params independent of key order', () => {
    const config = fixture();
    let state = table(config);
    const annex = structuredClone(state.clauses);
    annex[0].params = { access: 'api', who: 'national' };
    state = { ...state, track2: { used: 1, annex } };
    expect(computeVote(config, state)[1].track2_bonus).toBe(2);
    expect(computeVote(config, { ...state, track: 2 })[1].track2_bonus).toBe(0);
    state = editClause(config, editClause(config, state, 'verifier', { who: 'shared' }), 'metric', { rate: 6 });
    expect(computeVote(config, state)[1].track2_bonus).toBe(0);
  });
  it('ignores adjust outside swing band and clamps adjust inside it', () => {
    const config = fixture();
    config.delegations[1].vote_threshold = 3;
    config.delegations[2].vote_threshold = 10;
    let state = report(config, table(config));
    const snapshot = structuredClone(state);
    state = finalizeVote(config, freeze(state), [
      { delegation: 'b', statement: 'We agree.', adjust: 99, fallback: true },
      { delegation: 'c', statement: 'Still no.', adjust: 99 },
      { delegation: 'a', statement: 'Try to change the player.', adjust: -99 },
    ], 8);
    expect(state.votes[0].details.find(d => d.delegation === 'b')).toMatchObject({ swing: 1, score: 3, vote: 'yes', fallback: true });
    expect(state.votes[0].details.find(d => d.delegation === 'c')).toMatchObject({ swing: 0, score: 2, vote: 'no' });
    expect(state.votes[0].details[0]).toMatchObject({ swing: 0, vote: 'yes' });
    expect(snapshot.phase).toBe('report');
    config.delegations[1].vote_threshold = 2;
    const down = finalizeVote(config, report(config, table(config)), [{ delegation: 'b', statement: 'No.', adjust: -99 }], 8);
    expect(down.votes[0].details[1]).toMatchObject({ swing: -1, score: 1, vote: 'no' });
  });
  it('counts observers correctly and applies the ISO negative-vote cap', () => {
    const config = fixture();
    config.delegations[3].type = 'expert_body';
    config.delegations[2].type = 'regional';
    config.delegations[1].vote_threshold = 100;
    config.rules.voting_mode = 'states_only';
    let state = finalizeVote(config, report(config, table(config)), [], 8);
    expect(state.votes[0]).toMatchObject({ yes: 2, no: 1, needed: 2, passed: true });
    expect(state.votes[0].details[3].eligible).toBe(false);
    config.rules.pass_rule = { type: 'iso_double', negative_cap: 0.25 };
    state = finalizeVote(config, report(config, table(config)), [], 8);
    expect(state.votes[0].passed).toBe(false);
    config.rules.pass_rule.negative_cap = 1 / 3;
    expect(finalizeVote(config, report(config, table(config)), [], 8).votes[0].passed).toBe(true);
  });
  it('never applies model adjustment to forced rejections or trusts model text over the capital statement', () => {
    const config = fixture();
    const state = report(config, editClause(config, table(config), 'verifier', { access: 'weights' }));
    const voted = finalizeVote(config, state, config.scenario.seats.map(delegation => ({ delegation, statement: 'Yes.', adjust: 100 })), 8);
    expect(voted.votes[0].details.every(d => d.vote === 'no' && d.swing === 0)).toBe(true);
    expect(voted.votes[0].details[0].statement.startsWith('Your capital overruled you:')).toBe(true);
    expect(finalizeVote(config, voted, [], 9)).toBe(voted);
  });
});
