import { load } from 'js-yaml';
import { z } from 'zod';
import type { ClauseCond, ConfigIssue, ConfigLoadResult, ConveneCond, GameConfig } from './types';
import { conveneSchema, delegationSchema, forumSchema, generalSchema, paymentSchema, quizSchema, rulesSchema, scenarioSchema, tagSchema, templateSchema } from './configSchema';

/** Parse and validate raw configuration without accessing the filesystem. */
export function parseConfig(files: Record<string, string>): ConfigLoadResult {
  const errors: ConfigIssue[] = [];
  const warnings: ConfigIssue[] = [];
  const normalized = Object.fromEntries(Object.entries(files).map(([key, value]) => [key.replace(/\\/g, '/').replace(/^\//, ''), value]));
  function read<T>(file: string, schema: z.ZodType<T>): T | undefined {
    const raw = normalized[file];
    if (raw === undefined) {
      errors.push({ file, path: '', message: 'Add this required configuration file.' });
      return undefined;
    }
    try {
      const result = schema.safeParse(load(raw));
      if (result.success) return result.data;
      errors.push(...result.error.issues.map(issue => ({ file, path: issue.path.reduce<string>((path, key) =>
        typeof key === 'number' ? `${path}[${key}]` : `${path}${path ? '.' : ''}${String(key)}`, ''), message: issue.message })));
    } catch (error) {
      errors.push({ file, path: '', message: `Fix the YAML syntax. ${error instanceof Error ? error.message : String(error)}` });
    }
    return undefined;
  }
  const scenario = read('config/scenario.yaml', scenarioSchema);
  const rules = read('config/rules.yaml', rulesSchema);
  const forums = read('config/forums.yaml', z.array(forumSchema));
  const convene = read('config/convene.yaml', conveneSchema);
  const catalog = read('config/agenda_catalog.yaml', z.array(templateSchema));
  const tags = read('config/argument_tags.yaml', z.array(tagSchema));
  const side_payments = read('config/side_payments.yaml', z.array(paymentSchema));
  const quiz = read('config/quiz.yaml', quizSchema);
  const general = read('config/general.yaml', generalSchema);
  const delegationFiles = Object.keys(normalized).filter(file => /^config\/delegations\/[^/]+\.yaml$/.test(file)).sort();
  const delegations = delegationFiles.flatMap(file => {
    const delegation = read(file, delegationSchema);
    return delegation ? [delegation] : [];
  });
  if (errors.length || !scenario || !rules || !forums || !convene || !catalog || !tags || !side_payments || !quiz || !general) return { ok: false, errors, warnings };
  const prompts = Object.fromEntries(Object.entries(normalized)
    .filter(([file]) => /^config\/prompts\/[^/]+\.md$/.test(file))
    .map(([file, text]) => [file.slice(file.lastIndexOf('/') + 1, -3), text]));
  const config: GameConfig = { scenario, rules, forums, convene, catalog, tags, side_payments, quiz, general, prompts, delegations };
  const delegationFile = new Map(delegations.map((delegation, i) => [delegation.id, delegationFiles[i]]));
  function issue(file: string, path: string, message: string, warning = false): void {
    (warning ? warnings : errors).push({ file, path, message });
  }
  // Entity namespaces may reuse identifiers. Claims and research ids are globally unique.
  function unique(items: { id: string }[], file: string, path = ''): void {
    const seen = new Set<string>();
    items.forEach((item, i) => {
      if (seen.has(item.id)) issue(file, `${path}[${i}].id`, `Choose a unique id. "${item.id}" appears more than once.`);
      seen.add(item.id);
    });
  }
  const knownDelegations = new Set(delegations.map(d => d.id));
  const knownForums = new Set(forums.map(f => f.id));
  const knownTags = new Set(tags.map(t => t.id));
  const knownPayments = new Set(side_payments.map(p => p.id));
  const categories = new Set(catalog.map(c => c.category));
  function reference(value: string, known: Set<string>, file: string, path: string): void {
    if (!known.has(value)) issue(file, path, `"${value}" is unknown. Use an id defined in the corresponding configuration file.`);
  }
  unique(delegations, 'config/delegations');
  unique(forums, 'config/forums.yaml');
  unique(catalog, 'config/agenda_catalog.yaml');
  unique(tags, 'config/argument_tags.yaml');
  unique(side_payments, 'config/side_payments.yaml');
  unique(convene.agenda_scopes, 'config/convene.yaml', 'agenda_scopes');
  unique(convene.formats, 'config/convene.yaml', 'formats');
  unique(quiz.questions, 'config/quiz.yaml', 'questions');
  unique(scenario.seats.map(id => ({ id })), 'config/scenario.yaml', 'seats');
  scenario.seats.forEach((id, i) => reference(id, knownDelegations, 'config/scenario.yaml', `seats[${i}]`));
  delegations.forEach(d => {
    if (!scenario.seats.includes(d.id)) issue(delegationFile.get(d.id)!, 'id', 'Not listed in scenario.seats; appended after the listed seats in file-name order.', true);
  });
  rules.major_powers.forEach((id, i) => reference(id, knownDelegations, 'config/rules.yaml', `major_powers[${i}]`));
  rules.track2.scope.forEach((category, i) => reference(category, categories, 'config/rules.yaml', `track2.scope[${i}]`));
  forums.forEach((forum, i) => forum.members_fixed?.forEach((id, j) => reference(id, knownDelegations, 'config/forums.yaml', `[${i}].members_fixed[${j}]`)));
  convene.agenda_scopes.forEach((scope, i) => scope.categories.forEach((category, j) => reference(category, categories, 'config/convene.yaml', `agenda_scopes[${i}].categories[${j}]`)));
  catalog.forEach((template, i) => {
    for (const match of template.text.matchAll(/\{([^{}]+)\}/g)) {
      if (!Object.hasOwn(template.params, match[1])) issue('config/agenda_catalog.yaml', `[${i}].text`, `Add a parameter named "${match[1]}" or remove its placeholder.`);
    }
  });
  const claimLocations = [
    ...general.claims.map((claim, i) => ({ claim, file: 'config/general.yaml', path: `claims[${i}]` })),
    ...delegations.flatMap(d => d.claims.map((claim, i) => ({ claim, file: delegationFile.get(d.id)!, path: `claims[${i}]` }))),
  ];
  const claimIds = new Set<string>();
  claimLocations.forEach(({ claim, file, path }) => {
    if (claimIds.has(claim.id)) issue(file, `${path}.id`, `Choose a globally unique claim id. "${claim.id}" is duplicated.`);
    claimIds.add(claim.id);
    if (!claim.source.trim()) issue(file, `${path}.source`, 'Add a source citation for this claim.', true);
  });
  const researchIds = new Set<string>();
  for (const [file, research] of [['config/general.yaml', general.research], ...delegations.map(d => [delegationFile.get(d.id)!, d.research] as const)] as const) {
    research.forEach((need, i) => {
      if (researchIds.has(need.id)) issue(file, `research[${i}].id`, `Choose a globally unique research id. "${need.id}" is duplicated.`);
      researchIds.add(need.id);
    });
  }
  function sources(value: unknown, file: string, path: string): void {
    if (Array.isArray(value)) { value.forEach((item, i) => sources(item, file, `${path}[${i}]`)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      const child = path ? `${path}.${key}` : key;
      if (key === 'source_ids' && Array.isArray(item)) item.forEach((id, i) => {
        if (!claimIds.has(id)) issue(file, `${child}[${i}]`, `Add a claim for source id "${id}".`, true);
      });
      else sources(item, file, child);
    }
  }
  function condition(cond: ClauseCond & ConveneCond, file: string, path: string): void {
    for (const key of ['clause', 'clause_present', 'clause_absent'] as const) {
      if (cond[key] !== undefined && !config.catalog.some(c => c.id === cond[key])) issue(file, `${path}.${key}`, `Define clause template "${cond[key]}" in agenda_catalog.yaml.`);
    }
    const template = config.catalog.find(c => c.id === cond.clause);
    if (cond.param !== undefined && template) {
      const param = template.params[cond.param];
      if (!param) issue(file, `${path}.param`, `Use a parameter defined on "${template.id}".`);
      else if (param.type === 'enum') {
        const values = [...(cond.equals !== undefined ? [cond.equals] : []), ...(cond.in ?? [])];
        if (values.some(value => typeof value !== 'string' || !param.values.includes(value))) issue(file, path, 'Choose equals/in values from this enum parameter\'s values.', true);
      }
    }
    if (cond.forum !== undefined) reference(cond.forum, knownForums, file, `${path}.forum`);
    for (const key of ['other_invited', 'other_not_invited'] as const) if (cond[key] !== undefined) reference(cond[key], knownDelegations, file, `${path}.${key}`);
    if (cond.agenda_includes !== undefined && !categories.has(cond.agenda_includes) && !config.catalog.some(c => c.id === cond.agenda_includes)) issue(file, `${path}.agenda_includes`, 'Use a category or clause-template id from agenda_catalog.yaml.');
  }
  delegations.forEach(d => {
    const file = delegationFile.get(d.id)!;
    const voices = new Set(d.voices.map(v => v.id));
    unique(d.voices, file, 'voices');
    unique([...d.red_lines, ...d.must_haves, ...d.walkout_triggers, ...d.attendance.conditions], file, 'rules');
    if (d.lead_voice !== undefined) reference(d.lead_voice, voices, file, 'lead_voice');
    Object.keys(d.attendance.base_willingness).forEach(id => reference(id, knownForums, file, `attendance.base_willingness.${id}`));
    Object.keys(d.side_payment_values).forEach(id => reference(id, knownPayments, file, `side_payment_values.${id}`));
    Object.keys(d.relations).forEach(id => reference(id, knownDelegations, file, `relations.${id}`));
    const groups = { red_lines: d.red_lines, must_haves: d.must_haves, walkout_triggers: d.walkout_triggers, 'attendance.conditions': d.attendance.conditions };
    for (const [group, items] of Object.entries(groups)) items.forEach((item, i) => {
      const path = `${group}[${i}]`;
      condition(item.when, file, `${path}.when`);
      if (!item.source_ids?.length) issue(file, `${path}.source_ids`, 'Add source_ids supporting this rule.', true);
      if ('voice' in item && typeof item.voice === 'string') reference(item.voice, voices, file, `${path}.voice`);
      if ('softenable_by' in item && Array.isArray(item.softenable_by)) item.softenable_by.forEach((id, j) => reference(id, knownTags, file, `${path}.softenable_by[${j}]`));
    });
    sources(d, file, '');
  });
  sources(forums, 'config/forums.yaml', '');
  sources(catalog, 'config/agenda_catalog.yaml', '');
  config.delegations = [
    ...scenario.seats.flatMap(id => delegations.filter(d => d.id === id)),
    ...delegations.filter(d => !scenario.seats.includes(d.id)),
  ];
  config.scenario.seats = config.delegations.map(d => d.id);
  return errors.length ? { ok: false, errors, warnings } : { ok: true, config, warnings };
}

export function bundledConfigFiles(): Record<string, string> {
  const files = import.meta.glob<string>('/config/**/*.{yaml,md}', { query: '?raw', import: 'default', eager: true });
  return Object.fromEntries(Object.entries(files).map(([path, text]) => [path.replace(/\\/g, '/').replace(/^\//, ''), text]));
}

export function loadConfig(overrides: Record<string, string> = {}): ConfigLoadResult {
  return parseConfig({ ...bundledConfigFiles(), ...overrides });
}
