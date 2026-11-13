/**
 * CONTRACT FILE between the UI and everything behind it. Frozen while workers run in parallel.
 *
 * The UI talks to the game only through the hooks in ./context (useGame, usePlatform,
 * useSettings, useData, useConfig). During UI development those hooks are fed by fixtures;
 * after integration they are fed by the real controller. Screens must not import the engine.
 */
import type {
  ConfigIssue,
  ConveneChoices,
  Counterfactual,
  DelegationConfig,
  GameConfig,
  GameState,
  Id,
  OutcomeType,
  Params,
  StancePosition,
} from '../engine/types';
import type { LlmPreset, LlmSettings } from '../llm/types';

// ───────────────────────────────── Game ─────────────────────────────────

export interface DerivedView {
  /** Delegations at the table right now, including the player's seat. */
  present: Id[];
  /** Delegations allowed to vote (subset of present). */
  voters: Id[];
  votes_needed: number;
  quorum_met: boolean;
  /** Rounds in the current cycle (differs between Track 1 and Track 2). */
  rounds_in_cycle: number;
  can_speak: boolean;
  can_request_report: boolean;
  /** False until the report exists and enough clauses are tabled. */
  can_call_vote: boolean;
  can_reconvene: boolean;
  can_start_track2: boolean;
  side_payments_left: number;
  /** Clause templates the player may table under the current agenda scope and track. */
  allowed_templates: Id[];
  /** Forums the player's seat may choose. */
  selectable_forums: Id[];
  /** clause id -> delegation id -> position. Red lines are shown as plain "oppose" until the debrief. */
  stances: Record<Id, Record<Id, StancePosition>>;
  /**
   * How each AI delegation at the table would vote on the draft as it stands: a reading of the room,
   * not a promise. `wavering` means it would vote no today but is close enough to be won over. Empty until enough
   * clauses are tabled to hold a vote, and outside the negotiate and report phases.
   */
  leanings: Record<Id, 'yes' | 'no' | 'wavering'>;
  /** Filled from the outcome phase on. */
  counterfactuals: Counterfactual[];
}

export interface Busy {
  kind: 'convening' | 'responding' | 'reporting' | 'voting';
  /** Delegations currently "typing". */
  who: Id[];
}

export interface GameView {
  state: GameState;
  derived: DerivedView;
  /** Non-null while model calls are in flight; inputs should be disabled. */
  busy: Busy | null;
  /** Last recoverable error, shown as a dismissible banner. */
  error: string | null;
}

export interface GameActions {
  /** Abandon the current game and return to the seat screen. */
  newGame(): void;
  chooseSeat(seat: Id): void;
  /** rolecard -> prequiz (or convene if the quiz is disabled). */
  leaveRoleCard(): void;
  submitQuiz(kind: 'pre' | 'post', answers: string[]): void;
  convene(choices: ConveneChoices): Promise<void>;
  /** attendance -> negotiate. Only when quorum is met. */
  enterRoom(): void;
  /** attendance -> convene, spending one reconvene attempt. */
  reconvene(): void;
  /** Open the expert channel (from a failed attendance, or after a failed vote). */
  startTrack2(): Promise<void>;
  /** End the game from a failed attendance when the player gives up. */
  concede(): void;
  proposeClause(template: Id, params: Params): void;
  editClause(clauseId: Id, params: Params): void;
  withdrawClause(clauseId: Id): void;
  acceptSuggestion(suggestionId: Id): void;
  dismissSuggestion(suggestionId: Id): void;
  /** One player turn: tag the message, pick responders, collect their replies, advance the round. */
  speak(text: string, addressee?: Id): Promise<void>;
  offerSidePayment(delegation: Id, payment: Id): void;
  /** negotiate -> report. */
  requestReport(): Promise<void>;
  /** The player says the report misstates their position; the rapporteur revises once. */
  objectToReport(text: string): Promise<void>;
  /** report -> vote. */
  callVote(): Promise<void>;
  /** vote -> next cycle, back from Track 2, or outcome. */
  continueAfterVote(): void;
  /** outcome -> debrief. */
  openDebrief(): void;
  /** debrief -> postquiz (or done). */
  finishDebrief(): void;
  /** Keep the seat, go back to convening, remember this run for comparison. */
  replay(): void;
  dismissError(): void;
}

// ─────────────────────────────── Public platform ───────────────────────────────

export interface PublishedProposal {
  id: Id;
  game_id: Id;
  kind: 'proposal' | 'annex';
  title: string;
  created_at: number;
  seat: Id;
  outcome: OutcomeType;
  forum: Id;
  forum_name: string;
  clauses: string[];
  attended: Id[];
  absent: Id[];
  votes: { delegation: Id; vote: 'yes' | 'no' }[];
  yes: number;
  no: number;
}

export interface Rating {
  id: Id;
  proposal_id: Id;
  /** One score (1–5) per question in rules.leaderboard.questions. */
  scores: number[];
  comment?: string;
  at: number;
}

export interface RankedProposal extends PublishedProposal {
  n_ratings: number;
  /** Mean per question; empty if unrated. */
  means: number[];
  /** Bayesian average used for ranking. */
  score: number;
  rank: number;
}

export interface PlatformApi {
  proposals: RankedProposal[];
  ratingsFor(proposalId: Id): Rating[];
  rate(proposalId: Id, scores: number[], comment?: string): void;
  removeProposal(proposalId: Id): void;
  removeRating(ratingId: Id): void;
  exportJson(): string;
  importJson(text: string): { added: number; error?: string };
}

// ──────────────────────────────── Settings ────────────────────────────────

export interface AppSettings {
  llm: LlmSettings;
  /** Expo mode: big "Next player" button after each game, admin links hidden. */
  kiosk: boolean;
}

export interface SettingsApi {
  settings: AppSettings;
  presets: LlmPreset[];
  update(patch: Partial<AppSettings>): void;
  updateLlm(patch: Partial<LlmSettings>): void;
  testConnection(): Promise<{ ok: boolean; message: string }>;
}

// ─────────────────────────────── Logs / admin ───────────────────────────────

export interface GameLogSummary {
  id: Id;
  started_at: number;
  seat: Id;
  outcome?: OutcomeType;
  duration_s: number;
  cycles: number;
}

export interface DataApi {
  games: GameLogSummary[];
  /** One row per finished game; columns follow design doc §10. */
  exportGamesCsv(): string;
  /** Full state of every stored game. */
  exportGamesJson(): string;
  /** All claims across delegations, in the course's claims-table format. */
  exportClaimsCsv(): string;
  clearAll(): void;
}

// ───────────────────────────────── Config ─────────────────────────────────

export interface ConfigApi {
  config: GameConfig;
  warnings: ConfigIssue[];
}

// ───────────────────────────── Editing the cast ─────────────────────────────

/**
 * Lets a team member add a delegation or change any delegation's data from the browser.
 * Edits are kept in this browser (localStorage) as YAML text, layered over the bundled /config
 * files, and take effect in the game straight away. To reach the rest of the team an edit has to
 * be exported and committed: the YAML this API produces is exactly the file that belongs in
 * config/delegations/<id>.yaml.
 */
export interface ConfigEditApi {
  /** For every delegation in the loaded config: bundled as shipped, edited in this browser, or added in this browser. */
  status: Record<Id, 'bundled' | 'edited' | 'new'>;
  /** True if this browser holds any local edit. */
  dirty: boolean;
  /** A blank delegation that already validates (willingness for every forum, no rules yet). */
  blank(id: Id, name: string, short: string): DelegationConfig;
  /** Check a draft against the whole config without saving it. Paths are relative to the delegation, e.g. "red_lines[0].when.clause". */
  validate(draft: DelegationConfig): { errors: ConfigIssue[]; warnings: ConfigIssue[] };
  /**
   * Save the draft in this browser and reload the app with it. Nothing is saved if it does not validate.
   * A game in progress is abandoned, because its rules may have changed.
   */
  save(draft: DelegationConfig): { ok: boolean; errors: ConfigIssue[] };
  /** Drop this browser's edits to one delegation; a delegation added here disappears. Reloads the app. */
  revert(id: Id): void;
  /** Drop every local edit. Reloads the app. */
  revertAll(): void;
  /** The file content for config/delegations/<id>.yaml. */
  toYaml(draft: DelegationConfig): string;
  /** Repository path of a delegation's file, e.g. "config/delegations/china.yaml". */
  filePath(id: Id): string;
  /** All local edits as one JSON document, for sending to a teammate or the maintainer. */
  exportPack(): string;
  /** Merge a pack exported elsewhere. Reloads the app when something was applied. */
  importPack(text: string): { applied: number; error?: string };
}
