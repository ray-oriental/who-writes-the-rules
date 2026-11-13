/**
 * CONTRACT FILE: shared by the engine, the LLM layer, the controller and the UI.
 * Frozen while workers run in parallel. If you need a change, report it to the lead
 * instead of editing this file.
 *
 * Naming: config keys are snake_case because they mirror the YAML files in /config.
 */

export type Id = string;
export type ParamValue = string | number | string[];
export type Params = Record<string, ParamValue>;
export type TrackFormat = 'track1' | 'track2';
export type Track = 1 | 2;

// ───────────────────────── Config (parsed from /config) ─────────────────────────

export interface ScenarioConfig {
  title: string;
  tagline: string;
  /** 2–3 sentences shown on the seat screen. */
  intro: string;
  /** Language the AI delegates speak, e.g. "en". The UI itself is always English. */
  ai_language: string;
  /** e.g. "https://github.com/owner/repo". Empty string if unknown. Used for "Edit on GitHub" links. */
  repo_url: string;
  /** Branch used in edit links. */
  repo_branch: string;
  chair_name: string;
  /** The player's job title, e.g. "Technical adviser". */
  player_role: string;
  /** Delegation ids in clockwise table order. */
  seats: Id[];
}

export interface RulesConfig {
  rounds_per_cycle: number;
  max_cycles: number;
  min_responders_per_round: number;
  max_responders_per_round: number;
  /** The player may ask for the report early once this many rounds of the cycle are done. */
  allow_early_report_after: number;
  /** A vote cannot be called with fewer clauses on the table. */
  min_clauses_to_vote: number;
  voting_mode: 'all_delegations' | 'states_only';
  pass_rule: { type: 'two_thirds' | 'iso_double'; negative_cap: number };
  quorum: number;
  major_powers: Id[];
  reconvene_attempts: number;
  /** A declined/excluded delegation with propensity >= this convenes a parallel forum. */
  parallel_threshold: number;
  trust: { min: number; max: number; excluded: number; exclusive_forum_nonmember: number };
  track2: { enabled: boolean; uses_per_game: number; rounds: number; scope: string[]; bonus: number };
  /** The model may nudge a vote by ±1 only when |score - threshold| <= swing_band. */
  swing_band: number;
  tagger_confidence_min: number;
  side_payments_per_cycle: number;
  expo: { time_limit_minutes: number };
  leaderboard: { prior_votes: number; questions: string[] };
}

export interface Forum {
  id: Id;
  name: string;
  description: string;
  /** Exclusive forums let the player pick an invite list; non-exclusive forums invite everyone. */
  exclusive: boolean;
  binding_level: 'low' | 'medium' | 'high';
  /** If set, the forum is only selectable from one of these seats and exactly these delegations are invited. */
  members_fixed?: Id[];
  source_ids?: Id[];
}

export interface AgendaScope {
  id: Id;
  label: string;
  description: string;
  /** Clause-template categories that may be tabled under this scope. */
  categories: string[];
}

export interface FormatOption {
  id: TrackFormat;
  label: string;
  description: string;
}

export interface ConveneConfig {
  agenda_scopes: AgendaScope[];
  formats: FormatOption[];
}

export type ParamSpec =
  | { type: 'number'; label?: string; min: number; max: number; step?: number; default: number; unit?: string }
  | { type: 'enum'; label?: string; values: string[]; default?: string; value_labels?: Record<string, string> }
  | { type: 'multi'; label?: string; values: string[]; default?: string[]; value_labels?: Record<string, string> };

export interface ClauseTemplate {
  id: Id;
  /** e.g. test_method | metric_definition | verification_tech | governance | political */
  category: string;
  label: string;
  description: string;
  /** Sentence with {param} placeholders, e.g. "Jailbreak success rate must not exceed {threshold_pct}%". */
  text: string;
  params: Record<string, ParamSpec>;
  source_ids?: Id[];
}

export interface ArgumentTag {
  id: Id;
  label: string;
  description: string;
  /** Phrases that signal this argument; the mock tagger matches on them. */
  examples: string[];
}

export interface SidePayment {
  id: Id;
  label: string;
  description: string;
}

export interface QuizConfig {
  enabled: boolean;
  questions: { id: Id; text: string }[];
}

/**
 * Condition on the clauses currently on the table. All keys present must hold (AND).
 *  { clause: X }                          a clause from template X is on the table
 *  { clause: X, param: p, equals: v }     ... and its param p equals v   (also in / not_in / gte / lte / includes)
 *  { clause_present: X } / { clause_absent: X }
 * `includes` tests membership in a multi-valued param.
 */
export interface ClauseCond {
  clause?: Id;
  param?: string;
  equals?: string | number;
  in?: (string | number)[];
  not_in?: (string | number)[];
  gte?: number;
  lte?: number;
  includes?: string;
  clause_present?: Id;
  clause_absent?: Id;
}

/**
 * Condition on the convening choices, evaluated from one delegation's point of view. All keys AND.
 *  agenda_includes: a category name, or a clause-template id (resolved to its category), allowed by the agenda scope
 *  not_invited: this delegation is not on the invite list
 *  other_invited / other_not_invited: another delegation is / is not on the invite list
 */
export interface ConveneCond {
  agenda_includes?: string;
  forum?: Id;
  forum_exclusive?: boolean;
  not_invited?: boolean;
  format?: TrackFormat;
  annex_exists?: boolean;
  other_invited?: Id;
  other_not_invited?: Id;
}

export interface AttendanceCondition {
  id: Id;
  when: ConveneCond;
  /** Added to the willingness score when the condition holds. */
  modifier?: number;
  /** refuse: decline regardless of score. consider_parallel_forum: flag for the parallel-forum rule. */
  action?: 'refuse' | 'consider_parallel_forum';
  /** One sentence of reasoning, shown to the player and used by the mock model. */
  say: string;
  source_ids?: Id[];
}

export interface RedLine {
  id: Id;
  label: string;
  /** True = the red line is crossed. */
  when: ClauseCond;
  voice?: Id;
  say: string;
  source_ids?: Id[];
}

export interface MustHave {
  id: Id;
  label: string;
  /** True = the must-have is satisfied. */
  when: ClauseCond;
  weight: number;
  voice?: Id;
  softenable_by?: Id[];
  soften_amount?: number;
  max_soften?: number;
  say: string;
  source_ids?: Id[];
}

export interface WalkoutTrigger {
  id: Id;
  /** Either a convening condition (agenda) or a clause condition (something tabled). */
  when: ConveneCond & ClauseCond;
  say: string;
  source_ids?: Id[];
}

export interface Voice {
  id: Id;
  label: string;
  priorities: string[];
}

export type Confidence = 'high' | 'medium' | 'low';

/** One row of the claims table: a statement about the real world that a game rule relies on. */
export interface Claim {
  id: Id;
  claim: string;
  /** Free-text pointers to where the claim is used, e.g. "red_lines/no_weights_access". */
  used_in: string[];
  /** Citation text. Empty string if no source has been found yet. */
  source: string;
  url?: string;
  confidence: Confidence;
  notes?: string;
}

export type ResearchStatus = 'todo' | 'in_progress' | 'found' | 'verified';

/** A piece of material the team still has to find for this delegation. */
export interface ResearchNeed {
  id: Id;
  /** What we need to find out, phrased as a question. */
  question: string;
  /** Which rule or brief passage depends on it. */
  why: string;
  status: ResearchStatus;
  /** Team member handle or initials. Empty if unassigned. */
  owner?: string;
  /** Where to start looking, or links already found. */
  leads?: string[];
  notes?: string;
  /** Claim ids this need would back up once resolved. */
  claim_ids?: Id[];
}

export interface DelegationConfig {
  id: Id;
  name: string;
  /** 2–4 letter badge, e.g. "CN". No flags. */
  short: string;
  type: 'state' | 'regional' | 'firm' | 'expert_body';
  playable: boolean;
  difficulty: 'easier' | 'medium' | 'harder';
  /** Team member responsible for this file (handle or initials). */
  owner?: string;
  /** One line for the seat card. */
  summary: string;
  /** What this delegation was sent to achieve; shown on the role card. */
  mandate: string;
  /** Technical facts the player and the AI may use. */
  facts: { text: string; source_ids?: Id[] }[];
  /** One line per other delegation id. */
  relations: Record<Id, string>;
  voices: Voice[];
  internal_resolution: 'veto_by_any' | 'lead_voice' | 'average';
  lead_voice?: Id;
  attendance: {
    attend_threshold: number;
    /** Keyed by forum id. */
    base_willingness: Record<Id, number>;
    conditions: AttendanceCondition[];
    parallel_forum_propensity: number;
    track2_willingness: number;
  };
  red_lines: RedLine[];
  must_haves: MustHave[];
  vote_threshold: number;
  /** Keyed by side-payment id. */
  side_payment_values: Record<Id, number>;
  trust_initial: number;
  walkout_triggers: WalkoutTrigger[];
  /** Role brief for the model: position, tone, usable facts, things not to say. */
  brief: string;
  style: string;
  claims: Claim[];
  research: ResearchNeed[];
}

export interface GameConfig {
  scenario: ScenarioConfig;
  rules: RulesConfig;
  forums: Forum[];
  convene: ConveneConfig;
  catalog: ClauseTemplate[];
  tags: ArgumentTag[];
  side_payments: SidePayment[];
  quiz: QuizConfig;
  delegations: DelegationConfig[];
  /** Claims and research needs that are not tied to one delegation (rules, forums, catalog). */
  general: { claims: Claim[]; research: ResearchNeed[] };
  /** Prompt templates keyed by file stem: delegate, rapporteur, tagger, decline_letter, vote_statement. */
  prompts: Record<string, string>;
}

export interface ConfigIssue {
  /** e.g. "config/delegations/china.yaml" */
  file: string;
  /** e.g. "red_lines[0].when.clause" */
  path: string;
  message: string;
}

export type ConfigLoadResult =
  | { ok: true; config: GameConfig; warnings: ConfigIssue[] }
  | { ok: false; errors: ConfigIssue[]; warnings: ConfigIssue[] };

// ───────────────────────────────── Game state ─────────────────────────────────

export type Phase =
  | 'seat'
  | 'rolecard'
  | 'prequiz'
  | 'convene'
  | 'attendance'
  | 'negotiate'
  | 'report'
  | 'vote'
  | 'outcome'
  | 'debrief'
  | 'postquiz'
  | 'done';

export interface ConveneChoices {
  forum: Id;
  agenda_scope: Id;
  format: TrackFormat;
  /** Delegation ids invited (never includes the player's seat). */
  invited: Id[];
}

export type AttendStatus = 'attend' | 'decline' | 'excluded';

export interface AttendanceResult {
  delegation: Id;
  status: AttendStatus;
  score: number;
  threshold: number;
  /** Conditions that fired, in config order. */
  reasons: { id: Id; say: string; modifier?: number; action?: string }[];
  /** Diplomatic wording of a refusal; only for decline/excluded. */
  letter?: string;
}

export interface Walkout {
  delegation: Id;
  cycle: number;
  round: number;
  trigger: Id;
  say: string;
}

export interface Clause {
  id: Id;
  template: Id;
  params: Params;
  /** Rendered sentence; the engine keeps it in sync with params. */
  text: string;
  version: number;
  proposed_by: Id;
  /** True if the clause came from a Track 2 technical annex. */
  from_annex?: boolean;
  history: { version: number; params: Params; text: string; cycle: number; round: number }[];
}

/** An amendment proposed by an AI delegation. It reaches the table only if the player accepts it. */
export interface Suggestion {
  id: Id;
  from: Id;
  template: Id;
  params: Params;
  text: string;
  /** Clause id it would replace, if any. */
  replaces?: Id;
  note?: string;
}

export interface TagHit {
  tag: Id;
  confidence: number;
}

export interface Message {
  id: Id;
  track: Track;
  cycle: number;
  round: number;
  /** A delegation id (the player's seat for player messages), or one of the fixed roles. */
  speaker: Id | 'chair' | 'rapporteur' | 'system';
  from_player?: boolean;
  voice?: Id;
  addressed_to?: Id;
  text: string;
  kind: 'speech' | 'chair' | 'system' | 'side_payment' | 'walkout';
  /** Tags recognised in a player message (already filtered by the confidence floor). */
  tags?: TagHit[];
  /** True if the model call failed and a template was used instead. */
  fallback?: boolean;
}

export interface SoftenEvent {
  message_id: Id;
  tag: Id;
  delegation: Id;
  must_have: Id;
  amount: number;
  track: Track;
  cycle: number;
}

export type StancePosition = 'support' | 'oppose' | 'neutral';

export interface VoteDetail {
  delegation: Id;
  /** False for observers under voting_mode states_only. */
  eligible: boolean;
  vote: 'yes' | 'no';
  score: number;
  threshold: number;
  red_lines_hit: Id[];
  satisfied: Id[];
  missing: Id[];
  soften: number;
  side_payment: number;
  trust: number;
  track2_bonus: number;
  /** Model adjustment actually applied (-1 | 0 | 1), clamped by the engine. */
  swing: number;
  in_swing_band: boolean;
  /** Diplomatic statement shown with the vote. */
  statement: string;
  fallback?: boolean;
}

export interface VoteResult {
  track: Track;
  cycle: number;
  details: VoteDetail[];
  yes: number;
  no: number;
  needed: number;
  passed: boolean;
}

export interface Report {
  track: Track;
  cycle: number;
  summary: string;
  positions: { delegation: Id; text: string }[];
  open_issues: string[];
  /** Clause texts as tabled when the report was written; rendered by the program, never by the model. */
  clauses: { id: Id; text: string; proposed_by: Id }[];
  objection?: string;
  revised: boolean;
  fallback?: boolean;
}

export type OutcomeType =
  | 'full_agreement'
  | 'club_standard'
  | 'paper_standard'
  | 'split_standards'
  | 'expert_consensus'
  | 'no_agreement';

export interface ParallelForum {
  convened_by: Id[];
  clauses: { template: Id; params: Params; text: string }[];
}

export interface Outcome {
  type: OutcomeType;
  passed: boolean;
  final_vote?: VoteResult;
  absent_major: Id[];
  opposing_major: Id[];
  parallel?: ParallelForum;
  annex?: Clause[];
}

export interface Counterfactual {
  delegation: Id;
  /** The single convening option that, if changed, would have brought the delegation to the table. */
  change: Partial<ConveneChoices>;
  /** Plain-English sentence, e.g. "Had export controls stayed off the agenda, the US would have attended." */
  description: string;
}

export interface ReplaySummary {
  choices: ConveneChoices;
  outcome: OutcomeType;
  attended: Id[];
  yes: number;
  no: number;
}

export interface GameState {
  schema: 1;
  id: Id;
  seed: number;
  started_at: number;
  seat: Id;
  phase: Phase;
  track: Track;
  /** 1-based; counts Track 1 cycles. A Track 2 session uses cycle 1 of its own. */
  cycle: number;
  /** 1-based round within the current cycle; 0 before the first player turn. */
  round: number;
  convene_attempts: number;
  choices?: ConveneChoices;
  attendance: AttendanceResult[];
  walkouts: Walkout[];
  trust: Record<Id, number>;
  clauses: Clause[];
  suggestions: Suggestion[];
  messages: Message[];
  soften_log: SoftenEvent[];
  side_payments: { track: Track; cycle: number; delegation: Id; payment: Id }[];
  reports: Report[];
  votes: VoteResult[];
  track2: {
    used: number;
    /** Clauses agreed by the experts; set when a Track 2 vote passes. */
    annex?: Clause[];
    /** Where the game resumes after the Track 2 session. */
    return_to?: 'convene' | 'negotiate';
    /** Track 1 table, saved when the expert channel opens after a failed vote. */
    stash?: {
      choices: ConveneChoices;
      attendance: AttendanceResult[];
      walkouts: Walkout[];
      clauses: Clause[];
      cycle: number;
    };
  };
  parallel?: ParallelForum;
  outcome?: Outcome;
  quiz: { pre?: string[]; post?: string[] };
  /** Phase transitions with wall-clock time, for "where did players spend longest". */
  timeline: { phase: Phase; track: Track; at: number }[];
  /** Summary of the previous run when the player chose "replay". */
  previous?: ReplaySummary;
}
