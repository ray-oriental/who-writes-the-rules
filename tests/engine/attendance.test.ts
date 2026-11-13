import { describe, expect, it } from 'vitest';
import { canReconvene, chooseSeat, convene, createGame, enterRoom, normalizeChoices, present, quorumMet, reconvene, setDeclineLetters, startTrack2 } from '../../src/engine';
import { fixture, freeze, ready } from './fixture';

describe('attendance and invitations', () => {
  it('normalizes explicit selections in seat order and caps fixed forum eligibility', () => {
    const config = fixture();
    const state = ready(config);
    const selection = { agenda_scope: 'technical', format: 'track1' as const, invited: ['d', 'a', 'missing', 'b', 'd'] };
    expect(normalizeChoices(config, state, { ...selection, forum: 'open' })?.invited).toEqual(['b', 'd']);
    expect(normalizeChoices(config, state, { ...selection, forum: 'club' })?.invited).toEqual(['b', 'd']);
    expect(normalizeChoices(config, state, { ...selection, forum: 'fixed' })?.invited).toEqual(['b']);
    expect(normalizeChoices(config, state, { ...selection, forum: 'fixed', invited: ['d'] })?.invited).toEqual([]);
    expect(normalizeChoices(config, { ...state, seat: 'c' }, { ...selection, forum: 'fixed' })).toBeUndefined();
  });

  it('allows omitting and re-inviting an eligible guest in an open forum', () => {
    const config = fixture();
    const selection = { forum: 'open', agenda_scope: 'technical', format: 'track1' as const, invited: ['b', 'd'] };
    const first = convene(config, ready(config), selection, 3);
    expect(first.attendance.find(result => result.delegation === 'c')).toMatchObject({ status: 'excluded', score: 3 });
    expect(first.trust.c).toBe(config.rules.trust.excluded);
    expect(present(config, first)).toEqual(['a', 'b', 'd']);

    const reopened = reconvene(config, first, 4);
    expect(reopened.choices?.invited).toEqual(['b', 'd']);
    const retry = convene(config, reopened, { ...selection, invited: ['b', 'd', 'c'] }, 5);
    expect(retry.choices?.invited).toEqual(['b', 'c', 'd']);
    expect(retry.attendance.find(result => result.delegation === 'c')).toMatchObject({ status: 'decline', score: 1 });
    expect(retry.trust.c).toBe(first.trust.c);
  });
  it('rejects unknown choices and actions in the wrong phase', () => {
    const config = fixture();
    const state = ready(config);
    const choices = { forum: 'missing', agenda_scope: 'technical', format: 'track1' as const, invited: [] };
    expect(convene(config, state, choices, 3)).toBe(state);
    expect(normalizeChoices(config, state, { ...choices, forum: 'open', agenda_scope: 'missing' })).toBeUndefined();
    expect(convene(config, createGame(config, { id: 'x', seed: 0, now: 0 }), { ...choices, forum: 'open' }, 3).phase).toBe('seat');
  });
  it('evaluates modifiers and trust before penalties and records all fired reasons', () => {
    const config = fixture();
    config.delegations[1].attendance.conditions = [
      { id: 'positive', when: { forum: 'club' }, modifier: 1, say: 'We welcome this forum.' },
      { id: 'negative', when: { agenda_includes: 'verifier' }, modifier: -3, say: 'This agenda is difficult.' },
      { id: 'inactive', when: { agenda_includes: 'political' }, modifier: -100, say: 'Controls are unacceptable.' },
    ];
    let state = ready(config);
    state.trust.b = 1;
    state = convene(config, freeze(state), { forum: 'club', agenda_scope: 'technical', format: 'track1', invited: ['b'] }, 3);
    expect(state.attendance[0]).toMatchObject({ score: 2, status: 'attend', threshold: 2 });
    expect(state.attendance[0].reasons.map(r => r.id)).toEqual(['positive', 'negative']);
    expect(state.attendance[1].status).toBe('excluded');
    expect(state.trust.c).toBe(-2);
    expect(state.trust.b).toBe(1);
    expect(state.convene_attempts).toBe(1);
    const retry = convene(config, reconvene(config, state, 4), { forum: 'open', agenda_scope: 'technical', format: 'track1', invited: ['b', 'c', 'd'] }, 5);
    expect(retry.attendance.find(a => a.delegation === 'c')).toMatchObject({ score: 1, status: 'decline' });
  });
  it('forces a refusal regardless of score and handles convening-only walkout triggers', () => {
    const config = fixture();
    config.delegations[1].attendance.conditions.push({ id: 'refuse', when: { forum: 'open' }, action: 'refuse', modifier: 100, say: 'We refuse.' });
    config.delegations[2].walkout_triggers.push({ id: 'agenda', when: { agenda_includes: 'technical' }, say: 'We reject this agenda.' });
    config.delegations[3].walkout_triggers.push({ id: 'mixed', when: { agenda_includes: 'technical', clause_present: 'metric' }, say: 'We reject this clause.' });
    const state = convene(config, ready(config), { forum: 'open', agenda_scope: 'technical', format: 'track1', invited: ['b', 'c', 'd'] }, 3);
    expect(state.attendance.map(a => a.status)).toEqual(['decline', 'decline', 'attend']);
    expect(state.attendance[1].reasons[0].id).toBe('agenda');
  });
  it('distinguishes omitting a fixed-forum member from a nonmember and clamps trust', () => {
    const config = fixture();
    let state = ready(config);
    state.trust.c = -3;
    state = convene(config, state, { forum: 'fixed', agenda_scope: 'technical', format: 'track1', invited: [] }, 3);
    expect(state.trust).toEqual({ a: 0, b: -2, c: -3, d: -1 });
    expect(state.attendance.map(result => [result.delegation, result.status])).toEqual([
      ['b', 'excluded'], ['c', 'excluded'], ['d', 'excluded'],
    ]);
  });
  it('generates parallel clauses with defaults, uses first convener per template and preserves them on Track 2', () => {
    const config = fixture();
    config.delegations[1].attendance.parallel_forum_propensity = 0.6;
    config.delegations[2].attendance.parallel_forum_propensity = 0.9;
    config.delegations[1].must_haves[0].when = { clause: 'verifier', param: 'who', in: ['shared', 'national'] };
    config.delegations[1].must_haves.push({ id: 'numeric', label: 'Metric', when: { clause: 'metric', param: 'rate', gte: 20 }, weight: 1, say: 'A stricter metric.' });
    const state = convene(config, ready(config), { forum: 'club', agenda_scope: 'technical', format: 'track1', invited: ['d'] }, 3);
    expect(state.parallel).toEqual({ convened_by: ['b', 'c'], clauses: [{ template: 'verifier', params: { who: 'shared', access: 'api' }, text: 'shared tests with api access.' }] });
    expect(startTrack2(config, state, 4).parallel).toEqual(state.parallel);
  });
  it('uses Track 2 willingness, consumes a use and initializes the expert return path', () => {
    const config = fixture();
    config.delegations[1].attendance.base_willingness.open = -10;
    const state = convene(config, ready(config), { forum: 'open', agenda_scope: 'technical', format: 'track2', invited: ['b', 'c', 'd'] }, 3);
    expect(state.track).toBe(2);
    expect(state.track2).toMatchObject({ used: 1, return_to: 'convene' });
    expect(state.attendance[0]).toMatchObject({ score: 5, status: 'attend' });
    expect(state.timeline.at(-1)).toEqual({ phase: 'attendance', track: 2, at: 3 });
    const back = reconvene(config, state, 4);
    expect(back.track).toBe(1);
    expect(convene(config, back, { ...state.choices!, format: 'track2' }, 5)).toBe(back);
  });
  it('keeps the player present and blocks room entry when no guests were invited', () => {
    const config = fixture();
    const state = convene(config, ready(config), { forum: 'open', agenda_scope: 'technical', format: 'track1', invited: [] }, 3);
    expect(state.choices?.invited).toEqual([]);
    expect(present(config, state)).toEqual(['a']);
    expect(quorumMet(config, state)).toBe(false);
    expect(enterRoom(config, state, 4)).toBe(state);
    expect(quorumMet(config, createGame(config, { id: 'x', seed: 1, now: 0 }))).toBe(false);
  });
  it('enforces reconvening limits and allows one return from expert attendance', () => {
    const config = fixture();
    const state = convene(config, ready(config), { forum: 'open', agenda_scope: 'technical', format: 'track1', invited: ['b', 'c', 'd'] }, 3);
    expect(canReconvene(config, state)).toBe(true);
    const second = convene(config, reconvene(config, state, 4), state.choices!, 5);
    expect(canReconvene(config, second)).toBe(false);
    expect(reconvene(config, second, 6)).toBe(second);
    const expert = startTrack2(config, second, 6);
    expect(canReconvene(config, expert)).toBe(true);
    const returned = convene(config, reconvene(config, expert, 7), state.choices!, 8);
    expect(canReconvene(config, returned)).toBe(false);
  });
  it('attaches letters without changing decisions or input state', () => {
    const config = fixture();
    const state = convene(config, ready(config), { forum: 'fixed', agenda_scope: 'technical', format: 'track1', invited: ['b'] }, 3);
    const next = setDeclineLetters(freeze(state), [{ delegation: 'c', letter: 'We decline.' }, { delegation: 'b', letter: 'Ignore this.' }]);
    expect(next.attendance[1]).toMatchObject({ letter: 'We decline.', status: 'excluded' });
    expect(next.attendance[0].letter).toBeUndefined();
    expect(setDeclineLetters(next, { d: 'A second letter.' }).attendance[2].letter).toBe('A second letter.');
  });
  it('requires playable seats', () => {
    const config = fixture();
    config.delegations[1].playable = false;
    const state = createGame(config, { id: 'x', seed: 1, now: 0 });
    expect(chooseSeat(config, state, 'b', 1)).toBe(state);
    expect(chooseSeat(config, state, 'missing', 1)).toBe(state);
  });
});
