import { dump } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../src/engine';
import type { ConfigLoadResult, GameConfig } from '../../src/engine/types';
import { fixture } from './fixture';

function files(config = fixture()): Record<string, string> {
  const data: Record<string, unknown> = {
    scenario: config.scenario, rules: config.rules, forums: config.forums, convene: config.convene,
    agenda_catalog: config.catalog, argument_tags: config.tags, side_payments: config.side_payments,
    quiz: config.quiz, general: config.general,
  };
  return { ...Object.fromEntries(Object.entries(data).map(([key, value]) => [`config/${key}.yaml`, dump(value)])),
    ...Object.fromEntries(config.delegations.map(d => [`config/delegations/${d.id}.yaml`, dump(d)])),
    'config/prompts/delegate.md': config.prompts.delegate };
}

function errors(result: ConfigLoadResult): string {
  return result.ok ? '' : result.errors.map(e => `${e.file} ${e.path} ${e.message}`).join('\n');
}

describe('configuration parsing', () => {
  it('loads the complete in-memory layout, sorts delegations and preserves raw prompts', () => {
    const config = fixture();
    config.scenario.seats.reverse();
    const result = parseConfig(files(config));
    expect(errors(result)).toBe('');
    expect(result.ok && result.config.delegations.map(d => d.id)).toEqual(['d', 'c', 'b', 'a']);
    expect(result.ok && result.config.prompts.delegate).toBe('Speak as {{delegation}}.');
    expect(result.warnings).toEqual([]);
  });
  it('normalizes leading slashes and Windows separators', () => {
    expect(parseConfig(Object.fromEntries(Object.entries(files()).map(([key, value]) => [`/${key.replaceAll('/', '\\')}`, value]))).ok).toBe(true);
  });
  it('returns missing-file, YAML syntax and schema errors without throwing', () => {
    expect(errors(parseConfig({}))).toContain('required configuration file');
    expect(errors(parseConfig({ ...files(), 'config/rules.yaml': 'rules: [' }))).toContain('YAML syntax');
    expect(errors(parseConfig({ ...files(), 'config/rules.yaml': 'rounds_per_cycle: wrong' }))).toContain('rounds_per_cycle');
  });
  it('defaults omitted lists, maps and internal resolution', () => {
    const input = files();
    const d = { ...fixture().delegations[0] } as Partial<GameConfig['delegations'][number]>;
    for (const key of ['claims', 'research', 'facts', 'voices', 'red_lines', 'must_haves', 'walkout_triggers', 'relations', 'side_payment_values', 'internal_resolution'] as const) delete d[key];
    d.attendance = { ...d.attendance!, conditions: undefined!, base_willingness: undefined! };
    input['config/delegations/a.yaml'] = dump(d);
    const result = parseConfig(input);
    expect(errors(result)).toBe('');
    if (result.ok) {
      expect(result.config.delegations[0].voices).toEqual([]);
      expect(result.config.delegations[0].relations).toEqual({});
      expect(result.config.delegations[0].attendance.conditions).toEqual([]);
      expect(result.config.delegations[0].internal_resolution).toBe('veto_by_any');
    }
  });
  it.each([
    ['duplicate template', (c: GameConfig) => c.catalog.push(c.catalog[0]), 'unique id'],
    ['duplicate claim', (c: GameConfig) => c.delegations[0].claims.push(c.general.claims[0]), 'globally unique claim'],
    ['duplicate research', (c: GameConfig) => { c.general.research = [1, 2].map(() => ({ id: 'R', question: '?', why: 'test', status: 'todo' })); }, 'globally unique research'],
    ['unknown seat', (c: GameConfig) => c.scenario.seats.push('missing'), 'unknown'],
    ['major power', (c: GameConfig) => c.rules.major_powers.push('missing'), 'major_powers'],
    ['fixed forum member', (c: GameConfig) => c.forums[2].members_fixed!.push('missing'), 'members_fixed'],
    ['base willingness', (c: GameConfig) => { c.delegations[0].attendance.base_willingness.missing = 1; }, 'base_willingness'],
    ['clause reference', (c: GameConfig) => { c.delegations[0].red_lines[0].when.clause = 'missing'; }, 'when.clause'],
    ['parameter reference', (c: GameConfig) => { c.delegations[0].red_lines[0].when.param = 'missing'; }, 'when.param'],
    ['tag reference', (c: GameConfig) => c.delegations[0].must_haves[0].softenable_by!.push('missing'), 'softenable_by'],
    ['payment reference', (c: GameConfig) => { c.delegations[0].side_payment_values.missing = 1; }, 'side_payment_values'],
    ['relation reference', (c: GameConfig) => { c.delegations[0].relations.missing = 'test'; }, 'relations'],
    ['voice reference', (c: GameConfig) => { c.delegations[0].red_lines[0].voice = 'missing'; }, 'voice'],
    ['lead voice reference', (c: GameConfig) => { c.delegations[0].lead_voice = 'missing'; }, 'lead_voice'],
    ['agenda category', (c: GameConfig) => c.convene.agenda_scopes[0].categories.push('missing'), 'categories'],
    ['placeholder', (c: GameConfig) => { c.catalog[0].text += ' {missing}'; }, 'placeholder'],
    ['unsupported DSL', (c: GameConfig) => { Object.assign(c.delegations[0].red_lines[0].when, { or: [] }); }, 'Unrecognized'],
    ['incomplete DSL', (c: GameConfig) => { delete c.delegations[0].red_lines[0].when.param; }, 'both clause and param'],
    ['invalid defaults', (c: GameConfig) => { c.catalog[0].params.who = { type: 'enum', values: ['national'], default: 'missing' }; }, 'defaults'],
  ])('rejects %s', (_name, change, message) => {
    const config = fixture();
    change(config);
    expect(errors(parseConfig(files(config)))).toContain(message);
  });
  it('warns about missing citations, empty sources and invalid enum condition values', () => {
    const config = fixture();
    config.general.claims[0].source = '';
    config.delegations[0].red_lines[0].source_ids = ['C-MISSING'];
    config.delegations[0].must_haves[0].source_ids = [];
    config.delegations[0].red_lines[0].when.equals = 'missing';
    const result = parseConfig(files(config));
    expect(result.ok).toBe(true);
    expect(result.warnings.map(w => w.message).join('\n')).toMatch(/source citation/);
    expect(result.warnings).toHaveLength(4);
  });
});
