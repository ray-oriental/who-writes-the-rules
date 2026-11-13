import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve('tools/apply-config-pack.mjs');
const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function apply(pack: unknown) {
  const directory = mkdtempSync(join(tmpdir(), 'wwtr-pack-'));
  temporary.push(directory);
  writeFileSync(join(directory, 'pack.json'), JSON.stringify(pack));
  const result = spawnSync(process.execPath, [script, 'pack.json'], { cwd: directory, encoding: 'utf8' });
  return { directory, result };
}

describe('config pack maintainer CLI', () => {
  it('writes valid delegation YAML relative to the working directory and prints next steps', () => {
    const yaml = 'id: new_state\nname: New state\n';
    const { directory, result } = apply({ version: 1, files: { 'config/delegations/new_state.yaml': yaml } });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(directory, 'config/delegations/new_state.yaml'), 'utf8')).toBe(yaml);
    expect(result.stdout).toContain('Wrote config/delegations/new_state.yaml');
    expect(result.stdout).toContain('npm run check-config');
  });

  it.each(['../escape.yaml', 'config/delegations/../../escape.yaml', 'config/scenario.yaml',
    'config/delegations/a.yaml', 'config\\delegations\\new_state.yaml', '/config/delegations/new_state.yaml'])('refuses %s before writing valid entries', path => {
    const { directory, result } = apply({ version: 1, files: { 'config/delegations/new_state.yaml': 'id: new_state', [path]: 'x' } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing');
    expect(existsSync(join(directory, 'config'))).toBe(false);
  });

  it.each([null, [], { version: 2, files: {} }, { version: 1, files: [] }, { version: 1, files: {}, extra: true },
    { version: 1, files: { 'config/delegations/new_state.yaml': 2 } }])('rejects malformed pack %#', pack => {
    const { directory, result } = apply(pack);
    expect(result.status).toBe(1);
    expect(existsSync(join(directory, 'config'))).toBe(false);
  });
});
