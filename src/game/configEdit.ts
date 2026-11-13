import { dump, load } from 'js-yaml';
import { z } from 'zod';
import { bundledConfigFiles, parseConfig } from '../engine/loadConfig';
import { delegationSchema } from '../engine/configSchema';
import type { ConfigIssue, DelegationConfig, GameConfig } from '../engine/types';
import type { ConfigEditApi } from './api';
import { read, remove, save } from './storage';

const validId = /^[a-z][a-z0-9_]{1,30}$/;
const validPath = /^config\/delegations\/[a-z][a-z0-9_]{1,30}\.yaml$/;
const packSchema = z.strictObject({
  version: z.literal(1),
  files: z.record(z.string().regex(validPath), z.string()),
});
const emptyPack = { version: 1 as const, files: {} as Record<string, string> };

export function readConfigOverrides(): Record<string, string> {
  return read('config', packSchema, emptyPack).files;
}

function reload(): void {
  window.location.reload();
}

export function discardLocalConfig(): void {
  if (remove('config') && remove('game')) reload();
}

export const filePath = (id: string): string => `config/delegations/${id}.yaml`;

const keyOrder: (keyof DelegationConfig)[] = [
  'id', 'name', 'short', 'type', 'playable', 'difficulty', 'owner', 'summary', 'mandate',
  'facts', 'relations', 'voices', 'internal_resolution', 'lead_voice', 'attendance',
  'red_lines', 'must_haves', 'vote_threshold', 'side_payment_values', 'trust_initial',
  'walkout_triggers', 'brief', 'style', 'claims', 'research',
];

/** Omitted optional collections regain their defaults when parsed by the config schema. */
function omitEmptyOptionals(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitEmptyOptionals);
  if (!value || typeof value !== 'object') return value;
  const optional = new Set(['owner', 'lead_voice', 'voice', 'url', 'notes', 'source_ids', 'softenable_by', 'leads', 'claim_ids']);
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => item !== undefined
    && !(optional.has(key) && (item === '' || Array.isArray(item) && item.length === 0)))
    .map(([key, item]) => [key, omitEmptyOptionals(item)]));
}

export function toYaml(draft: DelegationConfig): string {
  if (!validId.test(draft.id)) throw new Error('Use 2–31 lowercase letters, digits or underscores, starting with a letter.');
  const ordered = Object.fromEntries(keyOrder.map(key => [key, draft[key]]));
  return `# Edited in the delegation editor. Commit this file as ${filePath(draft.id)}\n`
    + dump(omitEmptyOptionals(ordered), { lineWidth: 100, noRefs: true });
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

const issueKey = (issue: ConfigIssue) => JSON.stringify(issue);
const storageError = 'Browser storage is unavailable or full. No config changes were applied.';

export function createConfigEdit(config: GameConfig): ConfigEditApi {
  const bundled = bundledConfigFiles();
  const originalIds = new WeakMap<object, string>(config.delegations.map(d => [d, d.id]));

  function validate(draft: DelegationConfig): ReturnType<ConfigEditApi['validate']> {
    const file = filePath(draft?.id ?? '');
    try {
      if (!validId.test(draft.id)) return { errors: [{ file, path: 'id', message: 'Use 2–31 lowercase letters, digits or underscores, starting with a letter.' }], warnings: [] };
      const original = originalIds.get(draft);
      if (original && original !== draft.id) return { errors: [{ file, path: 'id', message: 'An existing delegation id cannot be changed.' }], warnings: [] };
      const overrides = readConfigOverrides();
      const before = parseConfig({ ...bundled, ...overrides });
      const after = parseConfig({ ...bundled, ...overrides, [file]: toYaml(draft) });
      const oldErrors = new Set((before.ok ? [] : before.errors).map(issueKey));
      const oldWarnings = new Set(before.warnings.map(issueKey));
      return {
        errors: (after.ok ? [] : after.errors).filter(issue => issue.file === file || !oldErrors.has(issueKey(issue))),
        warnings: after.warnings.filter(issue => issue.file === file || !oldWarnings.has(issueKey(issue))),
      };
    } catch (error) {
      return { errors: [{ file, path: '', message: error instanceof Error ? error.message : 'Unable to validate this delegation.' }], warnings: [] };
    }
  }

  function store(files: Record<string, string>): boolean {
    // The active game must be cleared before the next load uses different rules.
    if (!remove('game')) return false;
    if (Object.keys(files).length) return save('config', { version: 1, files });
    return remove('config');
  }

  return {
    get dirty() { return Object.keys(readConfigOverrides()).length > 0; },
    get status() {
      const overrides = readConfigOverrides();
      return Object.fromEntries(config.delegations.map((d): [string, 'bundled' | 'edited' | 'new'] => {
        const file = filePath(d.id);
        if (!Object.hasOwn(bundled, file)) return [d.id, 'new'];
        const base = delegationSchema.parse(load(bundled[file]));
        const local = Object.hasOwn(overrides, file) ? delegationSchema.safeParse(load(overrides[file])) : undefined;
        return [d.id, local?.success && canonical(local.data) !== canonical(base) ? 'edited' : 'bundled'];
      }));
    },
    blank(id, name, short) {
      const draft: DelegationConfig = {
        id, name, short, type: 'state', playable: false, difficulty: 'medium', owner: '',
        summary: 'Describe this delegation in one sentence for the seat card.',
        mandate: 'Describe what this delegation was sent to achieve.',
        facts: [], relations: {}, voices: [], internal_resolution: 'veto_by_any',
        attendance: {
          attend_threshold: 3, base_willingness: Object.fromEntries(config.forums.map(forum => [forum.id, 3])),
          conditions: [], parallel_forum_propensity: 0, track2_willingness: 4,
        },
        red_lines: [], must_haves: [], vote_threshold: 0, side_payment_values: {}, trust_initial: 0,
        walkout_triggers: [], brief: 'Describe the position, usable facts, and limits for the AI delegate.',
        style: 'Describe the tone and speaking style of this delegation.', claims: [], research: [],
      };
      return draft;
    },
    validate,
    save(draft) {
      const checked = validate(draft);
      if (checked.errors.length) return { ok: false, errors: checked.errors };
      if (!store({ ...readConfigOverrides(), [filePath(draft.id)]: toYaml(draft) })) {
        return { ok: false, errors: [{ file: filePath(draft.id), path: '', message: storageError }] };
      }
      reload();
      return { ok: true, errors: [] };
    },
    revert(id) {
      const files = { ...readConfigOverrides() };
      delete files[filePath(id)];
      if (store(files)) reload();
    },
    revertAll: discardLocalConfig,
    toYaml, filePath,
    exportPack: () => JSON.stringify({ version: 1, files: readConfigOverrides() }, null, 2),
    importPack(text) {
      try {
        const result = packSchema.safeParse(JSON.parse(text));
        if (!result.success) {
          const issue = result.error.issues[0];
          return { applied: 0, error: `Invalid config pack at ${issue.path.join('.')}: ${issue.message}` };
        }
        const files = result.data.files;
        const entries = Object.entries(files);
        if (!entries.length) return { applied: 0 };
        for (const [file, yaml] of entries) {
          let raw: unknown;
          try { raw = load(yaml); } catch (error) {
            return { applied: 0, error: `${file}: ${error instanceof Error ? error.message : 'Invalid YAML.'}` };
          }
          const parsed = delegationSchema.safeParse(raw);
          if (!parsed.success) return { applied: 0, error: `${file}: ${parsed.error.message}` };
          if (filePath(parsed.data.id) !== file) return { applied: 0, error: `${file}: The delegation id must match its file name. Existing ids are fixed.` };
        }
        const merged = { ...readConfigOverrides(), ...files };
        const checked = parseConfig({ ...bundled, ...merged });
        if (!checked.ok) return { applied: 0, error: checked.errors.map(issue => `${issue.file} ${issue.path}: ${issue.message}`).join('\n') };
        if (!store(merged)) return { applied: 0, error: storageError };
        reload();
        return { applied: entries.length };
      } catch (error) {
        return { applied: 0, error: `Invalid config pack: ${error instanceof Error ? error.message : 'Unable to import files.'}` };
      }
    },
  };
}
