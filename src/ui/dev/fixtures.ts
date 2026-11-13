/**
 * UI fixtures: a realistic config and one game state per phase, so screens can be built and
 * reviewed without the engine. PLACEHOLDER CONTENT — it imitates the shape of /config, not its truth.
 *
 * The small derive/attendance helpers below are crude stand-ins for the engine, good enough to make
 * the fixture flow clickable. Never import this file from a screen.
 */
import type {
  AttendanceResult,
  Claim,
  ConveneChoices,
  ConveneCond,
  DelegationConfig,
  GameConfig,
  GameState,
  Id,
  Message,
  Phase,
  ResearchNeed,
  VoteDetail,
} from '../../engine/types';
import type { DerivedView, GameLogSummary, PublishedProposal, Rating } from '../../game/api';

// ─────────────────────────────── Delegations ───────────────────────────────

const forumsWill = (un: number, bi: number, club: number, std: number) => ({
  un_multilateral: un,
  bilateral_us_china: bi,
  likeminded_club: club,
  standards_body: std,
});

const claim = (
  id: string,
  text: string,
  used: string[],
  source: string,
  confidence: Claim['confidence'],
  notes?: string,
): Claim => ({
  id,
  claim: text,
  used_in: used,
  source,
  confidence,
  ...(source.startsWith('http') ? { url: source } : {}),
  ...(notes ? { notes } : {}),
});

const need = (
  id: string,
  question: string,
  why: string,
  status: ResearchNeed['status'],
  owner?: string,
  leads?: string[],
  claim_ids?: string[],
): ResearchNeed => ({ id, question, why, status, owner, leads, claim_ids });

const china: DelegationConfig = {
  id: 'china',
  name: 'China',
  short: 'CN',
  type: 'state',
  playable: true,
  difficulty: 'harder',
  owner: 'tl',
  summary: 'Wants shared tests, but on national terms: no foreign access to models, results only.',
  mandate:
    'Secure a testing standard that Chinese institutes can run themselves and that recognises the national framework. Do not agree to anything that gives foreign evaluators access to model weights.',
  facts: [
    {
      text: 'TC260 has published a national standard on basic security requirements for generative AI services.',
      source_ids: ['C-CN-01'],
    },
    { text: 'Chinese providers must file models with the regulator before public release.', source_ids: ['C-CN-02'] },
    { text: 'China is not a member of the International Network of AI Safety Institutes.', source_ids: ['C-GEN-01'] },
  ],
  relations: {
    us: 'Rival. Export controls on chips are read as containment.',
    eu: 'Pragmatic partner on standards; wary of extraterritorial rules.',
    frontier_lab: 'Foreign firms; their access terms are a commercial matter.',
    global_south: 'Natural ally on capacity building and sovereignty.',
    evaluator: 'Acceptable if results are shared, not models.',
  },
  voices: [
    { id: 'tc260_engineer', label: 'Standards engineer (TC260)', priorities: ['workable_tests', 'domestic_alignment'] },
    {
      id: 'regulator',
      label: 'Regulator (security and content)',
      priorities: ['security_control', 'no_foreign_access'],
    },
  ],
  internal_resolution: 'veto_by_any',
  attendance: {
    attend_threshold: 3,
    base_willingness: forumsWill(5, 3, -10, 4),
    conditions: [
      {
        id: 'export_controls_on_agenda',
        when: { agenda_includes: 'political' },
        modifier: -3,
        say: 'Placing export controls on a safety agenda turns a technical meeting into an instrument of containment.',
        source_ids: ['C-CN-03'],
      },
      {
        id: 'excluded_from_club',
        when: { forum_exclusive: true, not_invited: true },
        action: 'consider_parallel_forum',
        say: 'A club that writes rules for everyone without everyone is not a standard; we will pursue a more inclusive platform.',
      },
    ],
    parallel_forum_propensity: 0.7,
    track2_willingness: 6,
  },
  red_lines: [
    {
      id: 'no_weights_access',
      label: 'No foreign access to model weights',
      when: { clause: 'model_access', param: 'level', equals: 'weights' },
      voice: 'regulator',
      say: 'Model weights are a matter of national security. No foreign body will inspect them.',
      source_ids: ['C-CN-02'],
    },
  ],
  must_haves: [
    {
      id: 'national_execution',
      label: 'Tests run by national institutes',
      when: { clause: 'verifier', param: 'who', in: ['national_institute'] },
      weight: 2,
      softenable_by: ['mutual_recognition', 'sovereignty_respect'],
      soften_amount: 1,
      max_soften: 2,
      say: 'Testing must be carried out by our own institutes; we will share results, not systems.',
    },
    {
      id: 'shared_test_set',
      label: 'A shared, open test set',
      when: { clause: 'jailbreak_rate', param: 'test_set', equals: 'shared' },
      weight: 1,
      say: 'A common test set is the only fair basis for comparing results across jurisdictions.',
    },
  ],
  vote_threshold: 1,
  side_payment_values: { capacity_support: 1, shared_test_set: 1, compute_credits: 0 },
  trust_initial: 0,
  walkout_triggers: [
    {
      id: 'export_controls_tabled',
      when: { clause_present: 'export_controls' },
      say: 'We did not come here to negotiate our own containment. The delegation withdraws.',
    },
  ],
  brief: 'Formal, cites the national framework, avoids direct confrontation.',
  style: 'formal',
  claims: [
    claim(
      'C-CN-01',
      'TC260 published TC260-003 on basic security requirements for generative AI services (2024).',
      ['facts/0'],
      'TC260-003-2024',
      'high',
    ),
    claim(
      'C-CN-02',
      'Chinese regulators will not accept foreign inspection of model weights.',
      ['red_lines/no_weights_access', 'facts/1'],
      '',
      'low',
      'Assumption; needs a source.',
    ),
    claim(
      'C-CN-03',
      'Chinese officials describe US chip export controls as containment.',
      ['attendance/export_controls_on_agenda'],
      'MFA press conference transcripts, 2023–2024',
      'medium',
    ),
  ],
  research: [
    need(
      'R-CN-01',
      'Has any Chinese official ruled out foreign access to model weights in writing?',
      'Backs the no_weights_access red line, currently low confidence.',
      'in_progress',
      'tl',
      ['CAC filing rules', 'TC260 drafts'],
      ['C-CN-02'],
    ),
    need(
      'R-CN-02',
      'What did China propose for the World AI Cooperation Organization in 2025?',
      'Parallel-forum propensity of 0.7.',
      'found',
      'jw',
      ['WAIC 2025 Shanghai declaration'],
      [],
    ),
    need(
      'R-CN-03',
      'Which bodies would run national testing (CAICT, TC260, others)?',
      'Mandate wording on national institutes.',
      'todo',
    ),
    need(
      'R-CN-04',
      'Did China take part in the Bletchley and Seoul summits, and at what level?',
      'Base willingness for multilateral forums.',
      'verified',
      'jw',
      ['Bletchley Declaration signatory list'],
      ['C-GEN-01'],
    ),
  ],
};

const us: DelegationConfig = {
  id: 'us',
  name: 'United States',
  short: 'US',
  type: 'state',
  playable: true,
  difficulty: 'medium',
  owner: 'mk',
  summary: 'Prefers voluntary, industry-led testing; resists binding rules and anything that looks like a treaty.',
  mandate:
    'Keep any standard voluntary and compatible with industry practice. Protect export controls from negotiation. Prefer evaluations by trusted national institutes over a new international body.',
  facts: [
    {
      text: 'The US AI Safety Institute (now CAISI) signed testing agreements with two frontier labs in 2024.',
      source_ids: ['C-US-01'],
    },
    { text: 'The US did not sign the Paris AI Action Summit declaration in 2025.', source_ids: ['C-US-02'] },
  ],
  relations: {
    china: 'Strategic competitor; will not discuss chip controls with it.',
    eu: 'Ally, but the AI Act is seen as over-regulation.',
    frontier_lab: 'Close partner; most labs are American.',
    global_south: 'Courted with capacity offers, not with rules.',
    evaluator: 'Useful if independent and non-governmental.',
  },
  voices: [{ id: 'state_dept', label: 'State Department', priorities: ['alliances', 'export_controls'] }],
  internal_resolution: 'lead_voice',
  lead_voice: 'state_dept',
  attendance: {
    attend_threshold: 3,
    base_willingness: forumsWill(2, 3, 5, 4),
    conditions: [
      {
        id: 'export_controls_negotiable',
        when: { agenda_includes: 'political' },
        modifier: -4,
        say: 'Export controls are national security measures and are not up for negotiation in any forum.',
        source_ids: ['C-US-03'],
      },
      {
        id: 'un_binding',
        when: { forum: 'un_multilateral' },
        modifier: -1,
        say: 'We do not support a UN process that could lead to binding obligations on American companies.',
      },
    ],
    parallel_forum_propensity: 0.4,
    track2_willingness: 4,
  },
  red_lines: [
    {
      id: 'no_export_control_limits',
      label: 'No limits on export controls',
      when: { clause_present: 'export_controls' },
      say: 'Our export controls are not a bargaining chip.',
    },
  ],
  must_haves: [
    {
      id: 'voluntary',
      label: 'Self-report or national verification',
      when: { clause: 'verifier', param: 'who', in: ['national_institute', 'self_report'] },
      weight: 2,
      softenable_by: ['measurement_error'],
      soften_amount: 1,
      max_soften: 1,
      say: 'Verification should build on what labs and national institutes already do.',
    },
  ],
  vote_threshold: 1,
  side_payment_values: { capacity_support: 0, shared_test_set: 0, compute_credits: 1 },
  trust_initial: 1,
  walkout_triggers: [],
  brief: 'Direct, pragmatic, protective of industry.',
  style: 'direct',
  claims: [
    claim(
      'C-US-01',
      'The US AISI signed MOUs with OpenAI and Anthropic for pre-deployment testing (Aug 2024).',
      ['facts/0'],
      'https://www.nist.gov/news-events/news/2024/08',
      'high',
    ),
    claim(
      'C-US-02',
      'The US and UK did not sign the Paris AI Action Summit declaration (Feb 2025).',
      ['facts/1'],
      '',
      'high',
      'Add link.',
    ),
    claim(
      'C-US-03',
      'US officials treat chip export controls as non-negotiable national security measures.',
      ['attendance/export_controls_negotiable'],
      'BIS rule announcements 2022–2024',
      'medium',
    ),
  ],
  research: [
    need(
      'R-US-01',
      "What is CAISI's current mandate after the 2025 renaming?",
      'Brief and must-have wording.',
      'in_progress',
      'mk',
      ['NIST CAISI page'],
    ),
    need('R-US-02', 'Has the US endorsed any UN AI resolution text?', 'UN willingness of 2.', 'found', 'mk', [
      'UNGA A/78/L.49',
    ]),
    need(
      'R-US-03',
      'Do US officials ever discuss export controls in multilateral AI settings?',
      'Red line no_export_control_limits.',
      'todo',
    ),
  ],
};

const eu: DelegationConfig = {
  id: 'eu',
  name: 'European Union',
  short: 'EU',
  type: 'regional',
  playable: true,
  difficulty: 'easier',
  owner: 'as',
  summary: 'Has a law already; wants others to adopt tests compatible with the AI Act.',
  mandate:
    'Bring partners to standards that are interoperable with the AI Act and its general-purpose AI code of practice. Third-party verification is preferred; a deal without the major powers is worth less.',
  facts: [
    {
      text: 'The AI Act sets obligations for general-purpose AI models above 10^25 FLOP of training compute.',
      source_ids: ['C-EU-01'],
    },
    { text: 'The AI Office oversees general-purpose AI models and can request evaluations.', source_ids: ['C-EU-02'] },
    { text: 'CEN-CENELEC JTC 21 is drafting harmonised standards for the AI Act.' },
  ],
  relations: {
    china: 'Engage on technical standards; disagreements on rights.',
    us: 'Ally that rejects the regulatory model.',
    frontier_lab: 'Regulated parties; must comply with the code of practice.',
    global_south: 'Partner for capacity building and the "Brussels effect".',
    evaluator: 'Preferred verifier.',
  },
  voices: [{ id: 'ai_office', label: 'AI Office', priorities: ['interoperability', 'third_party'] }],
  internal_resolution: 'lead_voice',
  lead_voice: 'ai_office',
  attendance: {
    attend_threshold: 2,
    base_willingness: forumsWill(4, -10, 5, 5),
    conditions: [],
    parallel_forum_propensity: 0.2,
    track2_willingness: 5,
  },
  red_lines: [],
  must_haves: [
    {
      id: 'third_party',
      label: 'Third-party verification',
      when: { clause: 'verifier', param: 'who', equals: 'third_party' },
      weight: 2,
      softenable_by: ['mutual_recognition'],
      soften_amount: 1,
      max_soften: 1,
      say: 'Verification has to be independent of the developer.',
    },
    {
      id: 'compute_threshold_aligned',
      label: 'Threshold aligned with 10^25 FLOP',
      when: { clause: 'compute_threshold', param: 'flop', equals: '1e25' },
      weight: 1,
      say: 'Any threshold should match the one already in European law.',
    },
  ],
  vote_threshold: 1,
  side_payment_values: { capacity_support: 0, shared_test_set: 1, compute_credits: 0 },
  trust_initial: 1,
  walkout_triggers: [],
  brief: 'Procedural, references the AI Act.',
  style: 'procedural',
  claims: [
    claim(
      'C-EU-01',
      'The AI Act presumes systemic risk for GPAI models trained with more than 10^25 FLOP.',
      ['facts/0', 'must_haves/compute_threshold_aligned'],
      'Regulation (EU) 2024/1689, Art. 51',
      'high',
    ),
    claim(
      'C-EU-02',
      'The AI Office may conduct evaluations of GPAI models with systemic risk.',
      ['facts/1'],
      'Regulation (EU) 2024/1689, Art. 92',
      'high',
    ),
  ],
  research: [
    need(
      'R-EU-01',
      'Does the GPAI code of practice require third-party evaluation?',
      'Must-have third_party.',
      'verified',
      'as',
      ['Code of practice, safety and security chapter'],
      ['C-EU-02'],
    ),
    need('R-EU-02', 'What is the EU position on the UN Global Dialogue on AI governance?', 'UN willingness.', 'todo'),
    need(
      'R-EU-03',
      'Has the EU joined a "like-minded" testing network?',
      'Club willingness of 5.',
      'in_progress',
      'as',
    ),
  ],
};

const frontier_lab: DelegationConfig = {
  id: 'frontier_lab',
  name: 'Frontier AI Lab',
  short: 'LAB',
  type: 'firm',
  playable: false,
  difficulty: 'medium',
  owner: 'rz',
  summary: 'Builds the models being tested. Will share access through an API, never the weights.',
  mandate: 'Keep testing workable and confidential. Agree to structured access; refuse weight transfer.',
  facts: [
    { text: 'Labs already run internal red-teaming and publish system cards.', source_ids: ['C-LAB-01'] },
    { text: 'Structured access through an API lets testers probe a model without copying it.' },
  ],
  relations: {
    china: 'Not a market it serves.',
    us: 'Home regulator.',
    eu: 'Large market with binding rules.',
    global_south: 'Future users.',
    evaluator: 'Works with them under NDA.',
  },
  voices: [{ id: 'policy', label: 'Policy team', priorities: ['confidentiality', 'workable_tests'] }],
  internal_resolution: 'lead_voice',
  lead_voice: 'policy',
  attendance: {
    attend_threshold: 2,
    base_willingness: forumsWill(2, -10, 4, 4),
    conditions: [
      {
        id: 'weights_on_agenda',
        when: { agenda_includes: 'verification_tech', format: 'track1' },
        modifier: -1,
        say: 'We will discuss verification, but any demand for weights would end our participation.',
      },
    ],
    parallel_forum_propensity: 0.1,
    track2_willingness: 6,
  },
  red_lines: [
    {
      id: 'no_weights',
      label: 'No weight transfer',
      when: { clause: 'model_access', param: 'level', equals: 'weights' },
      say: 'Handing over weights would expose our core intellectual property and create new security risks.',
    },
  ],
  must_haves: [
    {
      id: 'api_access',
      label: 'API or structured access',
      when: { clause: 'model_access', param: 'level', in: ['api_only', 'structured_access'] },
      weight: 2,
      say: 'Testers can have structured access; that is how verification already works.',
    },
  ],
  vote_threshold: 1,
  side_payment_values: { capacity_support: 0, shared_test_set: 0, compute_credits: 0 },
  trust_initial: 0,
  walkout_triggers: [],
  brief: 'Technical, cooperative, firm on IP.',
  style: 'technical',
  claims: [
    claim(
      'C-LAB-01',
      'Frontier labs publish system cards describing pre-release red-teaming.',
      ['facts/0'],
      'Published system cards, 2023–2025',
      'high',
    ),
    claim('C-LAB-02', 'Labs regard weights as their most sensitive asset.', ['red_lines/no_weights'], '', 'medium'),
  ],
  research: [
    need(
      'R-LAB-01',
      'What do lab frontier safety frameworks say about external access?',
      'must_haves/api_access',
      'found',
      'rz',
      ['Lab safety frameworks (2024–2025)'],
    ),
    need('R-LAB-02', 'Has any lab agreed to government access to weights?', 'Red line no_weights.', 'todo'),
    need(
      'R-LAB-03',
      'How long do pre-deployment tests by AISIs take?',
      'Brief: "workable tests".',
      'in_progress',
      'rz',
    ),
  ],
};

const global_south: DelegationConfig = {
  id: 'global_south',
  name: 'Global South Coalition',
  short: 'GS',
  type: 'regional',
  playable: true,
  difficulty: 'harder',
  owner: 'np',
  summary: 'Will follow rules it helped write; wants testing capacity, not just obligations.',
  mandate:
    'Make sure any standard comes with capacity support and a seat in its governance. Refuse rules written in clubs.',
  facts: [
    { text: 'Most countries have no institute able to evaluate frontier models.', source_ids: ['C-GS-01'] },
    { text: 'The UN General Assembly adopted two AI resolutions by consensus in 2024.' },
  ],
  relations: {
    china: 'Partner on capacity; keeps a distance on security.',
    us: 'Donor; suspicious of conditions.',
    eu: 'Donor; wary of regulatory export.',
    frontier_lab: 'Wants affordable access.',
    evaluator: 'Wants regional evaluators trained.',
  },
  voices: [{ id: 'coordinator', label: 'Coalition coordinator', priorities: ['capacity', 'inclusion'] }],
  internal_resolution: 'average',
  attendance: {
    attend_threshold: 3,
    base_willingness: forumsWill(6, -10, 1, 3),
    conditions: [
      {
        id: 'club_forum',
        when: { forum: 'likeminded_club' },
        modifier: -2,
        say: 'Rules made in a small club and exported to the rest of us are not rules we can sign.',
      },
      {
        id: 'no_capacity',
        when: { agenda_includes: 'governance' },
        modifier: 1,
        say: 'An agenda that covers governance at least leaves room for capacity and representation.',
      },
    ],
    parallel_forum_propensity: 0.5,
    track2_willingness: 3,
  },
  red_lines: [],
  must_haves: [
    {
      id: 'capacity',
      label: 'Capacity support for testing',
      when: { clause: 'incident_reporting' },
      weight: 2,
      softenable_by: ['capacity_support'],
      soften_amount: 2,
      max_soften: 2,
      say: 'Obligations without the means to meet them only widen the gap.',
    },
  ],
  vote_threshold: 1,
  side_payment_values: { capacity_support: 2, shared_test_set: 1, compute_credits: 1 },
  trust_initial: 0,
  walkout_triggers: [],
  brief: 'Measured, emphasises fairness and inclusion.',
  style: 'measured',
  claims: [
    claim(
      'C-GS-01',
      'Fewer than a dozen countries had AI safety institutes by 2025.',
      ['facts/0'],
      '',
      'low',
      'Count is a guess.',
    ),
    claim(
      'C-GS-02',
      'Developing countries call for capacity building in UN AI resolutions.',
      ['must_haves/capacity'],
      'UNGA A/RES/78/311',
      'medium',
    ),
  ],
  research: [
    need(
      'R-GS-01',
      'Which countries have an AI safety or evaluation institute?',
      'C-GS-01 is low confidence.',
      'todo',
      '',
      [],
      ['C-GS-01'],
    ),
    need('R-GS-02', 'What did the G77 say about AI at the UN in 2024–2025?', 'Coalition mandate.', 'in_progress', 'np'),
    need(
      'R-GS-03',
      'Is "Global South Coalition" a fair simplification? Who would speak for it?',
      'Delegation design itself.',
      'todo',
      'np',
    ),
    need(
      'R-GS-04',
      'Examples of capacity-building offers tied to AI standards.',
      'Side payment capacity_support.',
      'found',
      'np',
      ['UK–Africa AI partnership', 'China capacity-building action plan'],
    ),
  ],
};

const evaluator: DelegationConfig = {
  id: 'evaluator',
  name: 'Independent Evaluators',
  short: 'EVAL',
  type: 'expert_body',
  playable: false,
  difficulty: 'easier',
  owner: 'tl',
  summary: 'Third-party testers. Care about whether the numbers mean anything.',
  mandate: 'Push for tests that measure what they claim to. Object to single metrics that can be gamed.',
  facts: [
    { text: 'Jailbreak success rates vary widely with the attack set used.', source_ids: ['C-EV-01'] },
    { text: 'Benchmarks leak into training data and lose meaning over time.' },
  ],
  relations: {
    china: 'Would test there if invited.',
    us: 'Main funder of evaluation work.',
    eu: 'Main customer under the AI Act.',
    frontier_lab: 'Depends on their access.',
    global_south: 'Wants to train regional evaluators.',
  },
  voices: [{ id: 'researcher', label: 'Lead researcher', priorities: ['validity'] }],
  internal_resolution: 'lead_voice',
  lead_voice: 'researcher',
  attendance: {
    attend_threshold: 1,
    base_willingness: forumsWill(2, -10, 3, 5),
    conditions: [],
    parallel_forum_propensity: 0,
    track2_willingness: 8,
  },
  red_lines: [],
  must_haves: [
    {
      id: 'structured',
      label: 'More than black-box access',
      when: { clause: 'model_access', param: 'level', in: ['structured_access', 'weights'] },
      weight: 1,
      softenable_by: ['verify_without_weights'],
      soften_amount: 1,
      max_soften: 1,
      say: 'Black-box testing alone cannot tell you how a model will fail.',
    },
  ],
  vote_threshold: 0,
  side_payment_values: { capacity_support: 0, shared_test_set: 1, compute_credits: 1 },
  trust_initial: 1,
  walkout_triggers: [],
  brief: 'Careful, quantitative.',
  style: 'technical',
  claims: [
    claim(
      'C-EV-01',
      'Reported jailbreak success rates depend strongly on the attack suite.',
      ['facts/0'],
      'HarmBench (2024)',
      'high',
    ),
    claim(
      'C-EV-02',
      'Black-box evaluations underestimate some dangerous capabilities.',
      ['must_haves/structured'],
      '',
      'medium',
    ),
  ],
  research: [
    need(
      'R-EV-01',
      'Evidence that structured access finds more than API testing.',
      'must_haves/structured',
      'in_progress',
      'tl',
      ['Structured access literature'],
    ),
    need(
      'R-EV-02',
      'Who are the main third-party evaluators and who funds them?',
      'Delegation summary.',
      'found',
      'tl',
    ),
    need('R-EV-03', 'Measurement error of jailbreak metrics across test sets.', 'measurement_error tag.', 'todo'),
  ],
};

// ─────────────────────────────── Config ───────────────────────────────

export const fixtureConfig: GameConfig = {
  scenario: {
    title: 'Who Writes the Rules for AI?',
    tagline: 'A summit on testing frontier models. Who comes to the table decides what gets written.',
    intro:
      'Six delegations could agree a common standard for testing frontier AI models. First you decide where to meet, what to discuss and whom to invite. Then you negotiate the clauses and put them to a vote.',
    ai_language: 'en',
    repo_url: '',
    repo_branch: 'main',
    chair_name: 'The Chair',
    player_role: 'Technical adviser',
    seats: ['china', 'us', 'eu', 'frontier_lab', 'global_south', 'evaluator'],
  },
  rules: {
    rounds_per_cycle: 5,
    max_cycles: 3,
    min_responders_per_round: 2,
    max_responders_per_round: 3,
    allow_early_report_after: 3,
    min_clauses_to_vote: 2,
    voting_mode: 'all_delegations',
    pass_rule: { type: 'two_thirds', negative_cap: 0.25 },
    quorum: 4,
    major_powers: ['china', 'us', 'eu'],
    reconvene_attempts: 2,
    parallel_threshold: 0.6,
    trust: { min: -3, max: 3, excluded: -2, exclusive_forum_nonmember: -1 },
    track2: {
      enabled: true,
      uses_per_game: 1,
      rounds: 3,
      scope: ['test_method', 'metric_definition', 'verification_tech'],
      bonus: 2,
    },
    swing_band: 1,
    tagger_confidence_min: 0.6,
    side_payments_per_cycle: 1,
    expo: { time_limit_minutes: 12 },
    leaderboard: {
      prior_votes: 3,
      questions: [
        'Would this standard actually reduce risk?',
        'Would the countries that matter follow it?',
        'Is it fair to those who were not at the table?',
      ],
    },
  },
  forums: [
    {
      id: 'un_multilateral',
      name: 'UN Global Dialogue session',
      description: 'Everyone may come. The text that survives is usually the weakest.',
      exclusive: false,
      binding_level: 'low',
    },
    {
      id: 'bilateral_us_china',
      name: 'China–US bilateral',
      description: 'The two largest AI powers alone. Open only to them.',
      exclusive: true,
      binding_level: 'medium',
      members_fixed: ['china', 'us'],
    },
    {
      id: 'likeminded_club',
      name: 'Like-minded testing network',
      description: 'A small group that already trusts each other. You choose who is in.',
      exclusive: true,
      binding_level: 'medium',
    },
    {
      id: 'standards_body',
      name: 'Technical standards committee',
      description: 'An ISO-like committee. Technical tone, slow consensus.',
      exclusive: false,
      binding_level: 'medium',
    },
  ],
  convene: {
    agenda_scopes: [
      {
        id: 'tests_only',
        label: 'Test methods only',
        description: 'How models are tested and what counts as a pass.',
        categories: ['test_method', 'metric_definition'],
      },
      {
        id: 'tests_verification',
        label: 'Tests and verification',
        description: 'Adds who verifies results and how much access testers get.',
        categories: ['test_method', 'metric_definition', 'verification_tech', 'governance'],
      },
      {
        id: 'tests_export_controls',
        label: 'Tests and export controls',
        description: 'Puts chip and model export controls on the table as well.',
        categories: ['test_method', 'metric_definition', 'verification_tech', 'governance', 'political'],
      },
    ],
    formats: [
      {
        id: 'track1',
        label: 'Official negotiation',
        description: 'Track 1. Delegations can bind their governments; harder to get them in the room.',
      },
      {
        id: 'track2',
        label: 'Expert dialogue',
        description: 'Track 2. Engineers and scientists; easier to attend, the result binds no one.',
      },
    ],
  },
  catalog: [
    {
      id: 'jailbreak_rate',
      category: 'test_method',
      label: 'Jailbreak success rate',
      description: 'Maximum share of attacks that get through.',
      text: 'Jailbreak success rate must not exceed {threshold_pct}% on the {test_set} test set.',
      params: {
        threshold_pct: { type: 'number', label: 'Threshold', min: 0, max: 50, step: 1, default: 5, unit: '%' },
        test_set: {
          type: 'enum',
          label: 'Test set',
          values: ['shared', 'national', 'lab_internal'],
          default: 'shared',
          value_labels: { shared: 'shared', national: 'national', lab_internal: 'lab-internal' },
        },
      },
    },
    {
      id: 'dangerous_capability_eval',
      category: 'test_method',
      label: 'Dangerous-capability evaluations',
      description: 'Domains every frontier model is tested in.',
      text: 'Frontier models are evaluated for dangerous capabilities in {domains}.',
      params: {
        domains: {
          type: 'multi',
          label: 'Domains',
          values: ['cyber', 'bio', 'chem', 'nuclear'],
          default: ['cyber', 'bio'],
        },
      },
    },
    {
      id: 'compute_threshold',
      category: 'metric_definition',
      label: 'Compute threshold',
      description: 'Training compute above which a model counts as frontier.',
      text: 'A model trained with more than {flop} FLOP is a frontier model.',
      params: {
        flop: {
          type: 'enum',
          label: 'Threshold',
          values: ['1e25', '1e26'],
          default: '1e26',
          value_labels: { '1e25': '10^25', '1e26': '10^26' },
        },
      },
    },
    {
      id: 'verifier',
      category: 'verification_tech',
      label: 'Who verifies results',
      description: 'The body that checks test results.',
      text: 'Test results are verified by {who}.',
      params: {
        who: {
          type: 'enum',
          label: 'Verifier',
          values: ['national_institute', 'third_party', 'self_report'],
          default: 'national_institute',
          value_labels: {
            national_institute: 'a national institute',
            third_party: 'an independent third party',
            self_report: 'the developer (self-report)',
          },
        },
      },
    },
    {
      id: 'model_access',
      category: 'verification_tech',
      label: 'Model access for testers',
      description: 'How deep testers can look.',
      text: 'Testers receive {level} access to the model.',
      params: {
        level: {
          type: 'enum',
          label: 'Access',
          values: ['api_only', 'structured_access', 'weights'],
          default: 'structured_access',
          value_labels: { api_only: 'API-only', structured_access: 'structured', weights: 'full weights' },
        },
      },
    },
    {
      id: 'incident_reporting',
      category: 'governance',
      label: 'Incident reporting',
      description: 'Serious incidents are reported to a shared registry.',
      text: 'Serious incidents are reported within {days} days to a shared registry.',
      params: { days: { type: 'number', label: 'Deadline', min: 1, max: 90, default: 15, unit: 'days' } },
    },
    {
      id: 'export_controls',
      category: 'political',
      label: 'Export controls',
      description: 'Limits on export controls for chips and models.',
      text: 'Parties will not impose export controls on {items} without consultation.',
      params: { items: { type: 'multi', label: 'Items', values: ['chips', 'models'], default: ['chips'] } },
    },
  ],
  tags: [
    {
      id: 'verify_without_weights',
      label: 'Verify without weights',
      description: 'A way to verify results without handing over model weights.',
      examples: ['structured access', 'secure enclave'],
    },
    {
      id: 'measurement_error',
      label: 'Measurement error',
      description: 'Error bars, gaming, Goodhart effects.',
      examples: ['error bars', 'gamed'],
    },
    {
      id: 'mutual_recognition',
      label: 'Mutual recognition',
      description: "Recognise each other's national test results.",
      examples: ['mutual recognition'],
    },
    {
      id: 'capacity_support',
      label: 'Capacity support',
      description: 'Shared facilities or training.',
      examples: ['training', 'shared facilities'],
    },
    {
      id: 'sovereignty_respect',
      label: 'Sovereignty',
      description: 'Testing stays national; only results are shared.',
      examples: ['national institutes'],
    },
  ],
  side_payments: [
    { id: 'capacity_support', label: 'Capacity support', description: 'Fund testing facilities and training.' },
    { id: 'shared_test_set', label: 'Open the test set', description: 'Publish the shared test set.' },
    { id: 'compute_credits', label: 'Compute credits', description: 'Free compute for evaluation work.' },
  ],
  quiz: {
    enabled: true,
    questions: [
      { id: 'q1', text: 'Who should decide how frontier AI models are tested, and why?' },
      { id: 'q2', text: 'What makes a country willing or unwilling to join international AI rules?' },
    ],
  },
  delegations: [china, us, eu, frontier_lab, global_south, evaluator],
  general: {
    claims: [
      claim(
        'C-GEN-01',
        'China is not a member of the International Network of AI Safety Institutes (2024).',
        ['attendance/china', 'facts/china'],
        'US Commerce Department announcement, Nov 2024',
        'high',
      ),
      claim(
        'C-GEN-02',
        'Track 2 dialogues between US and Chinese scientists continued while official talks stalled.',
        ['rules/track2'],
        'IDAIS Beijing consensus (2024)',
        'medium',
      ),
    ],
    research: [
      need(
        'R-GEN-01',
        'Is the "XIV Round of the US–China Dialogue on AI and International Security" Track 2?',
        'Track 2 framing.',
        'in_progress',
        'jw',
      ),
      need('R-GEN-02', 'Typical quorum rules in ISO technical committees.', 'rules/quorum', 'todo'),
    ],
  },
  prompts: { delegate: '', rapporteur: '', tagger: '', decline_letter: '', vote_statement: '' },
};

// ─────────────────────── Fixture-only stand-ins for the engine ───────────────────────

const byId = (id: Id) => fixtureConfig.delegations.find((d) => d.id === id)!;

function conveneMatches(cond: ConveneCond, d: Id, c: ConveneChoices, annex: boolean): boolean {
  const cfg = fixtureConfig;
  const scope = cfg.convene.agenda_scopes.find((s) => s.id === c.agenda_scope);
  const forum = cfg.forums.find((f) => f.id === c.forum);
  if (cond.agenda_includes !== undefined) {
    const t = cfg.catalog.find((x) => x.id === cond.agenda_includes);
    const cat = t ? t.category : cond.agenda_includes;
    if (!scope?.categories.includes(cat)) return false;
  }
  if (cond.forum !== undefined && cond.forum !== c.forum) return false;
  if (cond.forum_exclusive !== undefined && cond.forum_exclusive !== !!forum?.exclusive) return false;
  if (cond.not_invited !== undefined && cond.not_invited !== !c.invited.includes(d)) return false;
  if (cond.format !== undefined && cond.format !== c.format) return false;
  if (cond.annex_exists !== undefined && cond.annex_exists !== annex) return false;
  if (cond.other_invited !== undefined && !c.invited.includes(cond.other_invited)) return false;
  if (cond.other_not_invited !== undefined && c.invited.includes(cond.other_not_invited)) return false;
  return true;
}

export function fixtureAttendance(
  seat: Id,
  c: ConveneChoices,
  trust: Record<Id, number>,
  annex = false,
): AttendanceResult[] {
  const forum = fixtureConfig.forums.find((f) => f.id === c.forum)!;
  return fixtureConfig.scenario.seats
    .filter((id) => id !== seat)
    .map((id) => {
      const d = byId(id);
      const fired = d.attendance.conditions.filter((k) => conveneMatches(k.when, id, c, annex));
      const reasons = fired.map((k) => ({ id: k.id, say: k.say, modifier: k.modifier, action: k.action }));
      const base =
        c.format === 'track2' ? d.attendance.track2_willingness : (d.attendance.base_willingness[c.forum] ?? 0);
      const score = base + fired.reduce((s, k) => s + (k.modifier ?? 0), 0) + (trust[id] ?? 0);
      const threshold = d.attendance.attend_threshold;
      if (!c.invited.includes(id)) {
        return {
          delegation: id,
          status: 'excluded' as const,
          score,
          threshold,
          reasons,
          letter: excludedLetter(d, forum.name),
        };
      }
      const refuse = fired.some((k) => k.action === 'refuse');
      if (refuse || score < threshold) {
        return {
          delegation: id,
          status: 'decline' as const,
          score,
          threshold,
          reasons,
          letter: declineLetter(
            d,
            forum.name,
            reasons.map((r) => r.say),
          ),
        };
      }
      return { delegation: id, status: 'attend' as const, score, threshold, reasons };
    });
}

function declineLetter(d: DelegationConfig, forum: string, says: string[]): string {
  const why = says.length ? ` ${says.join(' ')}` : ' The conditions for a productive meeting are not yet in place.';
  return `The Delegation of ${d.name} presents its compliments to the Chair and thanks the convenors for the invitation to the ${forum}. After careful consideration, the Delegation regrets that it is unable to attend on this occasion.${why} The Delegation remains open to dialogue under conditions that respect the interests of all parties.`;
}

function excludedLetter(d: DelegationConfig, forum: string): string {
  return `The Delegation of ${d.name} notes that it was not invited to the ${forum}. It takes note of the decision and reserves its position on any text the meeting may produce.`;
}

export function fixtureDerived(state: GameState, config: GameConfig = fixtureConfig): DerivedView {
  const r = config.rules;
  const walked = new Set(state.walkouts.map((w) => w.delegation));
  const attending = state.attendance.filter((a) => a.status === 'attend').map((a) => a.delegation);
  const present =
    state.phase === 'seat' || state.phase === 'rolecard' || state.phase === 'prequiz' || state.phase === 'convene'
      ? []
      : [state.seat, ...attending].filter((id) => !walked.has(id));
  const voters =
    r.voting_mode === 'states_only'
      ? present.filter(
          (id) =>
            config.delegations.find((d) => d.id === id)?.type !== 'firm' &&
            config.delegations.find((d) => d.id === id)?.type !== 'expert_body',
        )
      : present;
  const scope = config.convene.agenda_scopes.find((s) => s.id === state.choices?.agenda_scope);
  const cats = state.track === 2 ? r.track2.scope : (scope?.categories ?? []);
  const rounds = state.track === 2 ? r.track2.rounds : r.rounds_per_cycle;
  const stances: DerivedView['stances'] = {};
  state.clauses.forEach((c, i) => {
    stances[c.id] = {};
    present
      .filter((id) => id !== state.seat)
      .forEach((id, j) => {
        stances[c.id][id] = (['support', 'oppose', 'neutral'] as const)[(i + j) % 3];
      });
  });
  return {
    present,
    voters,
    votes_needed: Math.ceil((2 / 3) * Math.max(voters.length, 1)),
    quorum_met: present.length >= r.quorum,
    rounds_in_cycle: rounds,
    can_speak: state.phase === 'negotiate' && state.round < rounds,
    can_request_report: state.phase === 'negotiate' && state.round >= r.allow_early_report_after,
    can_call_vote: state.phase === 'report' && state.clauses.length >= r.min_clauses_to_vote,
    can_reconvene: state.phase === 'attendance' && state.convene_attempts <= r.reconvene_attempts,
    can_start_track2:
      r.track2.enabled &&
      state.track2.used < r.track2.uses_per_game &&
      (state.phase === 'attendance' || state.phase === 'vote'),
    side_payments_left:
      r.side_payments_per_cycle -
      state.side_payments.filter((p) => p.cycle === state.cycle && p.track === state.track).length,
    allowed_templates: config.catalog.filter((t) => cats.includes(t.category)).map((t) => t.id),
    selectable_forums: config.forums
      .filter((f) => !f.members_fixed || f.members_fixed.includes(state.seat))
      .map((f) => f.id),
    stances,
    // Stand-in for the engine's reading of the room: shown once two clauses are on the table.
    leanings:
      (state.phase === 'negotiate' || state.phase === 'report') && state.clauses.length >= 2
        ? Object.fromEntries(
            present
              .filter((id) => id !== state.seat)
              .map((id, index) => [id, (['yes', 'no', 'wavering'] as const)[index % 3]]),
          )
        : {},
    counterfactuals:
      state.phase === 'outcome' || state.phase === 'debrief' || state.phase === 'postquiz' || state.phase === 'done'
        ? [
            {
              delegation: 'china',
              change: { invited: ['china', 'us', 'frontier_lab', 'global_south', 'evaluator'] },
              description: 'Had China been invited, it would have attended.',
            },
            {
              delegation: 'global_south',
              change: { forum: 'un_multilateral' },
              description: 'Had you met at the UN, the Global South Coalition would have attended.',
            },
          ]
        : [],
  };
}

// ─────────────────────────────── Game states ───────────────────────────────

const T0 = Date.UTC(2026, 10, 12, 9, 0, 0);
const SEAT: Id = 'eu';

export const fixtureChoices: ConveneChoices = {
  forum: 'likeminded_club',
  agenda_scope: 'tests_verification',
  format: 'track1',
  invited: ['us', 'frontier_lab', 'global_south', 'evaluator'],
};

const baseTrust = Object.fromEntries(fixtureConfig.delegations.map((d) => [d.id, d.trust_initial]));

export function freshState(seat: Id = SEAT): GameState {
  return {
    schema: 1,
    id: 'g-fixture-0001',
    seed: 42,
    started_at: T0,
    seat,
    phase: 'seat',
    track: 1,
    cycle: 1,
    round: 0,
    convene_attempts: 0,
    attendance: [],
    walkouts: [],
    trust: { ...baseTrust },
    clauses: [],
    suggestions: [],
    messages: [],
    soften_log: [],
    side_payments: [],
    reports: [],
    votes: [],
    track2: { used: 0 },
    quiz: {},
    timeline: [{ phase: 'seat', track: 1, at: T0 }],
  };
}

const at = (phase: Phase, s: GameState): GameState => ({
  ...s,
  phase,
  timeline: [...s.timeline, { phase, track: s.track, at: T0 + s.timeline.length * 60_000 }],
});

const attendanceOk = fixtureAttendance(SEAT, fixtureChoices, { ...baseTrust, china: -2 });
// Make the main fixture land on a clear "4 of 6, quorum met" table regardless of tweaks above.
const attendanceMain: AttendanceResult[] = attendanceOk.map((a) =>
  a.delegation === 'us' || a.delegation === 'frontier_lab' || a.delegation === 'evaluator'
    ? { ...a, status: 'attend', letter: undefined }
    : a,
);
const attendanceFailed: AttendanceResult[] = attendanceMain.map((a) =>
  a.delegation === 'us'
    ? {
        ...a,
        status: 'decline',
        score: 1,
        reasons: [{ id: 'export_controls_negotiable', say: byId('us').attendance.conditions[0].say, modifier: -4 }],
        letter: declineLetter(byId('us'), 'Like-minded testing network', [byId('us').attendance.conditions[0].say]),
      }
    : a,
);

const msg = (id: string, speaker: Message['speaker'], text: string, extra: Partial<Message> = {}): Message => ({
  id,
  track: 1,
  cycle: 1,
  round: 1,
  speaker,
  text,
  kind: speaker === 'chair' ? 'chair' : speaker === 'system' ? 'system' : 'speech',
  ...extra,
});

const negotiateMessages: Message[] = [
  msg('m1', 'chair', 'The Chair opens the first round. Five rounds remain before the rapporteur reports.', {
    round: 1,
  }),
  msg(
    'm2',
    SEAT,
    'We propose that results be verified by an independent third party, with structured access through a secure API so that no weights leave the developer.',
    { round: 1, from_player: true, tags: [{ tag: 'verify_without_weights', confidence: 0.82 }] },
  ),
  msg(
    'm3',
    'frontier_lab',
    'Structured access is workable for us. We already provide it to two national institutes under confidentiality terms.',
    { round: 1 },
  ),
  msg(
    'm4',
    'us',
    'We can accept third-party verification if national institutes can also act as verifiers. A single international verifier is a step too far.',
    { round: 1 },
  ),
  msg('m5', 'chair', 'Round two. The floor is open.', { round: 2 }),
  msg('m6', SEAT, 'A five percent jailbreak threshold on a shared test set gives everyone the same yardstick.', {
    round: 2,
    from_player: true,
    tags: [],
  }),
  msg(
    'm7',
    'evaluator',
    'Five percent means little without error bars. On different attack suites the same model scores between two and eleven percent.',
    { round: 2, fallback: true },
  ),
];

const clauses: GameState['clauses'] = [
  {
    id: 'cl1',
    template: 'verifier',
    params: { who: 'third_party' },
    text: 'Test results are verified by an independent third party.',
    version: 1,
    proposed_by: SEAT,
    history: [],
  },
  {
    id: 'cl2',
    template: 'model_access',
    params: { level: 'structured_access' },
    text: 'Testers receive structured access to the model.',
    version: 1,
    proposed_by: SEAT,
    history: [],
  },
  {
    id: 'cl3',
    template: 'jailbreak_rate',
    params: { threshold_pct: 5, test_set: 'shared' },
    text: 'Jailbreak success rate must not exceed 5% on the shared test set.',
    version: 2,
    proposed_by: SEAT,
    history: [
      {
        version: 1,
        params: { threshold_pct: 3, test_set: 'shared' },
        text: 'Jailbreak success rate must not exceed 3% on the shared test set.',
        cycle: 1,
        round: 1,
      },
    ],
  },
];

function build(): Record<string, GameState> {
  const seat = freshState();
  const rolecard = at('rolecard', seat);
  const prequiz = at('prequiz', rolecard);
  const convene = at('convene', {
    ...prequiz,
    quiz: { pre: ['National institutes, because they answer to voters.', ''] },
  });
  const attendance: GameState = at('attendance', {
    ...convene,
    convene_attempts: 1,
    choices: fixtureChoices,
    attendance: attendanceMain,
    trust: { ...convene.trust, china: -2, global_south: -1 },
  });
  const attendanceFail: GameState = { ...attendance, attendance: attendanceFailed };
  const negotiate: GameState = at('negotiate', {
    ...attendance,
    round: 2,
    messages: negotiateMessages,
    clauses,
    suggestions: [
      {
        id: 's1',
        from: 'us',
        template: 'verifier',
        params: { who: 'national_institute' },
        text: 'Test results are verified by a national institute.',
        replaces: 'cl1',
        note: 'National institutes may act as verifiers.',
      },
    ],
    soften_log: [
      {
        message_id: 'm2',
        tag: 'verify_without_weights',
        delegation: 'evaluator',
        must_have: 'structured',
        amount: 1,
        track: 1,
        cycle: 1,
      },
    ],
  });
  const report: GameState = at('report', {
    ...negotiate,
    round: 5,
    reports: [
      {
        track: 1,
        cycle: 1,
        summary:
          'Delegations converged on structured access for testers and disagreed on who verifies results. The threshold for jailbreak success was accepted in principle, subject to error bars.',
        positions: [
          { delegation: 'us', text: 'Supports structured access; prefers national institutes as verifiers.' },
          { delegation: 'frontier_lab', text: 'Supports structured access; opposes any weight transfer.' },
          { delegation: 'evaluator', text: 'Supports third-party verification; asks for error bars on all metrics.' },
        ],
        open_issues: ['Whether national institutes may act as verifiers.', 'How measurement error is reported.'],
        clauses: clauses.map((c) => ({ id: c.id, text: c.text, proposed_by: c.proposed_by })),
        revised: false,
      },
    ],
  });
  const vote: GameState = at('vote', {
    ...report,
    votes: [
      {
        track: 1,
        cycle: 1,
        yes: 3,
        no: 1,
        needed: 3,
        passed: true,
        details: ['eu', 'us', 'frontier_lab', 'evaluator'].map((d, i): VoteDetail => ({
          delegation: d,
          eligible: true,
          vote: i === 1 ? 'no' : 'yes',
          score: i === 1 ? 0 : 2,
          threshold: 1,
          red_lines_hit: [],
          satisfied: [],
          missing: i === 1 ? ['voluntary'] : [],
          soften: 0,
          side_payment: 0,
          trust: 0,
          track2_bonus: 0,
          swing: 0,
          in_swing_band: i === 1,
          statement:
            i === 1
              ? 'The United States cannot support a text that sets aside national verification.'
              : 'We support the text as tabled.',
        })).concat([
          {
            delegation: 'global_south',
            eligible: false,
            vote: 'no' as const,
            score: 0,
            threshold: 1,
            red_lines_hit: [],
            satisfied: [],
            missing: [],
            soften: 0,
            side_payment: 0,
            trust: 0,
            track2_bonus: 0,
            swing: 0,
            in_swing_band: false,
            statement: 'We follow the proceedings as observers and reserve our position.',
          },
        ]),
      },
    ],
    soften_log: [
      ...negotiate.soften_log,
      { message_id: 'm2', tag: 'verify_without_weights', delegation: 'frontier_lab', must_have: 'api_access', amount: 1, track: 1, cycle: 1 },
      { message_id: 'm6', tag: 'shared_yardstick', delegation: 'us', must_have: 'voluntary', amount: 1, track: 1, cycle: 1 },
    ],
  });
  const outcome: GameState = at('outcome', {
    ...vote,
    outcome: {
      type: 'club_standard',
      passed: true,
      final_vote: vote.votes[0],
      absent_major: ['china'],
      opposing_major: ['us'],
      parallel: {
        convened_by: ['china'],
        clauses: [
          {
            template: 'verifier',
            params: { who: 'national_institute' },
            text: 'Test results are verified by a national institute.',
          },
        ],
      },
    },
    parallel: { convened_by: ['china'], clauses: [] },
  });
  const debrief = at('debrief', outcome);
  const postquiz = at('postquiz', debrief);
  const done = at('done', { ...postquiz, quiz: { ...postquiz.quiz, post: ['Whoever convenes the meeting.', ''] } });
  const track2: GameState = {
    ...negotiate,
    track: 2,
    cycle: 1,
    round: 1,
    track2: { used: 1, return_to: 'convene' },
    messages: negotiateMessages.slice(0, 3).map((m) => ({ ...m, track: 2 })),
  };
  return {
    seat,
    rolecard,
    prequiz,
    convene,
    attendance,
    attendance_failed: attendanceFail,
    negotiate,
    track2_negotiate: track2,
    report,
    vote,
    outcome,
    debrief,
    postquiz,
    done,
  };
}

export const fixtureStates = build();

export const FIXTURE_LIST: { key: string; label: string; note?: string }[] = [
  { key: 'seat', label: 'Seat' },
  { key: 'rolecard', label: 'Role card', note: 'EU seat' },
  { key: 'prequiz', label: 'Pre-quiz' },
  { key: 'convene', label: 'Convene' },
  { key: 'attendance', label: 'Attendance', note: '4 of 6, quorum met' },
  { key: 'attendance_failed', label: 'Attendance (failed)', note: '3 of 6, below quorum' },
  { key: 'negotiate', label: 'Negotiate', note: 'Round 2' },
  { key: 'track2_negotiate', label: 'Negotiate (Track 2)' },
  { key: 'report', label: 'Report' },
  { key: 'vote', label: 'Vote' },
  { key: 'outcome', label: 'Outcome', note: 'Club standard' },
  { key: 'debrief', label: 'Debrief' },
  { key: 'postquiz', label: 'Post-quiz' },
  { key: 'done', label: 'Done' },
];

// ─────────────────────────────── Platform ───────────────────────────────

export const fixtureProposals: PublishedProposal[] = [
  {
    id: 'p1',
    game_id: 'g-0991',
    kind: 'proposal',
    title: 'Like-minded testing network, cycle 2',
    created_at: T0 - 86_400_000,
    seat: 'eu',
    outcome: 'club_standard',
    forum: 'likeminded_club',
    forum_name: 'Like-minded testing network',
    clauses: [
      'Test results are verified by an independent third party.',
      'Testers receive structured access to the model.',
      'Jailbreak success rate must not exceed 5% on the shared test set.',
    ],
    attended: ['eu', 'us', 'frontier_lab', 'evaluator'],
    absent: ['china', 'global_south'],
    votes: [
      { delegation: 'eu', vote: 'yes' },
      { delegation: 'us', vote: 'yes' },
      { delegation: 'frontier_lab', vote: 'yes' },
      { delegation: 'evaluator', vote: 'no' },
    ],
    yes: 3,
    no: 1,
  },
  {
    id: 'p2',
    game_id: 'g-0993',
    kind: 'proposal',
    title: 'UN Global Dialogue session, cycle 3',
    created_at: T0 - 43_200_000,
    seat: 'global_south',
    outcome: 'paper_standard',
    forum: 'un_multilateral',
    forum_name: 'UN Global Dialogue session',
    clauses: [
      'Serious incidents are reported within 30 days to a shared registry.',
      'Frontier models are evaluated for dangerous capabilities in cyber, bio.',
    ],
    attended: ['global_south', 'china', 'eu', 'us', 'evaluator'],
    absent: ['frontier_lab'],
    votes: [
      { delegation: 'global_south', vote: 'yes' },
      { delegation: 'china', vote: 'yes' },
      { delegation: 'eu', vote: 'yes' },
      { delegation: 'us', vote: 'no' },
      { delegation: 'evaluator', vote: 'yes' },
    ],
    yes: 4,
    no: 1,
  },
  {
    id: 'p3',
    game_id: 'g-0994',
    kind: 'annex',
    title: 'Expert annex on test methods',
    created_at: T0 - 3_600_000,
    seat: 'china',
    outcome: 'expert_consensus',
    forum: 'standards_body',
    forum_name: 'Technical standards committee',
    clauses: [
      'Jailbreak success rate must not exceed 8% on the shared test set.',
      'A model trained with more than 10^26 FLOP is a frontier model.',
    ],
    attended: ['china', 'us', 'eu', 'frontier_lab', 'global_south', 'evaluator'],
    absent: [],
    votes: [
      { delegation: 'china', vote: 'yes' },
      { delegation: 'us', vote: 'yes' },
      { delegation: 'eu', vote: 'yes' },
      { delegation: 'frontier_lab', vote: 'yes' },
      { delegation: 'global_south', vote: 'yes' },
      { delegation: 'evaluator', vote: 'yes' },
    ],
    yes: 6,
    no: 0,
  },
];

export const fixtureRatings: Rating[] = [
  {
    id: 'r1',
    proposal_id: 'p1',
    scores: [4, 2, 2],
    comment: 'Strong text, but China is not in it.',
    at: T0 - 80_000_000,
  },
  { id: 'r2', proposal_id: 'p1', scores: [4, 3, 2], at: T0 - 70_000_000 },
  { id: 'r3', proposal_id: 'p2', scores: [2, 3, 4], comment: 'Everyone signed, nothing changes.', at: T0 - 40_000_000 },
  { id: 'r4', proposal_id: 'p3', scores: [3, 4, 4], at: T0 - 3_000_000 },
];

export const fixtureGames: GameLogSummary[] = [
  { id: 'g-0991', started_at: T0 - 86_400_000, seat: 'eu', outcome: 'club_standard', duration_s: 694, cycles: 2 },
  {
    id: 'g-0993',
    started_at: T0 - 43_200_000,
    seat: 'global_south',
    outcome: 'paper_standard',
    duration_s: 812,
    cycles: 3,
  },
  { id: 'g-0994', started_at: T0 - 3_600_000, seat: 'china', outcome: 'expert_consensus', duration_s: 530, cycles: 1 },
  { id: 'g-0995', started_at: T0 - 1_800_000, seat: 'us', duration_s: 120, cycles: 0 },
];

/** Canned replies for speak() in the fixture flow. */
export const cannedReplies: Record<Id, string[]> = {
  china: [
    'Our institutes can run these tests. We will share results, not systems.',
    'A common test set is acceptable if it is open to all.',
  ],
  us: ['We could accept that if national institutes remain verifiers.', 'This should stay voluntary.'],
  eu: ['That is compatible with the AI Act, provided verification is independent.'],
  frontier_lab: ['We can provide structured access under confidentiality terms.', 'Weights are not on offer.'],
  global_south: [
    'Who pays for the testing capacity this requires?',
    'We need a seat in how this is governed, not only obligations.',
  ],
  evaluator: ['Please report error bars with every metric.', 'Black-box access will miss some failure modes.'],
};
