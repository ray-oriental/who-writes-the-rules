import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
  .split('\0').filter(Boolean);
const checks = [
  ['local absolute path', /\b[a-z]:[\\/]+(?:Users|Workspace)[\\/]/i],
  ['email address', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
  ['credential-shaped value', /\b(?:sk-[A-Za-z0-9_-]{18,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const violations = [];

for (const file of new Set(files)) {
  const content = readFileSync(file);
  if (content.includes(0)) continue;
  const lines = content.toString('utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [label, pattern] of checks) {
      if (pattern.test(line)) violations.push(file + ':' + (index + 1) + ' ' + label);
    }
  });
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Public-tree check passed.');
}
