/**
 * scripts/lib/lessons-recall.mjs — which lessons a session is shown (ops#600, ops#610).
 *
 * The matcher behind the recall hook (scripts/lessons-recall.mjs). Pure: no
 * file, git or network access, no model. The handler reads the ledger and the
 * session state, computes a diff's paths with git, and passes it all in here.
 *
 * What matches what (only rows with status "active" or "enforced", and whose
 * scope.repos is empty or names the current repo):
 *
 *   prompt   enforcement "inject"  scope.topics    case-insensitive substring of the prompt
 *   edit     enforcement "inject"  scope.paths     glob against the repo-relative file path
 *   bash     enforcement "inject"  scope.commands  pattern anywhere in the command line
 *   bash     enforcement "review"  scope.paths     glob against the paths a `git diff` changed
 *            (this is how a reviewer is handed the lessons that match the diff)
 *
 * A lesson enforced by a check (`check:<id>`) is never recalled: its check
 * fails, and the failure names it. Each lesson is shown at most once per
 * session, at most CAPS.perEvent per event and CAPS.perSession per session;
 * the most-repeated lessons go first when a cap bites.
 *
 * Path globs: `**` crosses directories, `*` and `?` stay inside one, `{a,b}` and
 * `[abc]` work, a trailing `/` means the whole directory, and a glob with no `/`
 * matches the file name at any depth (like .gitignore). Command patterns are
 * matched case-sensitively, anywhere in the command line, with runs of
 * whitespace collapsed; `*` is a wildcard.
 *
 * This module is vendored byte-for-byte into every fleet repo
 * (`pnpm lessons:vendor`, scripts/lib/lessons-vendor.mjs). Edit it only in ops.
 *
 * @module lessons-recall
 */

import path from 'node:path';
import { parseEnforcement } from './lessons-ledger.mjs';

export const CAPS = { perEvent: 3, perSession: 10 };

const RECALLABLE_STATUS = new Set(['active', 'enforced']);
/** Tools whose `tool_input.file_path` names the file about to change. */
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);
/** Most `git diff` calls one command line is expanded into. */
const MAX_DIFF_INVOCATIONS = 3;

const isTextList = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const squeeze = (s) => String(s).replace(/\s+/g, ' ').trim();

// ── globs ────────────────────────────────────────────────────────────────────

/** Index of the `}` closing the `{` at `open`, or -1. */
function closingBrace(g, open) {
  let depth = 0;
  for (let i = open; i < g.length; i++) {
    if (g[i] === '{') depth++;
    else if (g[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/** Split `a,b{c,d},e` on its top-level commas. */
function splitAlternatives(s) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    else if (s[i] === ',' && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

/** The regex source for a glob (no anchors). */
function globSource(g) {
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '{') {
      const end = closingBrace(g, i);
      if (end === -1) {
        re += '\\{';
      } else {
        re += `(?:${splitAlternatives(g.slice(i + 1, end))
          .map(globSource)
          .join('|')})`;
        i = end;
      }
    } else if (c === '[') {
      const end = g.indexOf(']', i + 2);
      if (end === -1) {
        re += '\\[';
      } else {
        const body = g
          .slice(i + 1, end)
          .replace(/^!/, '^')
          .replace(/\\/g, '\\\\');
        re += `[${body}]`;
        i = end;
      }
    } else {
      re += escapeRe(c);
    }
  }
  return re;
}

/** A path glob as an anchored RegExp, matched against a repo-relative path. */
export function globToRegExp(glob) {
  let g = String(glob).replace(/^\.\//, '');
  if (g.endsWith('/')) g += '**';
  const source = globSource(g);
  // No slash: match the file name at any depth.
  return new RegExp(g.includes('/') ? `^${source}$` : `^(?:.*/)?${source}$`);
}

const globCache = new Map();
function matchesPath(globs, relPath) {
  if (typeof relPath !== 'string' || !relPath) return false;
  return globs.some((glob) => {
    let re = globCache.get(glob);
    if (!re) globCache.set(glob, (re = globToRegExp(glob)));
    return re.test(relPath);
  });
}

// ── commands ─────────────────────────────────────────────────────────────────

function matchesCommand(patterns, command) {
  const line = squeeze(command);
  return patterns.some((p) =>
    new RegExp(squeeze(p).split('*').map(escapeRe).join('.*')).test(line),
  );
}

// ── git diff ─────────────────────────────────────────────────────────────────

/** Whitespace-split with single and double quotes honoured (no expansion). */
function tokenize(text) {
  const tokens = [];
  for (const m of text.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) tokens.push(m[1] ?? m[2] ?? m[3]);
  return tokens;
}

/** `git diff` options that change which files differ (the rest only change the output). */
const DIFF_SCOPE_OPTION = /^(--cached|--staged|--merge-base|--diff-filter=[A-Za-z]+)$/;
/** Options that take their value as the next token. */
const DIFF_VALUE_OPTION = new Set(['-U', '--unified', '-S', '-G', '-O']);

/**
 * The `git` argument lists that print the changed paths (NUL-separated) of each
 * `git diff` in a command line. They run without a shell and without `-c`,
 * `--output` or `--ext-diff`, so listing paths can never do more than the
 * command the agent is about to run anyway.
 *
 * @param {unknown} command
 * @returns {string[][]}
 */
export function gitDiffInvocations(command) {
  if (typeof command !== 'string') return [];
  const out = [];
  for (const segment of command.split(/[;&|<>\n]+/)) {
    const t = tokenize(segment);
    let i = 0;
    while (i < t.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[i])) i++;
    if (t[i] !== 'git') continue;
    i++;
    const pre = [];
    while (i < t.length && t[i].startsWith('-')) {
      if (t[i] === '-C' && t[i + 1] !== undefined) {
        pre.push('-C', t[i + 1]);
        i += 2;
      } else if (t[i] === '-c') {
        i += 2;
      } else {
        i++;
      }
    }
    if (t[i] !== 'diff') continue;
    const args = [];
    let pathspecs = false;
    for (i++; i < t.length; i++) {
      const a = t[i];
      if (pathspecs) {
        args.push(a);
      } else if (a === '--') {
        pathspecs = true;
        args.push(a);
      } else if (a.startsWith('-')) {
        if (DIFF_SCOPE_OPTION.test(a)) args.push(a);
        else if (DIFF_VALUE_OPTION.has(a)) i++;
      } else {
        args.push(a);
      }
    }
    out.push([...pre, 'diff', '--name-only', '-z', ...args]);
    if (out.length === MAX_DIFF_INVOCATIONS) break;
  }
  return out;
}

// ── hook JSON → event ────────────────────────────────────────────────────────

/** A path inside `root` as `a/b.ts`, or null when it lies outside. */
function repoRelative(filePath, root) {
  const rel = path.relative(root, path.resolve(root, filePath)).split(path.sep).join('/');
  return rel === '' || rel === '..' || rel.startsWith('../') || path.isAbsolute(rel) ? null : rel;
}

/**
 * Read Claude Code hook JSON as `{ hookEventName, event }`, or null when it is
 * not an event recall handles (UserPromptSubmit; PreToolUse for Edit, Write,
 * MultiEdit and Bash).
 *
 * @param {unknown} hook   the parsed hook input
 * @param {string} root    the repository root, to make edit paths repo-relative
 */
export function describeEvent(hook, root) {
  if (!hook || typeof hook !== 'object') return null;
  const name = hook.hook_event_name;
  if (name === 'UserPromptSubmit') {
    return typeof hook.prompt === 'string' && hook.prompt
      ? { hookEventName: name, event: { type: 'prompt', prompt: hook.prompt } }
      : null;
  }
  if (name !== 'PreToolUse') return null;
  const input = hook.tool_input && typeof hook.tool_input === 'object' ? hook.tool_input : {};
  if (EDIT_TOOLS.has(hook.tool_name)) {
    if (typeof input.file_path !== 'string' || !input.file_path) return null;
    return {
      hookEventName: name,
      event: { type: 'edit', path: repoRelative(input.file_path, root) },
    };
  }
  if (hook.tool_name === 'Bash') {
    return typeof input.command === 'string' && input.command
      ? { hookEventName: name, event: { type: 'bash', command: input.command } }
      : null;
  }
  return null;
}

// ── matching ─────────────────────────────────────────────────────────────────

/** A row's scope if its shape is usable, else null (a broken row never throws). */
function usableScope(row) {
  const s = row?.scope;
  if (!s || typeof s !== 'object') return null;
  for (const key of ['repos', 'paths', 'topics', 'commands']) if (!isTextList(s[key])) return null;
  return s;
}

function inRepo(scope, repo) {
  if (!scope.repos.length) return true;
  const here = typeof repo === 'string' ? repo.toLowerCase() : null;
  return here !== null && scope.repos.some((r) => r.toLowerCase() === here);
}

function matches(row, scope, event, changedPaths) {
  const mode = parseEnforcement(row.enforcement)?.mode;
  switch (event.type) {
    case 'prompt': {
      if (mode !== 'inject') return false;
      const prompt = event.prompt.toLowerCase();
      return scope.topics.some((topic) => prompt.includes(topic.toLowerCase()));
    }
    case 'edit':
      return mode === 'inject' && matchesPath(scope.paths, event.path);
    case 'bash':
      if (mode === 'inject') return matchesCommand(scope.commands, event.command);
      if (mode === 'review') {
        return (
          changedPaths.some((p) => matchesPath(scope.paths, p)) &&
          gitDiffInvocations(event.command).length > 0
        );
      }
      return false;
    default:
      return false;
  }
}

/** One line per lesson: `L-0001 · rule · why`. */
function formatLesson(row) {
  return `${row.id} · ${squeeze(row.rule)} · ${squeeze(row.why)}`;
}

/**
 * The lessons to show for one event, and the text to show.
 *
 * @param {object} args
 * @param {object[]} args.rows              ledger rows
 * @param {{type: 'prompt', prompt: string} | {type: 'edit', path: string|null} | {type: 'bash', command: string}} args.event
 * @param {string} [args.repo]              the current repo's name (a FLEET_REPOS entry)
 * @param {string[]} [args.shown]           ids already shown in this session
 * @param {string[]} [args.changedPaths]    for a `git diff` bash event: the paths it changed
 * @param {{perEvent: number, perSession: number}} [args.caps]
 * @returns {{ lessons: object[], context: string | null }}
 */
export function recall({ rows, event, repo, shown = [], changedPaths = [], caps = CAPS }) {
  const seen = new Set(shown);
  const room = Math.min(caps.perEvent, caps.perSession - seen.size);
  if (room <= 0) return { lessons: [], context: null };

  const hits = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string') continue;
    if (!RECALLABLE_STATUS.has(row.status) || seen.has(row.id)) continue;
    if (typeof row.rule !== 'string' || typeof row.why !== 'string') continue;
    const scope = usableScope(row);
    if (!scope || !inRepo(scope, repo)) continue;
    if (matches(row, scope, event, changedPaths)) hits.push(row);
  }
  hits.sort(
    (a, b) => (Number(b.recurrence) || 0) - (Number(a.recurrence) || 0) || a.id.localeCompare(b.id),
  );

  const lessons = hits.slice(0, room);
  if (!lessons.length) return { lessons: [], context: null };
  const context = [
    'Lessons from the fleet ledger that match this (id · rule · why):',
    ...lessons.map(formatLesson),
  ].join('\n');
  return { lessons, context };
}

/** The hook's stdout object, or null when there is nothing to say. */
export function hookOutput(hookEventName, context) {
  return context ? { hookSpecificOutput: { hookEventName, additionalContext: context } } : null;
}
