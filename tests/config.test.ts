import { expect, it } from 'vitest';
import { loadConfig } from '../src/engine';

it('validates the real configuration with readable diagnostics', () => {
  const result = loadConfig();
  for (const warning of result.warnings) console.warn(`${warning.file} ${warning.path}: ${warning.message}`);
  const errors = result.ok ? [] : result.errors.map(error => `${error.file} ${error.path}: ${error.message}`);
  expect(errors, errors.join('\n')).toEqual([]);
});
