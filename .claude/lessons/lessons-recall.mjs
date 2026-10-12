#!/usr/bin/env node
/**
 * scripts/lessons-recall.mjs — recall hook: show a session the lessons that match (ops#610).
 *
 * A Claude Code hook (settings.json: UserPromptSubmit, and PreToolUse for Edit,
 * Write, MultiEdit and Bash). It reads the hook JSON on stdin, matches the fleet
 * lessons ledger (docs/ai/learned-rules.jsonl, ops#600) against the prompt, the
 * file about to change or the command about to run, and prints
 * `{hookSpecificOutput: {hookEventName, additionalContext}}` with one
 * `L-xxxx · rule · why` line per lesson. For a `git diff` command it also lists
 * the changed paths with git, so a reviewer is handed the `review` lessons that
 * match the diff. The matching rules are in scripts/lib/lessons-recall.mjs.
 *
 * Each lesson is shown once per session (state in os.tmpdir(), keyed by
 * session_id), at most 3 per event and 10 per session. No model, no network.
 * It never blocks a tool call: a missing or malformed ledger, bad input or any
 * error prints one line to stderr and exits 0 with no output.
 *
 * The same script runs from a fleet repo's .claude/lessons/ (vendored by
 * `pnpm lessons:vendor`, with its own copy of the ledger and a lock file naming
 * the repo). Edit it only in ops.
 *
 * Env (tests only): LESSONS_LEDGER, LESSONS_STATE_DIR, LESSONS_REPO.
 *
 * @module lessons-recall-hook
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLedger } from './lib/lessons-ledger.mjs';
import { describeEvent, gitDiffInvocations, hookOutput, recall } from './lib/lessons-recall.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCK = join(HERE, 'lessons.lock.json');

const warn = (message) => process.stderr.write(`lessons-recall: ${message}\n`);

/** The ledger: a test override, else the vendored copy beside this script, else ops's own. */
function ledgerPath(env) {
  if (env.LESSONS_LEDGER) return env.LESSONS_LEDGER;
  const vendored = join(HERE, 'learned-rules.jsonl');
  return existsSync(vendored) ? vendored : join(HERE, '..', 'docs', 'ai', 'learned-rules.jsonl');
}

/** This repo's name: a test override, else the vendored lock's `repo`, else ops (no lock = the source). */
function repoName(env) {
  if (env.LESSONS_REPO) return env.LESSONS_REPO;
  if (!existsSync(LOCK)) return 'ops';
  try {
    const { repo } = JSON.parse(readFileSync(LOCK, 'utf8'));
    return typeof repo === 'string' ? repo : undefined;
  } catch {
    return undefined;
  }
}

function stateFile(env, sessionId) {
  const dir = env.LESSONS_STATE_DIR || join(tmpdir(), 'hirobius-lessons-recall');
  const key = String(sessionId || 'no-session')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 100);
  return { dir, file: join(dir, `${key}.json`) };
}

function readShown(file) {
  try {
    const { shown } = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(shown) ? shown.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Atomic (write + rename) so two hooks racing on one session never leave half a file. */
function writeShown({ dir, file }, shown) {
  try {
    mkdirSync(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ shown }));
    renameSync(tmp, file);
  } catch {
    /* an unwritable state dir means a lesson may repeat; never an error */
  }
}

/** Paths the command's `git diff` calls changed (empty when git cannot list them). */
function changedPaths(command, root) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[key];
  const paths = new Set();
  for (const args of gitDiffInvocations(command)) {
    try {
      const out = execFileSync('git', args, {
        cwd: root,
        env,
        encoding: 'utf8',
        timeout: 3000,
        maxBuffer: 8 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      for (const p of out.split('\0')) if (p) paths.add(p);
    } catch {
      /* an unreadable diff recalls nothing */
    }
  }
  return [...paths];
}

const hasReviewRows = (rows) =>
  rows.some(
    (r) => r?.enforcement === 'review' && (r.status === 'active' || r.status === 'enforced'),
  );

function main(env) {
  let hook;
  try {
    hook = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return warn('stdin is not hook JSON; nothing recalled');
  }
  const root = env.CLAUDE_PROJECT_DIR || hook?.cwd || process.cwd();
  const described = describeEvent(hook, root);
  if (!described) return;

  const ledger = ledgerPath(env);
  if (!existsSync(ledger)) return warn(`ledger not found at ${ledger}; nothing recalled`);
  const { rows, errors } = parseLedger(readFileSync(ledger, 'utf8'));
  if (errors.length) {
    return warn(`ledger is malformed (line ${errors[0].line} of ${ledger}); nothing recalled`);
  }

  const state = stateFile(env, hook.session_id);
  const shown = readShown(state.file);
  const { event, hookEventName } = described;
  const { lessons, context } = recall({
    rows,
    event,
    repo: repoName(env),
    shown,
    changedPaths:
      event.type === 'bash' && hasReviewRows(rows) ? changedPaths(event.command, root) : [],
  });
  const output = hookOutput(hookEventName, context);
  if (!output) return;

  writeShown(state, [...shown, ...lessons.map((l) => l.id)]);
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

try {
  main(process.env);
} catch (error) {
  warn(`${String(error?.message ?? error).split('\n')[0]}; nothing recalled`);
}
process.exitCode = 0;
