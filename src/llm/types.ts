/**
 * CONTRACT FILE for the LLM layer. Frozen while workers run in parallel.
 *
 * The model never decides rules. The engine computes stances, votes and attendance;
 * the roles below only put those decisions into words (plus two narrow judgement calls:
 * tagging the player's argument and a ±1 nudge inside the swing band).
 */
import type { GameConfig, Id, Message, Params, StancePosition, TagHit, Track } from '../engine/types';

export type LlmMode = 'mock' | 'direct' | 'proxy';

export interface LlmSettings {
  mode: LlmMode;
  /** Preset id, or "custom". */
  preset: string;
  /** OpenAI-compatible base URL, e.g. "https://api.deepseek.com/v1". Used in direct mode. */
  base_url: string;
  model: string;
  /** Direct mode only. Stored in this browser's localStorage and nowhere else. */
  api_key: string;
  /** Send response_format: {type: "json_object"} when the endpoint supports it. */
  json_mode: boolean;
  /** Proxy mode: URL of tools/llm-proxy.mjs, default "http://127.0.0.1:8787/v1". */
  proxy_url: string;
  timeout_ms: number;
}

export interface LlmPreset {
  id: string;
  label: string;
  base_url: string;
  model: string;
  json_mode: boolean;
  note?: string;
}

/** Every role result says whether the model answered or a template stood in for it. */
export type WithMeta<T> = T & { fallback: boolean };

export interface ClauseBrief {
  id: Id;
  text: string;
  /** What the engine decided this delegation thinks of the clause. */
  position: StancePosition | 'red_line';
  /** The `say` sentence of the red line or must-have behind the position, if any. */
  reason?: string;
}

export interface DelegateInput {
  delegation: Id;
  voice?: Id;
  track: Track;
  cycle: number;
  round: number;
  /** The player's latest message. */
  player_text: string;
  addressed: boolean;
  clauses: ClauseBrief[];
  /** Must-haves not yet met: label + say. */
  missing: { label: string; say: string }[];
  /** Labels of must-haves the player's arguments have softened so far. */
  softened: string[];
  /** Last few messages of the transcript, oldest first. */
  recent: Message[];
  /** Templates this delegation may propose an amendment from (already limited to the agenda scope). */
  amendable_templates: Id[];
}

export interface DelegateOutput {
  speech: string;
  amendment?: { template: Id; params: Params; replaces?: Id; note?: string };
}

export interface TaggerInput {
  player_text: string;
}

export interface RapporteurInput {
  track: Track;
  cycle: number;
  /** Messages of this cycle, oldest first. */
  transcript: Message[];
  clauses: { id: Id; text: string; proposed_by: Id }[];
  /** Engine-computed position of each present delegation, in one line. */
  positions: { delegation: Id; supports: string[]; opposes: string[] }[];
  /** Set when the player objected to the first draft; the rapporteur revises once. */
  objection?: string;
  previous_summary?: string;
}

export interface RapporteurOutput {
  summary: string;
  positions: { delegation: Id; text: string }[];
  open_issues: string[];
}

export interface DeclineLetterInput {
  delegation: Id;
  status: 'decline' | 'excluded';
  forum_name: string;
  /** `say` sentences of the conditions that fired. */
  reasons: string[];
}

export interface VoteStatementInput {
  delegation: Id;
  vote: 'yes' | 'no';
  /** `say` sentences of red lines crossed. */
  red_lines: string[];
  /** Labels of the must-haves the text meets (noun phrases). */
  satisfied: string[];
  /** `say` sentences of the must-haves the text does not meet. */
  missing: string[];
  in_swing_band: boolean;
  /** Messages of this cycle, oldest first. */
  transcript: Message[];
}

export interface VoteStatementOutput {
  statement: string;
  /** Honoured by the engine only inside the swing band. */
  adjust: -1 | 0 | 1;
}

export interface LlmRoles {
  delegate(input: DelegateInput): Promise<WithMeta<DelegateOutput>>;
  tagger(input: TaggerInput): Promise<WithMeta<{ tags: TagHit[] }>>;
  rapporteur(input: RapporteurInput): Promise<WithMeta<RapporteurOutput>>;
  declineLetter(input: DeclineLetterInput): Promise<WithMeta<{ letter: string }>>;
  voteStatement(input: VoteStatementInput): Promise<WithMeta<VoteStatementOutput>>;
}

/**
 * Implemented in src/llm/index.ts:
 *
 *   export const DEFAULT_LLM_SETTINGS: LlmSettings;
 *   export const LLM_PRESETS: LlmPreset[];
 *   export function createLlmRoles(config: GameConfig, getSettings: () => LlmSettings): LlmRoles;
 *   export function testConnection(settings: LlmSettings): Promise<{ ok: boolean; message: string }>;
 */
export type CreateLlmRoles = (config: GameConfig, getSettings: () => LlmSettings) => LlmRoles;
