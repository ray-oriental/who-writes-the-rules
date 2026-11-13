import { z } from 'zod';
import type { ClauseCond } from './types';

const ids = z.array(z.string()).default([]);
const strings = z.record(z.string(), z.string()).default({});
const numbers = z.record(z.string(), z.number()).default({});
const source = { source_ids: ids };
const scalar = z.union([z.string(), z.number()]);
const clauseShape = {
  clause: z.string().optional(), param: z.string().optional(), equals: scalar.optional(),
  in: z.array(scalar).optional(), not_in: z.array(scalar).optional(), gte: z.number().optional(),
  lte: z.number().optional(), includes: z.string().optional(), clause_present: z.string().optional(), clause_absent: z.string().optional(),
};
const conveneShape = {
  agenda_includes: z.string().optional(), forum: z.string().optional(), forum_exclusive: z.boolean().optional(),
  not_invited: z.boolean().optional(), format: z.enum(['track1', 'track2']).optional(), annex_exists: z.boolean().optional(),
  other_invited: z.string().optional(), other_not_invited: z.string().optional(),
};
function validClause(cond: ClauseCond): boolean {
  const comparison = ['equals', 'in', 'not_in', 'gte', 'lte', 'includes'].some(key => Object.hasOwn(cond, key));
  return (!comparison || !!cond.param) && (!cond.param || !!cond.clause);
}
export const clauseCondSchema = z.strictObject(clauseShape).refine(validClause, 'A parameter comparison needs both clause and param.');
export const conveneCondSchema = z.strictObject(conveneShape);
export const walkoutCondSchema = z.strictObject({ ...clauseShape, ...conveneShape }).refine(validClause, 'A parameter comparison needs both clause and param.');
export const claimSchema = z.strictObject({
  id: z.string(), claim: z.string(), used_in: ids, source: z.string(), url: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']), notes: z.string().optional(),
});
export const researchSchema = z.strictObject({
  id: z.string(), question: z.string(), why: z.string(), status: z.enum(['todo', 'in_progress', 'found', 'verified']),
  owner: z.string().default(''), leads: ids, notes: z.string().optional(), claim_ids: ids,
});
export const generalSchema = z.strictObject({ claims: z.array(claimSchema).default([]), research: z.array(researchSchema).default([]) });
export const scenarioSchema = z.strictObject({
  title: z.string(), tagline: z.string(), intro: z.string(), ai_language: z.string(), repo_url: z.string(),
  repo_branch: z.string(), chair_name: z.string(), player_role: z.string(), seats: z.array(z.string()).min(1),
});
const positiveInt = z.number().int().positive();
const nonnegativeInt = z.number().int().nonnegative();
export const rulesSchema = z.strictObject({
  rounds_per_cycle: positiveInt, max_cycles: positiveInt, min_responders_per_round: nonnegativeInt,
  max_responders_per_round: nonnegativeInt, allow_early_report_after: nonnegativeInt, min_clauses_to_vote: positiveInt,
  voting_mode: z.enum(['all_delegations', 'states_only']),
  pass_rule: z.strictObject({ type: z.enum(['two_thirds', 'iso_double']), negative_cap: z.number().min(0).max(1) }),
  quorum: positiveInt, major_powers: ids, reconvene_attempts: nonnegativeInt, parallel_threshold: z.number().min(0).max(1),
  trust: z.strictObject({ min: z.number(), max: z.number(), excluded: z.number(), exclusive_forum_nonmember: z.number() }),
  track2: z.strictObject({ enabled: z.boolean(), uses_per_game: nonnegativeInt, rounds: positiveInt, scope: ids, bonus: z.number() }),
  swing_band: z.number().nonnegative(), tagger_confidence_min: z.number().min(0).max(1), side_payments_per_cycle: nonnegativeInt,
  expo: z.strictObject({ time_limit_minutes: z.number().positive() }),
  leaderboard: z.strictObject({ prior_votes: z.number().nonnegative(), questions: ids }),
}).superRefine((rules, ctx) => {
  if (rules.min_responders_per_round > rules.max_responders_per_round) ctx.addIssue({ code: 'custom', path: ['max_responders_per_round'], message: 'Set the maximum responders at least as high as the minimum.' });
  if (rules.trust.min > rules.trust.max) ctx.addIssue({ code: 'custom', path: ['trust', 'max'], message: 'Set maximum trust at least as high as minimum trust.' });
});
export const forumSchema = z.strictObject({ id: z.string(), name: z.string(), description: z.string(), exclusive: z.boolean(),
  binding_level: z.enum(['low', 'medium', 'high']), members_fixed: z.array(z.string()).optional(), ...source });
export const conveneSchema = z.strictObject({
  agenda_scopes: z.array(z.strictObject({ id: z.string(), label: z.string(), description: z.string(), categories: ids })),
  formats: z.array(z.strictObject({ id: z.enum(['track1', 'track2']), label: z.string(), description: z.string() })),
});
export const paramSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('number'), label: z.string().optional(), min: z.number(), max: z.number(), step: z.number().positive().optional(), default: z.number(), unit: z.string().optional() }),
  z.strictObject({ type: z.literal('enum'), label: z.string().optional(), values: z.array(z.string()).min(1), default: z.string().optional(), value_labels: strings }),
  z.strictObject({ type: z.literal('multi'), label: z.string().optional(), values: z.array(z.string()), default: z.array(z.string()).optional(), value_labels: strings }),
]).superRefine((spec, ctx) => {
  if (spec.type === 'number') {
    if (spec.min > spec.max || spec.default < spec.min || spec.default > spec.max) ctx.addIssue({ code: 'custom', message: 'Keep min <= default <= max.' });
  } else {
    const values = spec.type === 'enum' ? (spec.default === undefined ? [] : [spec.default]) : spec.default ?? [];
    if (values.some(value => !spec.values.includes(value))) ctx.addIssue({ code: 'custom', path: ['default'], message: 'Choose defaults from values.' });
  }
});
export const templateSchema = z.strictObject({ id: z.string(), category: z.string(), label: z.string(), description: z.string(), text: z.string(), params: z.record(z.string(), paramSchema).default({}), ...source });
export const tagSchema = z.strictObject({ id: z.string(), label: z.string(), description: z.string(), examples: ids });
export const paymentSchema = z.strictObject({ id: z.string(), label: z.string(), description: z.string() });
export const quizSchema = z.strictObject({ enabled: z.boolean(), questions: z.array(z.strictObject({ id: z.string(), text: z.string() })).default([]) });
export const delegationSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  short: z.string(),
  type: z.enum(['state', 'regional', 'firm', 'expert_body']),
  playable: z.boolean(),
  difficulty: z.enum(['easier', 'medium', 'harder']),
  owner: z.string().default(''),
  summary: z.string(),
  mandate: z.string(),
  facts: z.array(z.strictObject({ text: z.string(), ...source })).default([]),
  relations: strings,
  voices: z.array(z.strictObject({ id: z.string(), label: z.string(), priorities: ids })).default([]),
  internal_resolution: z.enum(['veto_by_any', 'lead_voice', 'average']).default('veto_by_any'),
  lead_voice: z.string().optional(),
  attendance: z.strictObject({
    attend_threshold: z.number(),
    base_willingness: numbers,
    conditions: z.array(z.strictObject({
      id: z.string(),
      when: conveneCondSchema,
      modifier: z.number().optional(),
      action: z.enum(['refuse', 'consider_parallel_forum']).optional(),
      say: z.string(),
      ...source,
    })).default([]),
    parallel_forum_propensity: z.number().min(0).max(1),
    track2_willingness: z.number(),
  }),
  red_lines: z.array(z.strictObject({
    id: z.string(),
    label: z.string(),
    when: clauseCondSchema,
    voice: z.string().optional(),
    say: z.string(),
    ...source,
  })).default([]),
  must_haves: z.array(z.strictObject({
    id: z.string(),
    label: z.string(),
    when: clauseCondSchema,
    weight: z.number().nonnegative(),
    voice: z.string().optional(),
    softenable_by: ids,
    soften_amount: z.number().nonnegative().optional(),
    max_soften: z.number().nonnegative().optional(),
    say: z.string(),
    ...source,
  })).default([]),
  vote_threshold: z.number(),
  side_payment_values: numbers,
  trust_initial: z.number(),
  walkout_triggers: z.array(z.strictObject({
    id: z.string(),
    when: walkoutCondSchema,
    say: z.string(),
    ...source,
  })).default([]),
  brief: z.string(),
  style: z.string(),
  claims: z.array(claimSchema).default([]),
  research: z.array(researchSchema).default([]),
});
