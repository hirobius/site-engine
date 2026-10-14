#!/usr/bin/env node
/**
 * scripts/check-ralph-kit-drift.mjs  (ops#492)
 *
 * `ralph/{lib,next,run,loop,status}.sh` and `ralph/prompt.md` are vendored
 * byte-identical from `hirobius/ralph/kit`. This gate pins their sha256 in
 * `ralph/kit.lock.json` so a local edit is caught at commit time, not only by
 * `ralph-gate` in CI.
 *
 * Usage:
 *   node scripts/check-ralph-kit-drift.mjs            # check all kit files, exit 1 on drift
 *   node scripts/check-ralph-kit-drift.mjs --staged   # pre-commit: check only STAGED kit files
 *                                                     # (staged blob content); no-op if none staged
 *   node scripts/check-ralph-kit-drift.mjs --report   # list drifted files, ALWAYS exit 0
 *   node scripts/check-ralph-kit-drift.mjs --update   # re-pin the lock from ralph/
 *     [--kit-dir <dir>] [--ref <ref>]                 #   ...or from a kit checkout, with its ref
 *
 * Fixture mode (validate-fixture-proof-of-firing): FIXTURE_FILE is a JSON
 *   { "lock": { "files": { "<name>": "<sha256>" } }, "files": { "<name>": "<content>" } }
 * that substitutes both the lock and the working files.
 *
 * Test override: RALPH_KIT_ROOT replaces the repo root.
 *
 * Exit codes: 0 clean (or --report) · 1 drift.
 *
 * @module check-ralph-kit-drift
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT_FILES = ['lib.sh', 'next.sh', 'run.sh', 'loop.sh', 'status.sh', 'prompt.md'];

const ROOT = process.env.RALPH_KIT_ROOT
  ? resolve(process.env.RALPH_KIT_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_PATH = join(ROOT, 'ralph', 'kit.lock.json');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function flagValue(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? null : (argv[i + 1] ?? null);
}

function stagedPaths() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

function stagedContent(rel) {
  try {
    return execFileSync('git', ['show', `:${rel}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null; // staged deletion / not in index
  }
}

function main(argv) {
  const fixtureMode = argv.includes('--fixture-mode') || process.env.HDS_FIXTURE_MODE === '1';
  const fixture =
    fixtureMode && process.env.FIXTURE_FILE
      ? JSON.parse(readFileSync(resolve(process.env.FIXTURE_FILE), 'utf8'))
      : null;

  if (argv.includes('--update')) {
    const kitDir = flagValue(argv, '--kit-dir');
    const dir = kitDir ? resolve(kitDir) : join(ROOT, 'ralph');
    const prev = existsSync(LOCK_PATH) ? JSON.parse(readFileSync(LOCK_PATH, 'utf8')) : {};
    const files = {};
    for (const f of KIT_FILES) {
      const p = join(dir, f);
      if (!existsSync(p)) {
        console.error(`✗ cannot re-pin: ${p} is missing`);
        return 1;
      }
      files[f] = sha256(readFileSync(p));
    }
    const ref = flagValue(argv, '--ref') ?? prev.ref ?? 'hirobius/ralph@unknown';
    writeFileSync(LOCK_PATH, JSON.stringify({ ref, files }, null, 2) + '\n');
    console.log(`✓ re-pinned ralph/kit.lock.json (${KIT_FILES.length} files, ref ${ref})`);
    return 0;
  }

  const lock = fixture ? fixture.lock : JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  const report = argv.includes('--report');
  let targets = fixture ? KIT_FILES.filter((f) => f in (lock.files ?? {})) : KIT_FILES;

  if (argv.includes('--staged') && !fixture) {
    const staged = new Set(stagedPaths());
    targets = KIT_FILES.filter((f) => staged.has(`ralph/${f}`));
    if (targets.length === 0) {
      console.log('✓ check-ralph-kit-drift — no ralph/ kit file staged, nothing to check.');
      return 0;
    }
  }

  const drifted = [];
  for (const f of targets) {
    let buf;
    if (fixture) buf = fixture.files?.[f] != null ? Buffer.from(fixture.files[f]) : null;
    else if (argv.includes('--staged')) buf = stagedContent(`ralph/${f}`);
    else buf = existsSync(join(ROOT, 'ralph', f)) ? readFileSync(join(ROOT, 'ralph', f)) : null;
    if (buf === null || sha256(buf) !== lock.files?.[f]) drifted.push(f);
  }

  if (drifted.length === 0) {
    console.log(`✓ check-ralph-kit-drift — ${targets.length} kit file(s) match ${lock.ref}.`);
    return 0;
  }

  for (const f of drifted) {
    console.error(
      `✗ ralph/${f} drifted from the vendored kit — edit hirobius/ralph/kit instead, then re-pin with node scripts/check-ralph-kit-drift.mjs --update.`,
    );
  }
  return report ? 0 : 1;
}

process.exit(main(process.argv.slice(2)));
