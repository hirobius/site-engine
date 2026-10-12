#!/usr/bin/env node
/**
 * scripts/lessons-vendored-drift.mjs — fail when a vendored lessons file was edited (ops#610).
 *
 * `pnpm lessons:vendor` (in hirobius/ops) copies the lessons ledger, the recall
 * hook and this check into a fleet repo's .claude/lessons/, with
 * `lessons.lock.json` pinning the sha256 of every file. This is the check,
 * ported from ops's guardrail shared-manifest (check-guardrail-drift): it
 * hashes each file the lock lists and exits 1 on a file that differs or is
 * gone, naming the fix. ops is the only place to edit these files.
 *
 * Vendored as .claude/lessons/check-drift.mjs. Node built-ins only; no deps.
 *
 *   node .claude/lessons/check-drift.mjs [dir]    dir defaults to this script's own
 *
 * Exit: 0 every file matches · 1 drift, a missing file or lock, or a bad lock.
 *
 * @module lessons-vendored-drift
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(process.argv[2] || dirname(fileURLToPath(import.meta.url)));
const shown = relative(process.cwd(), dir) || '.';

/** `{ file, kind, detail }` for each problem; empty when every pinned file matches. */
function findProblems() {
  const lockPath = resolve(dir, 'lessons.lock.json');
  if (!existsSync(lockPath)) {
    return {
      repo: null,
      problems: [
        { file: 'lessons.lock.json', kind: 'missing-lock', detail: 'the lock file is gone' },
      ],
    };
  }
  let lock;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return {
      repo: null,
      problems: [
        { file: 'lessons.lock.json', kind: 'bad-lock', detail: 'the lock file is not valid JSON' },
      ],
    };
  }
  const files = lock && typeof lock.files === 'object' && lock.files ? lock.files : null;
  if (!files || !Object.keys(files).length) {
    return {
      repo: lock?.repo ?? null,
      problems: [
        { file: 'lessons.lock.json', kind: 'bad-lock', detail: 'the lock lists no files' },
      ],
    };
  }
  const problems = [];
  for (const [file, pin] of Object.entries(files).sort()) {
    const abs = resolve(dir, file);
    if (abs !== dir && !abs.startsWith(dir + sep)) {
      problems.push({
        file,
        kind: 'bad-lock',
        detail: 'the lock names a path outside this directory',
      });
    } else if (!existsSync(abs)) {
      problems.push({ file, kind: 'missing', detail: 'the vendored file is gone' });
    } else if (`sha256:${createHash('sha256').update(readFileSync(abs)).digest('hex')}` !== pin) {
      problems.push({ file, kind: 'drift', detail: 'differs from the hash in the lock' });
    }
  }
  return { repo: typeof lock.repo === 'string' ? lock.repo : null, problems };
}

const { repo, problems } = findProblems();
if (!problems.length) {
  console.log(`lessons drift check: vendored files in ${shown} match their lock`);
} else {
  console.error(
    `\n✗ lessons drift: ${shown} differs from the copy vendored from hirobius/ops (${problems.length} problem(s))\n`,
  );
  for (const p of problems) console.error(`  ${p.file}  [${p.kind}]  ${p.detail}`);
  console.error(
    '\n  Fix: do not edit these files here. In the hirobius/ops checkout run\n' +
      `    pnpm lessons:vendor <path to this repo> ${repo ?? '<repo name>'}\n` +
      '  and commit the result.\n',
  );
  process.exitCode = 1;
}
