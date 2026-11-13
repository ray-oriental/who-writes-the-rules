import type { DelegationConfig, GameConfig, GameState } from '../../src/engine/types';
import { chooseSeat, convene, createGame, enterRoom, leaveRoleCard } from '../../src/engine';

function delegation(id: string): DelegationConfig {
  return {
    id, name: id.toUpperCase(), short: id.toUpperCase(), type: 'state', playable: true, difficulty: 'medium',
    summary: 'A fixture delegation.', mandate: 'Agree on workable tests.', facts: [], relations: {},
    voices: [{ id: 'technical', label: 'Technical voice', priorities: [] }, { id: 'political', label: 'Political voice', priorities: [] }],
    internal_resolution: 'veto_by_any', attendance: { attend_threshold: 2, base_willingness: { open: 3, club: 3, fixed: 3 },
      conditions: [], parallel_forum_propensity: 0, track2_willingness: 5 },
    red_lines: [{ id: `${id}-weights`, label: 'Protect weights', when: { clause: 'verifier', param: 'access', equals: 'weights' },
      voice: 'political', say: 'We cannot release model weights.', source_ids: ['C-TEST-01'] }],
    must_haves: [{ id: `${id}-national`, label: 'National testing', when: { clause: 'verifier', param: 'who', equals: 'national' },
      weight: 2, voice: 'technical', softenable_by: ['recognition', 'capacity', 'evidence'], soften_amount: 1, max_soften: 2,
      say: 'National institutes should perform the tests.', source_ids: ['C-TEST-01'] }],
    vote_threshold: 0, side_payment_values: { training: 2, data: 1 }, trust_initial: 0,
    walkout_triggers: [], brief: 'Use evidence.', style: 'Formal', claims: [], research: [],
  };
}

export function fixture(): GameConfig {
  return {
    scenario: { title: 'Fixture summit', tagline: 'Test fixture', intro: 'Negotiate a text.', ai_language: 'en', repo_url: '',
      repo_branch: 'main', chair_name: 'Chair', player_role: 'Adviser', seats: ['a', 'b', 'c', 'd'] },
    rules: { rounds_per_cycle: 3, max_cycles: 2, min_responders_per_round: 1, max_responders_per_round: 2,
      allow_early_report_after: 1, min_clauses_to_vote: 2, voting_mode: 'all_delegations', pass_rule: { type: 'two_thirds', negative_cap: 0.25 },
      quorum: 2, major_powers: ['a', 'b'], reconvene_attempts: 1, parallel_threshold: 0.6,
      trust: { min: -3, max: 3, excluded: -2, exclusive_forum_nonmember: -1 },
      track2: { enabled: true, uses_per_game: 1, rounds: 2, scope: ['technical'], bonus: 2 },
      swing_band: 1, tagger_confidence_min: 0.6, side_payments_per_cycle: 2,
      expo: { time_limit_minutes: 12 }, leaderboard: { prior_votes: 3, questions: ['Feasible?'] } },
    forums: [
      { id: 'open', name: 'Open forum', description: 'Open to all delegations.', exclusive: false, binding_level: 'low' },
      { id: 'club', name: 'Club', description: 'Selected invitations.', exclusive: true, binding_level: 'medium' },
      { id: 'fixed', name: 'Fixed forum', description: 'Two members.', exclusive: true, binding_level: 'high', members_fixed: ['a', 'b'] },
    ],
    convene: { agenda_scopes: [
      { id: 'technical', label: 'Technical tests', description: 'Tests only.', categories: ['technical'] },
      { id: 'broad', label: 'Broad agenda', description: 'Includes politics.', categories: ['technical', 'political'] },
    ], formats: [{ id: 'track1', label: 'Track 1', description: 'Diplomats.' }, { id: 'track2', label: 'Track 2', description: 'Experts.' }] },
    catalog: [
      { id: 'verifier', category: 'technical', label: 'Verifier', description: 'Testing authority.', text: '{who} tests with {access} access.',
        params: { who: { type: 'enum', values: ['national', 'shared'], default: 'national' }, access: { type: 'enum', values: ['api', 'weights'], default: 'api' } } },
      { id: 'metric', category: 'technical', label: 'Metric', description: 'Testing threshold.', text: 'The threshold is {rate}%.',
        params: { rate: { type: 'number', min: 0, max: 50, default: 5 } } },
      { id: 'domains', category: 'technical', label: 'Domains', description: 'Tested domains.', text: 'Tests cover {areas}.',
        params: { areas: { type: 'multi', values: ['cyber', 'bio'], default: ['cyber'] } } },
      { id: 'controls', category: 'political', label: 'Controls', description: 'Export controls.', text: 'Apply export controls.', params: {} },
    ],
    tags: ['recognition', 'capacity', 'evidence'].map(id => ({ id, label: id, description: id, examples: [id] })),
    side_payments: [{ id: 'training', label: 'Training', description: 'Training support.' }, { id: 'data', label: 'Shared data', description: 'A common dataset.' }],
    quiz: { enabled: false, questions: [{ id: 'actors', text: 'Name the actors.' }] },
    delegations: ['a', 'b', 'c', 'd'].map(delegation),
    general: { claims: [{ id: 'C-TEST-01', claim: 'Fixture rule.', used_in: [], source: 'Synthetic test fixture', confidence: 'high' }], research: [] },
    prompts: { delegate: 'Speak as {{delegation}}.' },
  };
}

export function ready(config = fixture()): GameState {
  return leaveRoleCard(config, chooseSeat(config, createGame(config, { id: 'test', seed: 7, now: 0 }), 'a', 1), 2);
}

export function room(config = fixture()): GameState {
  return enterRoom(config, convene(config, ready(config), { forum: 'open', agenda_scope: 'technical', format: 'track1', invited: ['b', 'c', 'd'] }, 3), 4);
}

/** Freeze every input object to catch accidental mutation through normal entry points. */
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
