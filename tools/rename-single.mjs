// Renames the single-file build so the release asset has a recognisable name.
import { renameSync, existsSync } from 'node:fs';

const from = 'release/index.html';
const to = 'release/who-writes-the-rules.html';
if (!existsSync(from)) {
  console.error(`rename-single: ${from} not found. Did the single-file build run?`);
  process.exit(1);
}
renameSync(from, to);
console.log(`rename-single: wrote ${to}`);
