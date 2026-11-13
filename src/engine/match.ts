import type { Clause, ClauseCond, ConveneChoices, ConveneCond, GameConfig } from './types';

export interface ConveneContext {
  config: GameConfig;
  choices: ConveneChoices;
  delegation: string;
  seat: string;
  annex_exists: boolean;
}

export function hasClauseKeys(cond: ClauseCond): boolean {
  return ['clause', 'param', 'equals', 'in', 'not_in', 'gte', 'lte', 'includes', 'clause_present', 'clause_absent']
    .some(key => Object.hasOwn(cond, key));
}

export function matchClauseCond(cond: ClauseCond, clauses: Clause[]): boolean {
  if (cond.clause_present !== undefined && !clauses.some(c => c.template === cond.clause_present)) return false;
  if (cond.clause_absent !== undefined && clauses.some(c => c.template === cond.clause_absent)) return false;
  const clause = clauses.find(c => c.template === cond.clause);
  if (cond.clause !== undefined && !clause) return false;
  if (cond.param === undefined) return !['equals', 'in', 'not_in', 'gte', 'lte', 'includes'].some(key => Object.hasOwn(cond, key));
  const value = clause?.params[cond.param];
  if (value === undefined) return false;
  if (cond.equals !== undefined && value !== cond.equals) return false;
  if (cond.in !== undefined && !cond.in.some(item => item === value)) return false;
  if (cond.not_in !== undefined && cond.not_in.some(item => item === value)) return false;
  if (cond.gte !== undefined && (typeof value !== 'number' || value < cond.gte)) return false;
  if (cond.lte !== undefined && (typeof value !== 'number' || value > cond.lte)) return false;
  if (cond.includes !== undefined && (!Array.isArray(value) || !value.includes(cond.includes))) return false;
  return true;
}

export function matchConveneCond(cond: ConveneCond, ctx: ConveneContext): boolean {
  const { config, choices } = ctx;
  const invited = (id: string) => id === ctx.seat || choices.invited.includes(id);
  const forum = config.forums.find(f => f.id === choices.forum);
  const category = config.catalog.find(c => c.id === cond.agenda_includes)?.category ?? cond.agenda_includes;
  const scope = config.convene.agenda_scopes.find(a => a.id === choices.agenda_scope)?.categories ?? [];
  const categories = choices.format === 'track2' ? scope.filter(item => config.rules.track2.scope.includes(item)) : scope;
  return (cond.agenda_includes === undefined || categories.includes(category!))
    && (cond.forum === undefined || cond.forum === choices.forum)
    && (cond.forum_exclusive === undefined || cond.forum_exclusive === forum?.exclusive)
    && (cond.not_invited === undefined || cond.not_invited === !invited(ctx.delegation))
    && (cond.format === undefined || cond.format === choices.format)
    && (cond.annex_exists === undefined || cond.annex_exists === ctx.annex_exists)
    && (cond.other_invited === undefined || invited(cond.other_invited))
    && (cond.other_not_invited === undefined || !invited(cond.other_not_invited));
}
