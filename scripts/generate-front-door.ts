#!/usr/bin/env tsx
/**
 * generate-front-door — build the state-derived parts of README.md and
 * AGENTS.md, and docs/DOCS-INDEX.md (site-engine#229, spec hirobius/ops#576,
 * ADR-010).
 *
 * The front-door idea comes from hirobius/hds#612
 * (scripts/generate-agents-md.mjs: a generated front door between markers,
 * hand-written notes kept byte for byte, `--check` compares exact bytes).
 *
 * Marked blocks (`<!-- state:<id>:start ... -->` to `<!-- state:<id>:end -->`):
 *   README.md   roster      the app roster, read from apps/* (the only place
 *                           it lives: AGENTS.md is read by every session, so
 *                           it carries no list that grows with the fleet)
 *               scripts     the root package.json scripts and the command each runs
 *   AGENTS.md   front-door  a short read order, where live state is, and a
 *                           pointer to docs/DOCS-INDEX.md
 * Whole file:
 *   docs/DOCS-INDEX.md      every registered document by kind, from
 *                           docs/state-surfaces.json; read on demand
 *
 * Everything outside the markers is hand-written and kept byte for byte. The
 * output holds no run date, no counts and no open work (those are derived:
 * ops states them live), so `--check` compares exact bytes.
 *
 * `zzz-*` apps are test fixtures (tests scaffold and delete them in parallel),
 * so they are never listed.
 *
 * Usage:
 *   tsx scripts/generate-front-door.ts           write the generated files
 *   tsx scripts/generate-front-door.ts --check   exit 1 when any is stale
 *   --root <dir>  read and write under <dir> instead of the repo (tests)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(HERE, "..");
const REGISTRY_PATH = "docs/state-surfaces.json";
const GENERATOR = "scripts/generate-front-door.ts";

/** The on-demand index of registered documents; AGENTS.md points here instead of carrying it. */
export const DOCS_INDEX_PATH = "docs/DOCS-INDEX.md";
/** Apps whose slug starts with this are test fixtures, never part of the fleet. */
export const FIXTURE_PREFIX = "zzz-";
const REPO_SLUG = "hirobius/site-engine";

export type AppKind = "config-only" | "bespoke" | "internal";

export interface AppInfo {
  slug: string;
  pkg: string;
  kind: AppKind;
  business: string | null;
}

/** What each `_`-prefixed app is for. Unknown ones fall back to a generic role. */
const INTERNAL_ROLES: Record<string, string> = {
  _template: "Canonical client app; `new-client` copies it",
  "_bespoke-template": "Copy source for the bespoke tier (`new-client --bespoke`); never deployed",
  _gallery: "Internal component and preset preview; the visual-regression baseline",
};

const code = (text: string) => `\`${text}\``;
const cell = (text: string) => text.replace(/\|/g, "\\|");

/** Every apps/<slug> that has a package.json, sorted by slug. Test fixtures (zzz-*) are skipped before they are read. */
export function readApps(root: string): AppInfo[] {
  const dir = join(root, "apps");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith(FIXTURE_PREFIX) && existsSync(join(dir, e.name, "package.json")))
    .map((e): AppInfo => {
      const slug = e.name;
      const pkg = JSON.parse(readFileSync(join(dir, slug, "package.json"), "utf8")).name ?? slug;
      const configPath = join(dir, slug, "client.config.ts");
      const config = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
      const name = config.match(/business:\s*\{[^}]*?\bname:\s*"((?:[^"\\]|\\.)*)"/s)?.[1] ?? null;
      const kind: AppKind = slug.startsWith("_")
        ? "internal"
        : existsSync(join(dir, slug, "site-spec.ts"))
          ? "bespoke"
          : "config-only";
      return { slug, pkg, kind, business: name?.replace(/\\(.)/g, "$1") ?? null };
    })
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** The app roster: client sites first, then the internal apps. */
export function buildRoster(apps: AppInfo[]): string {
  const sites = apps.filter((a) => a.kind !== "internal");
  const internal = apps.filter((a) => a.kind === "internal");
  const row = (a: AppInfo) => {
    const what =
      a.kind === "internal" ? (INTERNAL_ROLES[a.slug] ?? "Internal workspace app") : (a.business ?? "(no business name in client.config.ts)");
    return `| ${code(`apps/${a.slug}`)} | ${a.kind} | ${cell(what)} |`;
  };
  return [
    "Read from `apps/*`. `config-only` is `client.config.ts` plus photos; `bespoke` also has a `site-spec.ts`; `internal` (`_` prefix) is never deployed.",
    "",
    "| App | Kind | Business or role |",
    "| --- | --- | --- |",
    ...[...sites, ...internal].map(row),
  ].join("\n");
}

/** The root scripts, each with the command it runs. */
export function buildScripts(scripts: Record<string, string>): string {
  return [
    "Read from the root `package.json`.",
    "",
    "| Script | Runs |",
    "| --- | --- |",
    ...Object.entries(scripts).map(([name, cmd]) => `| ${code(`pnpm ${name}`)} | ${code(cmd).replace(/\|/g, "\\|")} |`),
  ].join("\n");
}

interface RegistrySurface {
  path: string;
  describes: string;
  kind: "generated" | "checked" | "editorial";
  by?: string;
  owner?: string;
  maxAgeDays?: number;
  section?: string;
}
interface Registry {
  alwaysOn?: string[];
  surfaces: RegistrySurface[];
}

const KIND_ORDER: [RegistrySurface["kind"], string, string][] = [
  ["generated", "Generated", "A script builds it (`by` in the registry); `pnpm state:check` fails when it is stale. Do not hand-edit."],
  ["checked", "Checked", "Hand-kept, but a named gate (`by`) compares it with the code."],
  ["editorial", "Editorial", "Written by a person; the registry carries owner, `reviewedAt` and `maxAgeDays`, and the gate says \"review due\" past it."],
];

/**
 * The generated front door, kept short because AGENTS.md is read by every
 * session: read order, where live state lives, and a pointer to the full index.
 * Holds no versions, counts or open work.
 */
export function buildFrontDoor(registry: Registry): string {
  const first = registry.alwaysOn ?? [];
  return [
    "## Front door",
    "",
    "### Read order",
    "",
    `1. ${first.length ? first.map(code).join(", then ") : code("CLAUDE.md")}. These are the always-on files: rules, read order and pointers, no state.`,
    `2. Running a lead to a gated preview: ${code("docs/PIPELINE-RUNBOOK.md")}. Building a client site: ${code("docs/INTAKE.md")}, then the config-only rules in ${code("CLAUDE.md")}.`,
    `3. Every other document, by kind and what keeps it true: ${code(DOCS_INDEX_PATH)} (generated, read on demand). The app roster is in ${code("README.md")}.`,
    "",
    "### Where live state is",
    "",
    `Nothing in this repo records the release, the open work or what is blocked: ops derives them. Read the ops dashboard's ${code("/ops/standing")} (every verdict from live data; password-gated) and its ${code("GET /api/projects")} (this repo is \`${REPO_SLUG}\`). ${code("status.json")} holds only the hand-written focus, phase and note. Open work is GitHub Issues in this repo; what waits on Adrian carries \`needs-adrian\` or \`needs-credential\`.`,
  ].join("\n");
}

/** docs/DOCS-INDEX.md: every registered document by kind. A whole generated file. */
export function buildDocsIndex(registry: Registry): string {
  const sections = KIND_ORDER.flatMap(([kind, title, gloss]) => {
    const rows = registry.surfaces.filter((s) => s.kind === kind);
    if (rows.length === 0) return [];
    return [
      `## ${title}`,
      "",
      gloss,
      "",
      ...rows.map((s) => `- ${code(s.path)}${s.section ? ` (${s.section})` : ""}: ${s.describes}`),
      "",
    ];
  });
  return [
    "# Documents and what keeps them true",
    "",
    `<!-- Generated by ${GENERATOR} (pnpm state:generate) from ${REGISTRY_PATH}; do not hand-edit. -->`,
    "",
    `Built from ${code(REGISTRY_PATH)}, which ${code("scripts/check-state-surfaces.ts")} gates. Re-read an editorial document, bump its \`reviewedAt\` there, then run \`pnpm state:generate\`. AGENTS.md points here so the always-on files stay small.`,
    "",
    ...sections,
  ]
    .join("\n")
    .trimEnd()
    .concat("\n");
}

interface Target {
  file: string;
  blocks: string[];
}
const TARGETS: Target[] = [
  { file: "README.md", blocks: ["roster", "scripts"] },
  { file: "AGENTS.md", blocks: ["front-door"] },
];

const startMarker = (id: string) =>
  `<!-- state:${id}:start — generated by ${GENERATOR} (pnpm state:generate); do not hand-edit until the end marker. -->`;
const endMarker = (id: string) => `<!-- state:${id}:end -->`;

/** Replace one marked block in `text`, or throw naming file and block. */
function splice(file: string, text: string, id: string, body: string): string {
  const start = text.search(new RegExp(`<!-- state:${id}:start[^>]*-->`));
  const endTag = endMarker(id);
  const end = text.indexOf(endTag);
  if (start < 0 || end < start) {
    throw new Error(
      `${file} has no "${id}" block: add a ${endMarker(id).replace(":end", ":start")} ... ${endTag} marker pair where it belongs, then run pnpm state:generate.`,
    );
  }
  return `${text.slice(0, start)}${startMarker(id)}\n\n${body}\n\n${endTag}${text.slice(end + endTag.length)}`;
}

/** What every generated file should contain, keyed by repo-relative path. */
export function expectedFiles(root: string): Record<string, string> {
  const apps = readApps(root);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  const registry = JSON.parse(readFileSync(join(root, REGISTRY_PATH), "utf8")) as Registry;
  const bodies: Record<string, string> = {
    roster: buildRoster(apps),
    scripts: buildScripts(pkg.scripts ?? {}),
    "front-door": buildFrontDoor(registry),
  };
  const out: Record<string, string> = {};
  for (const { file, blocks } of TARGETS) {
    let text = readFileSync(join(root, file), "utf8");
    for (const id of blocks) text = splice(file, text, id, bodies[id]);
    out[file] = text;
  }
  out[DOCS_INDEX_PATH] = buildDocsIndex(registry);
  return out;
}

/** The current text of `file` under `root`, or null when it does not exist yet. */
function readOrNull(root: string, file: string): string | null {
  const path = join(root, file);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/** Repo-relative paths of the generated files that differ from what they should be. */
export function staleFiles(root: string): string[] {
  return Object.entries(expectedFiles(root))
    .filter(([file, text]) => readOrNull(root, file) !== text)
    .map(([file]) => file);
}

/** Write every generated file that differs; return the ones it changed. */
export function writeFrontDoor(root: string): string[] {
  const changed: string[] = [];
  for (const [file, text] of Object.entries(expectedFiles(root))) {
    if (readOrNull(root, file) === text) continue;
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
    changed.push(file);
  }
  return changed;
}

function main() {
  const argv = process.argv.slice(2);
  const rootFlag = argv.indexOf("--root");
  const root = rootFlag >= 0 ? resolve(argv[rootFlag + 1]) : DEFAULT_ROOT;
  try {
    if (argv.includes("--check")) {
      const stale = staleFiles(root);
      if (stale.length) {
        console.error(
          `✗ ${stale.join(" and ")} out of date with apps/*, package.json scripts or ${REGISTRY_PATH}. Run: pnpm state:generate (hand-edit only outside the state: markers).`,
        );
        process.exit(1);
      }
      console.log(`✓ generate-front-door: ${Object.keys(expectedFiles(root)).join(", ")} are current`);
      return;
    }
    const changed = writeFrontDoor(root);
    console.log(changed.length ? `✓ wrote ${changed.join(" and ")}` : "✓ generate-front-door: nothing to change");
  } catch (error) {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
