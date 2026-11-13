import { describe, expect, it } from 'vitest';
import { matchClauseCond, matchConveneCond, proposeClause } from '../../src/engine';
import type { ClauseCond, ConveneCond } from '../../src/engine/types';
import { fixture, room } from './fixture';

describe('clause condition operators', () => {
  const config = fixture();
  let state = proposeClause(config, room(config), 'verifier', {});
  state = proposeClause(config, state, 'metric', { rate: 5 });
  state = proposeClause(config, state, 'domains', { areas: ['cyber', 'bio'] });
  it.each<[ClauseCond, boolean]>([
    [{}, true], [{ clause: 'verifier' }, true], [{ clause: 'missing' }, false],
    [{ clause_present: 'metric' }, true], [{ clause_present: 'controls' }, false],
    [{ clause_absent: 'controls' }, true], [{ clause_absent: 'metric' }, false],
    [{ clause: 'metric', param: 'rate', equals: 5 }, true], [{ clause: 'metric', param: 'rate', equals: '5' }, false],
    [{ clause: 'metric', param: 'rate', in: [4, 5] }, true], [{ clause: 'metric', param: 'rate', in: [] }, false],
    [{ clause: 'metric', param: 'rate', not_in: [4] }, true], [{ clause: 'metric', param: 'rate', not_in: [5] }, false],
    [{ clause: 'metric', param: 'rate', gte: 5, lte: 5 }, true], [{ clause: 'metric', param: 'rate', gte: 6 }, false],
    [{ clause: 'metric', param: 'rate', lte: 4 }, false], [{ clause: 'verifier', param: 'who', gte: 1 }, false],
    [{ clause: 'verifier', param: 'who', lte: 1 }, false],
    [{ clause: 'domains', param: 'areas', includes: 'bio' }, true], [{ clause: 'domains', param: 'areas', includes: 'chem' }, false],
    [{ clause: 'verifier', param: 'who', includes: 'national' }, false],
    [{ clause: 'missing', param: 'rate', not_in: [5] }, false], [{ clause: 'metric', param: 'missing', not_in: [] }, false],
    [{ clause: 'metric', param: 'rate', equals: 5, clause_absent: 'metric' }, false],
  ])('matches %j as %s', (condition, expected) => expect(matchClauseCond(condition, state.clauses)).toBe(expected));
});

describe('convening condition operators', () => {
  const config = fixture();
  const ctx = { config, choices: { forum: 'club', agenda_scope: 'technical', format: 'track1' as const, invited: ['b'] }, seat: 'a', delegation: 'c', annex_exists: false };
  it.each<[ConveneCond, boolean]>([
    [{}, true], [{ agenda_includes: 'technical' }, true], [{ agenda_includes: 'verifier' }, true], [{ agenda_includes: 'controls' }, false],
    [{ forum: 'club' }, true], [{ forum: 'open' }, false], [{ forum_exclusive: true }, true], [{ forum_exclusive: false }, false],
    [{ not_invited: true }, true], [{ not_invited: false }, false], [{ format: 'track1' }, true], [{ format: 'track2' }, false],
    [{ annex_exists: false }, true], [{ annex_exists: true }, false], [{ other_invited: 'a' }, true], [{ other_invited: 'b' }, true],
    [{ other_invited: 'd' }, false], [{ other_not_invited: 'd' }, true], [{ other_not_invited: 'a' }, false],
    [{ forum: 'club', not_invited: true, format: 'track2' }, false],
  ])('matches %j as %s', (condition, expected) => expect(matchConveneCond(condition, ctx)).toBe(expected));
  it('always treats the player seat as invited', () => {
    expect(matchConveneCond({ not_invited: false }, { ...ctx, delegation: 'a' })).toBe(true);
  });
});
