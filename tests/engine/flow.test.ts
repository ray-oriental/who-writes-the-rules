import { describe, expect, it } from 'vitest';
import { chooseSeat, concede, continueAfterVote, convene, counterfactuals, createGame, derive, endRound, enterRoom,
  finalizeVote, finishDebrief, leaveRoleCard, openDebrief, playerSpeak, proposeClause, quorumMet, replay, setReport, startReport, startTrack2, submitQuiz } from '../../src/engine';
import type { GameConfig, GameState, OutcomeType } from '../../src/engine/types';
import { fixture, freeze, ready, room } from './fixture';

function table(config: GameConfig, state: GameState): GameState {
  return proposeClause(config, proposeClause(config, state, 'verifier', {}), 'metric', {});
}

function vote(config: GameConfig, state: GameState): GameState {
  let next = playerSpeak(config, state, { text: 'Let us adopt these tests.', tags: [], now: 5 }).state;
  next = startReport(config, endRound(config, next), 6);
  next = setReport(next, { summary: 'Testing text.', positions: [], open_issues: [] });
  return finalizeVote(config, next, [], 7);
}

function scripted(outcome: OutcomeType): GameState {
  const config = fixture();
  if (outcome === 'paper_standard') config.delegations[1].vote_threshold = 10;
  if (outcome === 'split_standards') config.delegations[1].attendance.parallel_forum_propensity = 1;
  if (outcome === 'no_agreement') config.delegations.forEach(d => { d.vote_threshold = 100; });
  if (outcome === 'expert_consensus') config.delegations.slice(1).forEach(d => d.attendance.conditions.push({ id: `${d.id}-refuse`, when: { format: 'track1' }, action: 'refuse', say: 'Only experts can meet.' }));
  freeze(config);
  const club = outcome === 'club_standard' || outcome === 'split_standards';
  let state = convene(config, freeze(ready(config)), {
    forum: club ? 'club' : 'open',
    agenda_scope: 'technical', format: 'track1', invited: club ? ['c', 'd'] : ['b', 'c', 'd'],
  }, 3);
  if (outcome === 'expert_consensus') {
    state = startTrack2(config, freeze(state), 4);
    state = continueAfterVote(config, vote(config, table(config, enterRoom(config, state, 5))), 8);
    state = convene(config, state, { ...state.choices!, format: 'track1' }, 9);
    return concede(config, state, 10);
  }
  state = continueAfterVote(config, vote(config, table(config, enterRoom(config, state, 4))), 8);
  if (state.phase === 'negotiate') state = continueAfterVote(config, vote(config, freeze(state)), 9);
  return state;
}

describe('scripted complete games', () => {
  it.each<OutcomeType>(['full_agreement', 'club_standard', 'paper_standard', 'split_standards', 'expert_consensus', 'no_agreement'])('reaches %s through public entry points', outcome => {
    const state = scripted(outcome);
    expect(state.phase).toBe('outcome');
    expect(state.outcome?.type).toBe(outcome);
    expect(state.messages.map(m => m.id)).toEqual(state.messages.map((_, i) => `m${i + 1}`));
  });
  it('repeats the same seeded inputs with deeply equal states', () => {
    for (const outcome of ['full_agreement', 'club_standard', 'paper_standard', 'split_standards', 'expert_consensus', 'no_agreement'] as const) {
      expect(scripted(outcome)).toEqual(scripted(outcome));
    }
  });
});

describe('phase transitions and expert channel', () => {
  it('creates deterministic defaults and follows quiz and debrief phases with explicit timestamps', () => {
    const config = fixture();
    config.quiz.enabled = true;
    let state = createGame(config, { id: 'quiz', seed: 8, now: 0 });
    expect(state).toMatchObject({ phase: 'seat', seat: '', track: 1, cycle: 1, round: 0, trust: { a: 0, b: 0, c: 0, d: 0 } });
    state = chooseSeat(config, freeze(state), 'a', 1);
    state = leaveRoleCard(config, state, 2);
    expect(state.phase).toBe('prequiz');
    state = submitQuiz(state, 'pre', ['Actors and tradeoffs.'], 3);
    expect(state.phase).toBe('convene');
    state = concede(config, state, 4);
    state = openDebrief(state, 5);
    state = finishDebrief(config, state, 6);
    expect(state.phase).toBe('postquiz');
    state = submitQuiz(state, 'post', ['A fuller answer.'], 7);
    expect(state.phase).toBe('done');
    expect(state.quiz).toEqual({ pre: ['Actors and tradeoffs.'], post: ['A fuller answer.'] });
    expect(state.timeline.map(t => [t.phase, t.at])).toEqual([
      ['seat', 0], ['rolecard', 1], ['prequiz', 2], ['convene', 3], ['outcome', 4], ['debrief', 5], ['postquiz', 6], ['done', 7],
    ]);
    expect(finishDebrief(fixture(), openDebrief(scripted('full_agreement'), 9), 10).phase).toBe('done');
  });
  it('opens Track 2 after a failed quorum while preserving the chosen guest list', () => {
    const config = fixture();
    config.delegations[1].attendance.conditions.push({ id: 'track1', when: { format: 'track1' }, action: 'refuse', say: 'Only experts can meet.' });
    const attended = convene(config, ready(config), { forum: 'open', agenda_scope: 'technical', format: 'track1', invited: ['b'] }, 3);
    expect(quorumMet(config, attended)).toBe(false);
    const expert = startTrack2(config, { ...attended, cycle: 2 }, 4);
    expect(expert).toMatchObject({ phase: 'attendance', track: 2, cycle: 1, clauses: [], track2: { used: 1, return_to: 'convene' } });
    expect(expert.choices?.invited).toEqual(['b']);
    expect(expert.attendance.map(result => result.status)).toEqual(['attend', 'excluded', 'excluded']);
    expect(enterRoom(config, expert, 5)).toMatchObject({ phase: 'negotiate', cycle: 1, round: 1 });
    config.rules.track2.enabled = false;
    expect(startTrack2(config, attended, 4)).toBe(attended);
  });
  it('stores a passed annex, returns to convening and tables allowed annex clauses on Track 1 entry', () => {
    const config = fixture();
    let state = convene(config, ready(config), { forum: 'open', agenda_scope: 'technical', format: 'track2', invited: ['b', 'c', 'd'] }, 3);
    state = table(config, enterRoom(config, state, 4));
    state = continueAfterVote(config, vote(config, state), 8);
    expect(state).toMatchObject({ phase: 'convene', track: 1, track2: { used: 1 } });
    expect(state.track2.annex).toHaveLength(2);
    state = enterRoom(config, convene(config, state, { ...state.choices!, format: 'track1' }, 9), 10);
    expect(state.clauses).toHaveLength(2);
    expect(state.clauses.every(c => c.from_annex)).toBe(true);
    expect(state.timeline.at(-1)).toEqual({ phase: 'negotiate', track: 1, at: 10 });
  });
  it('stashes failed Track 1, runs the experts as cycle 1 and restores the next cycle with annex replacements', () => {
    const config = fixture();
    config.delegations.slice(1).forEach(d => { d.vote_threshold = 10; });
    let state = table(config, room(config));
    state = vote(config, state);
    expect(state.votes[0].passed).toBe(false);
    state = startTrack2(config, state, 8);
    expect(state.track2.stash?.clauses).toHaveLength(2);
    expect(state.track2.return_to).toBe('negotiate');
    expect(state.clauses).toEqual([]);
    state = enterRoom(config, state, 9);
    state = proposeClause(config, state, 'metric', { rate: 17 });
    state = proposeClause(config, state, 'domains', { areas: ['bio'] });
    config.delegations.slice(1).forEach(d => { d.vote_threshold = -10; });
    state = continueAfterVote(config, vote(config, state), 10);
    expect(state).toMatchObject({ phase: 'negotiate', track: 1, cycle: 2, round: 1 });
    expect(state.clauses.find(c => c.template === 'verifier')?.from_annex).toBeUndefined();
    expect(state.clauses.find(c => c.template === 'metric')).toMatchObject({ params: { rate: 17 }, from_annex: true });
    expect(state.clauses.find(c => c.template === 'metric')?.history).toHaveLength(2);
    expect(state.clauses.find(c => c.template === 'domains')?.from_annex).toBe(true);
    expect(state.choices?.format).toBe('track1');
    expect(state.track2.stash).toBeUndefined();
    expect(state.suggestions).toEqual([]);
  });
  it('continues to the next cycle after failed experts and ends when no Track 1 cycle remains', () => {
    const config = fixture();
    config.delegations.slice(1).forEach(d => { d.vote_threshold = 100; });
    const initial = vote(config, table(config, room(config)));
    let state = startTrack2(config, initial, 8);
    state = continueAfterVote(config, vote(config, table(config, enterRoom(config, state, 9))), 10);
    expect(state).toMatchObject({ phase: 'negotiate', track: 1, cycle: 2 });
    expect(state.track2.annex).toBeUndefined();
    config.rules.max_cycles = 1;
    state = startTrack2(config, initial, 8);
    config.delegations.slice(1).forEach(d => { d.vote_threshold = -100; });
    state = continueAfterVote(config, vote(config, table(config, enterRoom(config, state, 9))), 10);
    expect(state.outcome?.type).toBe('expert_consensus');
    expect(state.track).toBe(1);
  });
  it('retains Track 1 walkouts across cycles and restores them after experts', () => {
    const config = fixture();
    config.delegations[1].walkout_triggers.push({ id: 'exit', when: { clause_present: 'metric', format: 'track1' }, say: 'We leave.' });
    config.delegations.slice(1).forEach(d => { d.vote_threshold = 100; });
    const failed = vote(config, table(config, room(config)));
    expect(continueAfterVote(config, failed, 8).walkouts).toHaveLength(1);
    let state = startTrack2(config, failed, 8);
    expect(state.walkouts).toHaveLength(0);
    state = continueAfterVote(config, vote(config, table(config, enterRoom(config, state, 9))), 10);
    expect(state.walkouts).toHaveLength(1);
    expect(derive(config, state).present).not.toContain('b');
  });
  it('replays with a fresh trust ledger and the same seat and prior-run comparison', () => {
    const config = fixture();
    const previous = scripted('club_standard');
    const state = replay(config, freeze(previous), { id: 'replay', now: 20 });
    expect(state).toMatchObject({ id: 'replay', phase: 'convene', seat: 'a', seed: 7, trust: { a: 0, b: 0, c: 0, d: 0 }, votes: [], track2: { used: 0 } });
    expect(state.previous).toMatchObject({ outcome: 'club_standard', attended: ['a', 'c', 'd'], yes: 3, no: 0 });
  });
  it('recomputes counterfactuals one dimension at a time and caps them at two per major power', () => {
    const config = fixture();
    config.rules.major_powers = ['a', 'b', 'c'];
    config.delegations[1].attendance.conditions.push({ id: 'politics', when: { agenda_includes: 'political', format: 'track1' }, action: 'refuse', say: 'No politics.' });
    const state = convene(config, ready(config), { forum: 'club', agenda_scope: 'broad', format: 'track1', invited: ['b', 'd'] }, 3);
    const suggestions = counterfactuals(config, state);
    expect(suggestions.filter(s => s.delegation === 'b')).toHaveLength(2);
    expect(suggestions.some(s => s.delegation === 'b' && s.change.agenda_scope === 'technical')).toBe(true);
    expect(suggestions.some(s => s.delegation === 'b' && s.change.format === 'track2')).toBe(true);
    expect(suggestions.filter(s => s.delegation === 'c').map(s => s.change)).toEqual([{ invited: ['b', 'd', 'c'] }]);
    const fixed = convene(config, ready(config), { forum: 'fixed', agenda_scope: 'technical', format: 'track1', invited: ['b'] }, 3);
    expect(counterfactuals(config, fixed)).toEqual([]);
    expect(suggestions.every(s => Object.keys(s.change).length === 1 && s.description.includes('would have attended'))).toBe(true);
    expect(derive(config, state).counterfactuals).toEqual([]);
    expect(derive(config, concede(config, state, 4)).counterfactuals).toEqual(suggestions);
  });
});
