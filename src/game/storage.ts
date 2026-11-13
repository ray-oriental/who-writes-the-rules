import type { GameConfig, GameState } from '../engine/types';
import { z } from 'zod';

const prefix = 'wwtr:v1:';
const storageKey = (key: string) => key === 'config' ? 'wwtr.config.v1' : prefix + key;

export function read<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  try {
    const result = schema.safeParse(JSON.parse(window.localStorage.getItem(storageKey(key)) ?? 'null'));
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, data: unknown): boolean {
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string): boolean {
  try {
    window.localStorage.removeItem(storageKey(key));
    // Also clear the game key used by exported config-editor integrations.
    if (key === 'game') window.localStorage.removeItem('wwtr.game.v1');
    return true;
  } catch {
    return false;
  }
}

const id = z.string();
const ids = z.array(id);
const params = z.record(id, z.union([z.string(), z.number(), z.array(z.string())]));
const track = z.union([z.literal(1), z.literal(2)]);
const timestamp = z.number().min(0).max(8.64e15);
const phase = z.enum(['seat', 'rolecard', 'prequiz', 'convene', 'attendance', 'negotiate', 'report', 'vote', 'outcome', 'debrief', 'postquiz', 'done']);
const result = z.enum(['full_agreement', 'club_standard', 'paper_standard', 'split_standards', 'expert_consensus', 'no_agreement']);
const round = { cycle: z.number(), round: z.number() };
const text = z.string();
const choices = z.object({ forum: id, agenda_scope: id, format: z.enum(['track1', 'track2']), invited: ids });
const clause = z.object({
  id, template: id, params, text, version: z.number(), proposed_by: id, from_annex: z.boolean().optional(),
  history: z.array(z.object({ ...round, version: z.number(), params, text })),
});
const attendance = z.object({
  delegation: id, status: z.enum(['attend', 'decline', 'excluded']), score: z.number(),
  threshold: z.number(), letter: text.optional(),
  reasons: z.array(z.object({ id, say: text, modifier: z.number().optional(), action: id.optional() })),
});
const walkout = z.object({ ...round, delegation: id, trigger: id, say: text });
const vote = z.object({
  track, cycle: z.number(), passed: z.boolean(), yes: z.number(), no: z.number(), needed: z.number(),
  details: z.array(z.object({
    delegation: id, vote: z.enum(['yes', 'no']), eligible: z.boolean(), score: z.number(), threshold: z.number(),
    red_lines_hit: ids, satisfied: ids, missing: ids, soften: z.number(), side_payment: z.number(), trust: z.number(),
    track2_bonus: z.number(), swing: z.number(), in_swing_band: z.boolean(), statement: text, fallback: z.boolean().optional(),
  })),
});
const parallel = z.object({ convened_by: ids, clauses: z.array(z.object({ template: id, params, text })) });
export const gameSchema = z.object({
  schema: z.literal(1), id, seed: z.number(), started_at: timestamp, seat: id,
  phase, track, ...round, convene_attempts: z.number(),
  choices: choices.optional(), attendance: z.array(attendance), walkouts: z.array(walkout),
  trust: z.record(id, z.number()), clauses: z.array(clause),
  suggestions: z.array(z.object({ id, from: id, template: id, params, text, replaces: id.optional(), note: text.optional() })),
  messages: z.array(z.object({
    id, track, ...round, speaker: id, from_player: z.boolean().optional(), voice: id.optional(), addressed_to: id.optional(),
    text, kind: z.enum(['speech', 'chair', 'system', 'side_payment', 'walkout']), fallback: z.boolean().optional(),
    tags: z.array(z.object({ tag: id, confidence: z.number() })).optional(),
  })),
  soften_log: z.array(z.object({ message_id: id, tag: id, delegation: id, must_have: id, amount: z.number(), track, cycle: z.number() })),
  side_payments: z.array(z.object({ delegation: id, payment: id, track, cycle: z.number() })),
  reports: z.array(z.object({
    track, cycle: z.number(), summary: text, clauses: z.array(z.object({ id, text, proposed_by: id })),
    positions: z.array(z.object({ delegation: id, text })), open_issues: z.array(text), objection: text.optional(),
    revised: z.boolean(), fallback: z.boolean().optional(),
  })),
  votes: z.array(vote), track2: z.object({
    used: z.number(), annex: z.array(clause).optional(), return_to: z.enum(['convene', 'negotiate']).optional(),
    stash: z.object({ choices, attendance: z.array(attendance), walkouts: z.array(walkout), clauses: z.array(clause), cycle: z.number() }).optional(),
  }),
  quiz: z.object({ pre: z.array(text).optional(), post: z.array(text).optional() }),
  timeline: z.array(z.object({ phase, track, at: timestamp })),
  parallel: parallel.optional(),
  outcome: z.object({
    type: result, passed: z.boolean(), final_vote: vote.optional(), absent_major: ids, opposing_major: ids,
    parallel: parallel.optional(), annex: z.array(clause).optional(),
  }).optional(),
  previous: z.object({ choices, outcome: result, attended: ids, yes: z.number(), no: z.number() }).optional(),
}) satisfies z.ZodType<GameState>;

export function loadGame(config: GameConfig, fallback: GameState): GameState {
  const state = read<GameState>('game', gameSchema, fallback);
  if (state.phase === 'seat') return fallback;
  if (!config.delegations.some(delegation => delegation.id === state.seat && delegation.playable)) return fallback;
  if (state.choices && (!config.forums.some(forum => forum.id === state.choices?.forum)
    || !config.convene.agenda_scopes.some(scope => scope.id === state.choices?.agenda_scope))) return fallback;
  if (state.clauses.some(clause => !config.catalog.some(template => template.id === clause.template))) return fallback;
  if (['attendance', 'negotiate', 'report', 'vote'].includes(state.phase) && !state.choices) return fallback;
  if (state.phase === 'report' && !state.reports.some(report => report.track === state.track && report.cycle === state.cycle)) return fallback;
  if (state.phase === 'vote' && !state.votes.length) return fallback;
  if (['outcome', 'debrief', 'postquiz', 'done'].includes(state.phase) && !state.outcome) return fallback;
  return state;
}
