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
 * the changed paths with git (in the session's cwd, after any `cd` in the
 * command), so a reviewer is handed the `review` lessons that match the diff.
 * An edited file in a worktree of the project (nested, like
 * .claude/worktrees/<name>, or checked out elsewhere) is matched relative to
 * that worktree. The matching rules are in scripts/lib/lessons-recall.mjs.
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

import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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

/** The repository a work tree at `dir` belongs to (its git common dir), or null. */
function commonGitDir(dir) {
  const dotGit = join(dir, '.git');
  try {
    if (statSync(dotGit).isDirectory()) return realpathSync(dotGit);
    // A linked worktree: `.git` is a file naming its git dir, whose `commondir` leads home.
    const gitDir = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(dotGit, 'utf8'))?.[1];
    if (!gitDir) return null;
    const own = resolve(dir, gitDir);
    const common = join(own, 'commondir');
    return realpathSync(
      existsSync(common) ? resolve(own, readFileSync(common, 'utf8').trim()) : own,
    );
  } catch {
    return null;
  }
}

/**
 * The work tree an edited file's path is made relative to: the git work tree
 * holding the file when it is a checkout of root's repository (root itself, a
 * worktree nested in it such as .claude/worktrees/<name>, or one checked out
 * elsewhere), else root. A file in any other repository stays outside.
 */
function editRoot(hook, root) {
  const file = hook?.tool_input?.file_path;
  if (typeof file !== 'string' || !file) return root;
  const home = commonGitDir(root);
  if (!home) return root;
  for (let dir = dirname(resolve(root, file)); ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.git'))) return commonGitDir(dir) === home ? dir : root;
    if (dirname(dir) === dir) return root;
  }
}

/**
 * Config that keeps listing paths from running anything the repo's git config
 * names: the hook fires before the permission prompt, so it must never run
 * repo-chosen code the session has not yet been allowed to run.
 */
const SAFE_GIT = ['-c', 'core.fsmonitor=false'];
/** Total time every git call of one event may take, well inside the hook's 5s timeout. */
const GIT_BUDGET_MS = 3000;

/** Paths the command's `git diff` calls changed (empty when git cannot list them). */
function changedPaths(command, root) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[key];
  const paths = new Set();
  const deadline = Date.now() + GIT_BUDGET_MS;
  for (const args of gitDiffInvocations(command)) {
    const timeout = deadline - Date.now();
    if (timeout <= 0) break;
    try {
      const out = execFileSync('git', [...SAFE_GIT, ...args], {
        cwd: root,
        env,
        encoding: 'utf8',
        timeout,
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
  const described = describeEvent(hook, editRoot(hook, root));
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
      event.type === 'bash' && hasReviewRows(rows)
        ? // The diff runs where the session's shell is, which may not be the project dir.
          changedPaths(event.command, (typeof hook.cwd === 'string' && hook.cwd) || root)
        : [],
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
