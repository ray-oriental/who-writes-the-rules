import { dump, load } from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bundledConfigFiles, chooseSeat, createGame, loadConfig, normalizeChoices, parseConfig } from '../src/engine';
import { delegationSchema } from '../src/engine/configSchema';
import type { GameConfig } from '../src/engine/types';
import { createConfigEdit, discardLocalConfig, readConfigOverrides } from '../src/game/configEdit';

function bundled(): GameConfig {
  const loaded = loadConfig();
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  return loaded.config;
}

describe('browser delegation editing', () => {
  let values: Map<string, string>;
  let reload: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    values = new Map();
    reload = vi.fn();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); },
      },
      location: { reload },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('layers normalized overrides and reports broken YAML without throwing', () => {
    const files = bundledConfigFiles();
    expect(Object.keys(files).every(path => path.startsWith('config/') && !path.includes('\\'))).toBe(true);
    const changed = { ...bundled().delegations[0], summary: 'A local summary.' };
    const result = loadConfig({ [`config/delegations/${changed.id}.yaml`]: dump(changed) });
    expect(result.ok && result.config.delegations[0].summary).toBe('A local summary.');
    const broken = loadConfig({ 'config/delegations/china.yaml': 'invalid: [' });
    expect(broken.ok).toBe(false);
    expect(!broken.ok && broken.errors[0].file).toBe('config/delegations/china.yaml');
  });

  it('creates a valid blank and round-trips every shipped delegation', () => {
    const config = bundled();
    const editor = createConfigEdit(config);
    const blank = editor.blank('new_state', 'New state', 'NS');
    expect(editor.validate(blank).errors).toEqual([]);
    expect(blank.playable).toBe(false);
    expect(blank.attendance.base_willingness).toEqual(Object.fromEntries(config.forums.map(f => [f.id, 3])));
    for (const delegation of [...config.delegations, blank]) {
      const yaml = editor.toYaml(delegation);
      expect(yaml.split('\n')[0]).toBe(`# Edited in the delegation editor. Commit this file as ${editor.filePath(delegation.id)}`);
      expect(delegationSchema.parse(load(yaml))).toEqual(delegation);
      expect(yaml).not.toMatch(/^owner:|^lead_voice: $|&ref_|\*ref_/m);
    }
    const raw = load(editor.toYaml(blank)) as Record<string, unknown>;
    expect(Object.keys(raw)).toEqual([
      'id', 'name', 'short', 'type', 'playable', 'difficulty', 'summary', 'mandate', 'facts',
      'relations', 'voices', 'internal_resolution', 'attendance', 'red_lines', 'must_haves',
      'vote_threshold', 'side_payment_values', 'trust_initial', 'walkout_triggers', 'brief', 'style', 'claims', 'research',
    ]);
  });

  it('appends additional files in file-name order and makes playable additions selectable and invited', () => {
    const config = bundled();
    const editor = createConfigEdit(config);
    const a = { ...editor.blank('alpha', 'Alpha', 'AL'), playable: true };
    const z = editor.blank('zulu', 'Zulu', 'ZU');
    const loaded = loadConfig({ [editor.filePath(z.id)]: editor.toYaml(z), [editor.filePath(a.id)]: editor.toYaml(a) });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.config.scenario.seats).toEqual([...config.scenario.seats, 'alpha', 'zulu']);
    expect(loaded.config.delegations.map(d => d.id)).toEqual(loaded.config.scenario.seats);
    expect(loaded.warnings.filter(w => w.message.includes('scenario.seats'))).toHaveLength(2);
    const game = chooseSeat(loaded.config, createGame(loaded.config, { id: 'test', seed: 1, now: 0 }), 'alpha', 1);
    expect(game.seat).toBe('alpha');
    expect(normalizeChoices(loaded.config, game, {
      forum: 'un_multilateral', agenda_scope: config.convene.agenda_scopes[0].id, format: 'track1', invited: ['zulu'],
    })?.invited).toContain('zulu');
    const files = bundledConfigFiles();
    delete files['config/delegations/china.yaml'];
    expect(parseConfig(files).ok).toBe(false);
  });

  it('reports clause and schema errors at relative bracket paths without storing anything', () => {
    const config = bundled();
    const editor = createConfigEdit(config);
    const draft = structuredClone(config.delegations[0]);
    draft.red_lines[0].when.clause = 'unknown_clause';
    expect(editor.validate(draft).errors).toContainEqual(expect.objectContaining({ path: 'red_lines[0].when.clause' }));
    expect(editor.save(draft).ok).toBe(false);
    expect(readConfigOverrides()).toEqual({});
    expect(reload).not.toHaveBeenCalled();
    draft.red_lines[0].label = undefined!;
    expect(editor.validate(draft).errors).toContainEqual(expect.objectContaining({ path: 'red_lines[0].label' }));
    expect(editor.validate(null!).errors).toHaveLength(1);
    expect(editor.validate({ ...draft, id: '../escape' }).errors[0].path).toBe('id');
  });

  it('includes cross-file errors caused by a draft', () => {
    const config = bundled();
    const editor = createConfigEdit(config);
    const draft = structuredClone(config.delegations[0]);
    draft.claims.push({ ...config.delegations[1].claims[0] });
    expect(editor.validate(draft).errors.some(issue => issue.message.includes('globally unique claim'))).toBe(true);
  });

  it('compares parsed content for status and saves only browser overrides, clearing both game keys', () => {
    const config = bundled();
    const editor = createConfigEdit(config);
    expect(Object.values(editor.status).every(status => status === 'bundled')).toBe(true);
    const draft = structuredClone(config.delegations[0]);
    values.set('wwtr.config.v1', JSON.stringify({ version: 1, files: { [editor.filePath(draft.id)]: `# A comment\n${dump(draft)}` } }));
    expect(editor.status[draft.id]).toBe('bundled');
    draft.summary = 'Changed in this browser.';
    values.set('wwtr:v1:game', 'old game');
    values.set('wwtr.game.v1', 'old game');
    expect(editor.save(draft)).toEqual({ ok: true, errors: [] });
    expect(values.has('wwtr:v1:game')).toBe(false);
    expect(values.has('wwtr.game.v1')).toBe(false);
    expect(editor.status[draft.id]).toBe('edited');
    expect(editor.dirty).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    const added = editor.blank('new_state', 'New state', 'NS');
    expect(editor.save(added).ok).toBe(true);
    const loaded = loadConfig(readConfigOverrides());
    expect(loaded.ok && createConfigEdit(loaded.config).status.new_state).toBe('new');
  });

  it('rejects foreign paths, invalid YAML, mismatched ids and invalid rules atomically', () => {
    const editor = createConfigEdit(bundled());
    const draft = editor.blank('new_state', 'New state', 'NS');
    const valid = { [editor.filePath(draft.id)]: editor.toYaml(draft) };
    for (const bad of [
      { '../outside.yaml': 'x' }, { 'config/scenario.yaml': 'x' },
      { 'config/delegations/invalid.yaml': 'oops: [' },
      { 'config/delegations/other.yaml': editor.toYaml(draft) },
      { [editor.filePath(draft.id)]: editor.toYaml({ ...draft, relations: { missing: 'Unknown relation.' } }) },
    ]) {
      const result = editor.importPack(JSON.stringify({ version: 1, files: { ...valid, ...bad } }));
      expect(result.applied).toBe(0);
      expect(result.error).toContain(Object.keys(bad)[0]);
      expect(readConfigOverrides()).toEqual({});
      expect(reload).not.toHaveBeenCalled();
    }
    for (const invalid of ['null', '{}', '{', '{"version":2,"files":{}}', '{"version":1,"files":{},"extra":1}']) {
      expect(editor.importPack(invalid).applied).toBe(0);
    }
  });

  it('merges valid packs, exports them unchanged, and supports revert and recovery', () => {
    const editor = createConfigEdit(bundled());
    const draft = editor.blank('new_state', 'New state', 'NS');
    const pack = { version: 1, files: { [editor.filePath(draft.id)]: editor.toYaml(draft) } };
    expect(editor.importPack(JSON.stringify(pack))).toEqual({ applied: 1 });
    expect(JSON.parse(editor.exportPack())).toEqual(pack);
    const china = bundled().delegations[0];
    expect(editor.save({ ...china, summary: 'A changed summary.' }).ok).toBe(true);
    editor.revert(draft.id);
    expect(Object.keys(readConfigOverrides())).toEqual([editor.filePath(china.id)]);
    editor.revertAll();
    expect(editor.dirty).toBe(false);
    values.set('wwtr.config.v1', JSON.stringify(pack));
    values.set('wwtr:v1:game', 'old game');
    discardLocalConfig();
    expect(values.has('wwtr.config.v1')).toBe(false);
    expect(values.has('wwtr:v1:game')).toBe(false);
  });

  it('rejects changed ids on existing delegation objects', () => {
    const config = bundled();
    const editor = createConfigEdit(config);
    config.delegations[0].id = 'renamed';
    expect(editor.save(config.delegations[0]).errors[0].path).toBe('id');
    expect(readConfigOverrides()).toEqual({});
  });

  it('handles unavailable storage without throwing or reloading', () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('Storage denied.'); }, location: { reload } });
    const editor = createConfigEdit(bundled());
    const draft = editor.blank('new_state', 'New state', 'NS');
    expect(editor.dirty).toBe(false);
    expect(editor.save(draft).ok).toBe(false);
    expect(editor.importPack(JSON.stringify({ version: 1, files: { [editor.filePath(draft.id)]: editor.toYaml(draft) } })).applied).toBe(0);
    editor.revertAll();
    expect(reload).not.toHaveBeenCalled();
  });
});
