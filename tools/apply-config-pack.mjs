#!/usr/bin/env node
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const allowedPath = /^config\/delegations\/[a-z][a-z0-9_]{1,30}\.yaml$/;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function refuseSymlink(path) {
  try {
    if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing symbolic link: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

try {
  if (process.argv.length !== 3) throw new Error('Usage: node tools/apply-config-pack.mjs pack.json');
  const pack = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  if (!record(pack) || pack.version !== 1 || Object.keys(pack).sort().join(',') !== 'files,version' || !record(pack.files)) {
    throw new Error('Expected a config pack with only version: 1 and a files object.');
  }
  const entries = Object.entries(pack.files);
  for (const [path, yaml] of entries) {
    if (!allowedPath.test(path) || typeof yaml !== 'string') throw new Error(`Refusing invalid delegation path or content: ${path}`);
  }
  // Validate every destination before the first write, including existing parents.
  for (const [path] of entries) {
    for (const destination of ['config', 'config/delegations', path]) refuseSymlink(resolve(destination));
    try {
      if (!lstatSync(resolve(path)).isFile()) throw new Error(`Destination is not a regular file: ${path}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  for (const [path, yaml] of entries) {
    mkdirSync(dirname(resolve(path)), { recursive: true });
    writeFileSync(resolve(path), yaml, 'utf8');
    console.log(`Wrote ${path}`);
  }
  console.log('Run npm run check-config, review the changes, and commit them.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to apply config pack.');
  process.exitCode = 1;
}
