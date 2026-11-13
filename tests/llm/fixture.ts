import type { GameConfig, Message } from '../../src/engine/types';
import type { DelegateInput, RapporteurInput, VoteStatementInput } from '../../src/llm/types';

/** Deliberately independent of the real config and every engine implementation. */
export function createFixture(): GameConfig {
  return {
    scenario: {
      title: 'Test summit', tagline: 'Test', intro: 'Test summit.', ai_language: 'en',
      repo_url: '', repo_branch: 'main', chair_name: 'Chair', player_role: 'Adviser', seats: ['a'],
    },
    rules: {
      rounds_per_cycle: 5, max_cycles: 3, min_responders_per_round: 2, max_responders_per_round: 3,
      allow_early_report_after: 3, min_clauses_to_vote: 2, voting_mode: 'all_delegations',
      pass_rule: { type: 'two_thirds', negative_cap: 0.25 }, quorum: 1, major_powers: ['a'],
      reconvene_attempts: 2, parallel_threshold: 0.6,
      trust: { min: -3, max: 3, excluded: -2, exclusive_forum_nonmember: -1 },
      track2: { enabled: true, uses_per_game: 1, rounds: 3, scope: ['technical'], bonus: 2 },
      swing_band: 1, tagger_confidence_min: 0.6, side_payments_per_cycle: 1,
      expo: { time_limit_minutes: 12 }, leaderboard: { prior_votes: 3, questions: [] },
    },
    forums: [{ id: 'forum', name: 'Test forum', description: '', exclusive: false, binding_level: 'low' }],
    convene: { agenda_scopes: [{ id: 'technical', label: 'Technical', description: '', categories: ['technical'] }], formats: [] },
    catalog: [
      { id: 'verifier', category: 'technical', label: 'Verifier', description: '', text: 'Verifier {who}',
        params: { who: { type: 'enum', values: ['national', 'shared'], default: 'shared' } } },
      { id: 'access', category: 'technical', label: 'Access', description: '', text: 'Access {level}',
        params: { level: { type: 'enum', values: ['api', 'weights'], default: 'api' } } },
    ],
    tags: [
      { id: 'recognition', label: 'Mutual recognition', description: 'Recognize national test results', examples: ['shared results'] },
      { id: 'capacity', label: 'Capacity support', description: 'Fund shared testing facilities', examples: ['training offer'] },
      { id: 'errors', label: 'Measurement error', description: 'Report uncertainty estimates', examples: ['error bars'] },
    ],
    side_payments: [], quiz: { enabled: false, questions: [] },
    delegations: [{
      id: 'a', name: 'Delegation A', short: 'AA', type: 'state', playable: true, difficulty: 'medium',
      summary: 'Test position.', mandate: 'Seek verifiable tests.',
      facts: [{ text: 'A supplied technical fact.', source_ids: ['C-A-01'] }], relations: {},
      voices: [{ id: 'engineer', label: 'Technical engineer', priorities: ['workable tests'] },
        { id: 'regulator', label: 'Regulatory lead', priorities: ['national control'] }],
      internal_resolution: 'veto_by_any',
      attendance: { attend_threshold: 1, base_willingness: { forum: 2 }, conditions: [],
        parallel_forum_propensity: 0, track2_willingness: 3 },
      red_lines: [{ id: 'no_weights', label: 'No weights', when: { clause: 'access', param: 'level', equals: 'weights' },
        say: 'We cannot release model weights.' }],
      must_haves: [
        { id: 'api', label: 'API access', weight: 1, when: { clause: 'access', param: 'level', equals: 'api' },
          say: 'We need API-only access.' },
        { id: 'national', label: 'National execution', weight: 4,
          when: { clause: 'verifier', param: 'who', in: ['national'] }, say: 'We need national execution.' },
      ],
      vote_threshold: 0, side_payment_values: {}, trust_initial: 0, walkout_triggers: [],
      brief: 'Use verifiable technical tests and national execution.', style: 'formal and technical',
      claims: [], research: [],
    }],
    general: { claims: [], research: [] }, prompts: {},
  };
}

export function message(text: string): Message {
  return { id: 'm1', track: 1, cycle: 1, round: 1, speaker: 'player', from_player: true, text, kind: 'speech' };
}

export function delegateInput(): DelegateInput {
  return {
    delegation: 'a', voice: 'engineer', track: 1, cycle: 1, round: 2,
    player_text: 'Could you support shared results?', addressed: true, clauses: [],
    missing: [{ label: 'API access', say: 'We need API-only access.' },
      { label: 'National execution', say: 'We need national execution.' }],
    softened: [], recent: [message('Could you support shared results?')], amendable_templates: ['verifier', 'access'],
  };
}

export function rapporteurInput(): RapporteurInput {
  return {
    track: 1, cycle: 1, transcript: [message('Shared results.')],
    clauses: [{ id: 'c1', text: 'National verification.', proposed_by: 'player' }],
    positions: [{ delegation: 'a', supports: [], opposes: ['c1'] }],
  };
}

export function voteInput(): VoteStatementInput {
  return { delegation: 'a', vote: 'no', red_lines: [], satisfied: [],
    missing: ['We need national execution.'], in_swing_band: false, transcript: [] };
}
