#!/usr/bin/env tsx
/**
 * check-state-surfaces — gate for the state-surface registry (site-engine#229,
 * spec hirobius/ops#576, ADR-010 "state is derived").
 *
 * Ported from hirobius/hds@511209ab527b67a1b68765f0b3122983dc8671a1
 * (scripts/check-state-surfaces.mjs), moved to TypeScript, plus two opt-in
 * rules this repo needs (`statusFile`, `registerAll`).
 *
 * `docs/state-surfaces.json` lists every file or section that describes
 * project state, and what keeps it true:
 *
 *   generated  built by a generator (`by`); a `--check` for it runs in
 *              `pnpm state:check`, named in `check` for reference
 *   checked    prose or data a named gate (`by`) compares to the code
 *   editorial  hand-written; carries `owner`, `reviewedAt` (YYYY-MM-DD) and
 *              `maxAgeDays`, and goes "review due" when it ages out
 *
 * Rules (violation `rule`):
 *   REGISTRY_MISSING / REGISTRY_INVALID  the registry is absent or malformed
 *   SURFACE_MISSING    a registered path does not exist
 *   BY_MISSING         `by` looks like a repo path and does not exist
 *   GENERATED_STALE    --run-checks only: a declared `check` command failed
 *   REVIEW_DUE         an editorial surface is older than its maxAgeDays
 *   DERIVED_FACT       an `alwaysOn` file (CLAUDE.md and anything it makes
 *                      mandatory reading) states a version, a count, a list of
 *                      issue/PR numbers or an "as of <date>" state
 *   DEAD_REFERENCE     markdown that is not generated (registered editorial or
 *                      checked files, markdown inside registered directories,
 *                      and README/CLAUDE/CONTRIBUTING/AGENTS) names a repo path
 *                      (backticked, or a link target) that does not exist.
 *                      Fenced code blocks are skipped.
 *   STATUS_SHAPE       (registry `statusFile`) status.json is not the v2 shape
 *                      { schemaVersion: 2, focus <= 120 chars, phase, note?,
 *                      updatedAt }; next/blocked/headline are derived by ops
 *   UNREGISTERED_DOC   (registry `registerAll`) a markdown file directly in a
 *                      listed directory is covered by no registry entry
 *
 * Vendorable: it reads nothing repo-specific. A referenced path that
 * .gitignore covers counts as present (build output). Optional registry keys:
 * `ignoreReferences` (path prefixes to skip), `alwaysOn`, `alsoScan` (markdown
 * scanned even when unregistered; default README, CLAUDE, CONTRIBUTING,
 * AGENTS), `statusFile`, `registerAll`.
 *
 * Usage:
 *   tsx scripts/check-state-surfaces.ts [--root <dir>] [--registry <path>]
 *        [--today YYYY-MM-DD] [--run-checks] [--json]
 *   FIXTURE_DIR=<dir> tsx scripts/check-state-surfaces.ts   (fixture mini-root)
 *
 * Exit: 0 clean, 1 violations.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(HERE, "..");
const DEFAULT_REGISTRY = "docs/state-surfaces.json";
const DEFAULT_ALSO_SCAN = ["README.md", "CLAUDE.md", "CONTRIBUTING.md", "AGENTS.md"];
const KINDS = ["generated", "checked", "editorial"];
const PATH_EXT = /\.(md|mdx|json|mjs|cjs|js|ts|tsx|jsx|css|ya?ml|txt|html|sh|svg|astro)$/i;
const DAY_MS = 86_400_000;
const STATUS_KEYS = ["schemaVersion", "focus", "phase", "note", "updatedAt"];
const FOCUS_MAX = 120;

export interface Violation {
  file: string;
  line: number | null;
  rule: string;
  severity: "error";
  message: string;
}

export interface CheckResult {
  violations: Violation[];
  summary: { byKind: Record<string, number>; scanned: number };
  ok: boolean;
}

export interface CheckOptions {
  root?: string;
  registry?: string;
  today?: string;
  runChecks?: boolean;
}

interface Surface {
  path?: unknown;
  describes?: unknown;
  kind?: unknown;
  by?: unknown;
  check?: unknown;
  section?: unknown;
  owner?: unknown;
  reviewedAt?: unknown;
  maxAgeDays?: unknown;
}

const isDay = (text: unknown): text is string =>
  typeof text === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(text) &&
  !Number.isNaN(Date.parse(text)) &&
  new Date(text).toISOString().startsWith(text);

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Every markdown file under `dir` (repo-relative paths), skipping dot dirs and node_modules. */
function markdownIn(root: string, dir: string): string[] {
  const out: string[] = [];
  const walk = (abs: string) => {
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const full = join(abs, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.mdx?$/i.test(e.name)) out.push(relative(root, full));
    }
  };
  walk(join(root, dir));
  return out;
}

export interface Reference {
  raw: string;
  kind: "link" | "code";
  line: number;
}

/**
 * Repo-path candidates in one markdown file: backticked spans and link targets,
 * outside fenced code. `kind` is 'link' (any relative target) or 'code'
 * (needs a slash plus a known extension, or a trailing slash).
 */
export function extractReferences(text: string): Reference[] {
  const refs: Reference[] = [];
  let fence: string | null = null;
  text.split("\n").forEach((line, i) => {
    const marker = line.match(/^\s*(```+|~~~+)/);
    if (marker) {
      if (fence === null) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = null;
      return;
    }
    if (fence !== null) return;
    for (const m of line.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      refs.push({ raw: m[1], kind: "link", line: i + 1 });
    }
    for (const m of line.matchAll(/`([^`\n]+)`/g)) {
      refs.push({ raw: m[1], kind: "code", line: i + 1 });
    }
  });
  return refs;
}

/** The path a reference names, or null when it is not a repo path. */
function pathOf({ raw, kind }: Reference): string | null {
  let p = raw.trim();
  if (!p || p.startsWith("#")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(p) || p.includes("://")) return null; // url, mailto
  if (p.startsWith("/") || p.startsWith("~") || p.startsWith("@")) return null;
  p = p.replace(/[#?].*$/, "").replace(/:\d+(-\d+)?$/, "");
  if (!p) return null;
  if (/[*{}<>$|()[\]=,;\s'"\\!]/.test(p)) return null; // glob, placeholder, command
  if (kind === "code") {
    const dir = p.endsWith("/");
    if (!p.includes("/")) return null;
    if (!dir && !PATH_EXT.test(p)) return null;
    if (dir && p.split("/").filter(Boolean).length < 2) return null;
  }
  return p;
}

const COUNT_NOUNS =
  "components?|tokens?|gates?|apps?|tests?|files?|units?|patterns?|pods?|scripts?|checks?|validators?|ADRs?|workflows?|skills?|issues?|PRs?|releases?|sites?|clients?";
/** "more than 50 files" sets a rule's limit; it is not a fact about the repo. */
const THRESHOLD =
  /(?:more than|over|under|at most|at least|fewer than|up to|max(?:imum)?|limit of|above|below)\s+$/i;
const ISSUE_REF = /(?:[\w-]+\/)?[\w-]*#\d+/g;

export interface DerivedFact {
  kind: string;
  text: string;
}

/**
 * Derived facts on one line of an always-on file: things a generator or ops can
 * state live, so a hand-kept copy only goes stale.
 */
export function derivedFacts(line: string): DerivedFact[] {
  const out: DerivedFact[] = [];
  for (const m of line.matchAll(/(?<![\w.])v?\d+\.\d+\.\d+(?![\w.]*\/)(?![\d])/g)) {
    out.push({ kind: "version", text: m[0] });
  }
  for (const m of line.matchAll(new RegExp(`(?<![\\w.#-])\\d[\\d,]*\\+?\\s+(?:${COUNT_NOUNS})\\b`, "gi"))) {
    if (!THRESHOLD.test(line.slice(0, m.index))) out.push({ kind: "count", text: m[0] });
  }
  const issues = line.match(ISSUE_REF) ?? [];
  if (issues.length >= 2) out.push({ kind: "issue list", text: issues.join(", ") });
  const dated = line.match(
    /\b(?:as of|last updated|updated|current as of|status as of)\b[^.\n]{0,20}\d{4}-\d{2}-\d{2}/i,
  );
  if (dated) out.push({ kind: "dated state", text: dated[0] });
  return out;
}

/** Which of `paths` the repo's .gitignore covers (none outside a git repo). */
function gitIgnored(root: string, paths: string[]): Set<string> {
  // git refuses the whole batch if one path is outside the repository (../x).
  paths = paths.filter((p) => !p.startsWith("..") && !p.startsWith("/"));
  if (paths.length === 0) return new Set();
  const res = spawnSync("git", ["check-ignore", "--stdin"], {
    cwd: root,
    input: paths.join("\n"),
    encoding: "utf8",
  });
  return new Set(res.status === 0 ? res.stdout.split("\n").filter(Boolean) : []);
}

function resolves(root: string, fromFile: string, p: string): boolean {
  const clean = p.replace(/\/$/, "");
  return existsSync(resolve(root, dirname(fromFile), clean)) || existsSync(resolve(root, clean));
}

/** Problems with a parsed status.json against the v2 shape (ADR-010). */
function statusProblems(status: unknown): string[] {
  if (typeof status !== "object" || status === null || Array.isArray(status)) {
    return ["is not a JSON object"];
  }
  const s = status as Record<string, unknown>;
  const out: string[] = [];
  if (s.schemaVersion !== 2) out.push(`schemaVersion must be 2, not ${JSON.stringify(s.schemaVersion)}`);
  if (typeof s.focus !== "string" || !s.focus.trim()) out.push("focus must be a non-empty string");
  else if (s.focus.length > FOCUS_MAX) out.push(`focus is ${s.focus.length} characters; the limit is ${FOCUS_MAX}`);
  if (typeof s.phase !== "string" || !s.phase.trim()) out.push("phase must be a non-empty string");
  if (s.note !== undefined && typeof s.note !== "string") out.push("note, when present, must be a string");
  if (typeof s.updatedAt !== "string" || Number.isNaN(Date.parse(s.updatedAt))) {
    out.push("updatedAt must be an ISO timestamp");
  }
  for (const key of Object.keys(s)) {
    if (!STATUS_KEYS.includes(key)) {
      out.push(`"${key}" is not a v2 field; ops derives release, next and blocked, so it is not written by hand`);
    }
  }
  return out;
}

/** Check the registry under `root`. */
export function checkStateSurfaces({
  root = DEFAULT_ROOT,
  registry = DEFAULT_REGISTRY,
  today: now = todayIso(),
  runChecks = false,
}: CheckOptions = {}): CheckResult {
  const violations: Violation[] = [];
  const add = (file: string, rule: string, message: string, line: number | null = null) =>
    violations.push({ file, line, rule, severity: "error", message });
  const regPath = join(root, registry);
  const summary: CheckResult["summary"] = { byKind: {}, scanned: 0 };
  const done = (): CheckResult => ({ violations, summary, ok: violations.length === 0 });

  if (!existsSync(regPath)) {
    add(registry, "REGISTRY_MISSING", `${registry} does not exist; it lists every file that describes state.`);
    return done();
  }
  let reg: {
    surfaces?: Surface[];
    ignoreReferences?: string[];
    alsoScan?: string[];
    alwaysOn?: string[];
    statusFile?: string;
    registerAll?: string[];
  };
  try {
    reg = JSON.parse(readFileSync(regPath, "utf8"));
  } catch (error) {
    add(registry, "REGISTRY_INVALID", `${registry} is not JSON (${(error as Error).message}).`);
    return done();
  }
  if (!Array.isArray(reg.surfaces)) {
    add(registry, "REGISTRY_INVALID", `${registry} needs a "surfaces" array.`);
    return done();
  }

  const ignore = reg.ignoreReferences ?? [];
  const scan = new Set(reg.alsoScan ?? DEFAULT_ALSO_SCAN);
  const seen = new Set<string>();
  const nowMs = Date.parse(now);

  for (const s of reg.surfaces) {
    const label = typeof s?.path === "string" ? s.path : "(no path)";
    const bad = (why: string) => add(registry, "REGISTRY_INVALID", `${label}: ${why}`);
    if (typeof s?.path !== "string" || !s.path) {
      bad("every surface needs a path");
      continue;
    }
    if (!s.describes) bad('needs "describes" (what state it holds)');
    if (typeof s.kind !== "string" || !KINDS.includes(s.kind)) {
      bad(`kind must be one of ${KINDS.join(", ")}, not ${JSON.stringify(s.kind)}`);
      continue;
    }
    const key = `${s.path}#${s.section ?? ""}`;
    if (seen.has(key)) bad('registered twice (give each section its own "section")');
    seen.add(key);
    summary.byKind[s.kind] = (summary.byKind[s.kind] ?? 0) + 1;

    if (s.kind !== "editorial" && !s.by) {
      bad(`a ${s.kind} surface must name its ${s.kind === "generated" ? "generator" : "check"} in "by"`);
    }
    if (s.kind === "editorial") {
      if (!s.owner) bad('an editorial surface needs an "owner"');
      if (!isDay(s.reviewedAt)) {
        bad(`"reviewedAt" must be a calendar day (YYYY-MM-DD), not ${JSON.stringify(s.reviewedAt)}`);
      }
      if (!Number.isInteger(s.maxAgeDays) || (s.maxAgeDays as number) < 1) {
        bad('"maxAgeDays" must be a positive integer');
      }
    }

    if (!existsSync(join(root, s.path))) {
      add(
        s.path,
        "SURFACE_MISSING",
        `${s.path} is registered in ${registry} but does not exist; update or remove the entry.`,
      );
      continue;
    }
    if (
      typeof s.by === "string" &&
      /^[\w.-]+\/[\w./-]+\.\w+$/.test(s.by) &&
      !existsSync(join(root, s.by))
    ) {
      add(s.path, "BY_MISSING", `${s.path}: "by" names ${s.by}, which does not exist.`);
    }
    if (s.kind === "editorial" && isDay(s.reviewedAt) && Number.isInteger(s.maxAgeDays)) {
      const age = Math.floor((nowMs - Date.parse(s.reviewedAt)) / DAY_MS);
      if (age > (s.maxAgeDays as number)) {
        add(
          s.path,
          "REVIEW_DUE",
          `${s.path} review due: last reviewed ${s.reviewedAt} (${age} days ago, max ${s.maxAgeDays}); ${String(s.owner ?? "its owner")} re-reads it and bumps reviewedAt in ${registry}.`,
        );
      }
    }
    if (runChecks && typeof s.check === "string") {
      const res = spawnSync(s.check, { cwd: root, shell: true, encoding: "utf8" });
      if (res.status !== 0) {
        add(
          s.path,
          "GENERATED_STALE",
          `${s.path}: \`${s.check}\` failed (exit ${res.status}); regenerate it with ${String(s.by ?? "its generator")}.`,
        );
      }
    }
  }

  // status.json is read by ops: hold it to the v2 shape.
  if (reg.statusFile) {
    const file = reg.statusFile;
    if (!existsSync(join(root, file))) {
      add(file, "STATUS_SHAPE", `${file} is declared as statusFile in ${registry} but does not exist.`);
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(join(root, file), "utf8"));
      } catch (error) {
        add(file, "STATUS_SHAPE", `${file} is not JSON (${(error as Error).message}).`);
      }
      if (parsed !== undefined) {
        for (const problem of statusProblems(parsed)) add(file, "STATUS_SHAPE", `${file}: ${problem}.`);
      }
    }
  }

  // Every markdown file directly in a registerAll directory must be classified.
  for (const dir of reg.registerAll ?? []) {
    if (!existsSync(join(root, dir))) continue;
    const paths = reg.surfaces.map((s) => s?.path).filter((p): p is string => typeof p === "string");
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (!e.isFile() || !/\.mdx?$/i.test(e.name)) continue;
      const rel = `${dir}/${e.name}`;
      if (!paths.some((p) => p === rel || rel.startsWith(`${p.replace(/\/$/, "")}/`))) {
        add(
          rel,
          "UNREGISTERED_DOC",
          `${rel} is in no ${registry} entry; register it as generated, checked or editorial (or git mv it to ${dir}/archive/ if it is history).`,
        );
      }
    }
  }

  // Markdown to scan: everything registered that a person writes or a gate
  // checks (generated text belongs to its generator), plus the front-door files.
  const files = new Set<string>();
  for (const f of scan) if (existsSync(join(root, f))) files.add(f);
  for (const s of reg.surfaces) {
    if (typeof s?.path !== "string" || s.kind === "generated" || !existsSync(join(root, s.path))) continue;
    if (statSync(join(root, s.path)).isDirectory()) markdownIn(root, s.path).forEach((f) => files.add(f));
    else if (/\.mdx?$/i.test(s.path)) files.add(s.path);
  }
  // Always-on files (every session reads them first) hold rules, read order and
  // pointers only: a version, count, issue list or dated state is derived, so it
  // is stated live elsewhere and goes stale here.
  for (const file of reg.alwaysOn ?? []) {
    if (!existsSync(join(root, file))) {
      add(file, "SURFACE_MISSING", `${file} is listed in alwaysOn in ${registry} but does not exist.`);
      continue;
    }
    let fenced: string | null = null;
    readFileSync(join(root, file), "utf8")
      .split("\n")
      .forEach((line, i) => {
        const marker = line.match(/^\s*(```+|~~~+)/);
        if (marker) {
          fenced = fenced === null ? marker[1][0] : fenced === marker[1][0] ? null : fenced;
          return;
        }
        if (fenced !== null) return;
        for (const f of derivedFacts(line)) {
          add(
            file,
            "DERIVED_FACT",
            `${file} states a ${f.kind} ("${f.text}"), which is derived: always-on files hold rules, read order and pointers only. Point to where it is stated live.`,
            i + 1,
          );
        }
      });
  }

  const dead: { file: string; p: string; line: number }[] = [];
  for (const file of [...files].sort()) {
    summary.scanned++;
    const text = readFileSync(join(root, file), "utf8");
    for (const ref of extractReferences(text)) {
      const p = pathOf(ref);
      if (!p || ignore.some((prefix) => p.startsWith(prefix))) continue;
      if (!resolves(root, file, p)) dead.push({ file, p, line: ref.line });
    }
  }
  // A path the repo gitignores is build output: absent from a clean checkout, not dead.
  const ignored = gitIgnored(root, [...new Set(dead.map((d) => d.p))]);
  for (const { file, p, line } of dead) {
    if (ignored.has(p)) continue;
    add(file, "DEAD_REFERENCE", `${file} references ${p}, which does not exist; fix or remove the reference.`, line);
  }
  return done();
}

function argValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const root = resolve(process.env.FIXTURE_DIR ?? argValue(argv, "--root") ?? DEFAULT_ROOT);
  const result = checkStateSurfaces({
    root,
    registry: argValue(argv, "--registry") ?? DEFAULT_REGISTRY,
    today: argValue(argv, "--today") ?? process.env.STATE_SURFACES_TODAY ?? todayIso(),
    runChecks: argv.includes("--run-checks"),
  });
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.ok) {
    const kinds = Object.entries(result.summary.byKind)
      .map(([k, n]) => `${n} ${k}`)
      .join(", ");
    console.log(`✓ check-state-surfaces (${kinds}; ${result.summary.scanned} markdown file(s) scanned)`);
  } else {
    for (const v of result.violations) console.error(`${v.file}:${v.line ?? "-"} ${v.rule} ${v.message}`);
    console.error(`✗ check-state-surfaces: ${result.violations.length} violation(s)`);
  }
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
