#!/usr/bin/env tsx
/**
 * generate-front-door — build the state-derived parts of README.md and
 * AGENTS.md (site-engine#229, spec hirobius/ops#576, ADR-010).
 *
 * The front-door idea comes from hirobius/hds@511209ab527b67a1b68765f0b3122983dc8671a1
 * (scripts/generate-agents-md.mjs: a generated front door between markers,
 * hand-written notes kept byte for byte, `--check` compares exact bytes).
 *
 * Marked blocks (`<!-- state:<id>:start ... -->` to `<!-- state:<id>:end -->`):
 *   README.md   roster   the app roster, read from apps/*
 *               scripts  the root package.json scripts and the command each runs
 *   AGENTS.md   front-door  read order, where live state is, and an index of
 *                           docs/state-surfaces.json by kind
 *               roster      the same app roster
 *
 * Everything outside the markers is hand-written and kept byte for byte. The
 * output holds no run date, no counts and no open work (those are derived:
 * ops states them live), so `--check` compares exact bytes.
 *
 * Usage:
 *   tsx scripts/generate-front-door.ts           write README.md and AGENTS.md
 *   tsx scripts/generate-front-door.ts --check   exit 1 when either is stale
 *   --root <dir>  read and write under <dir> instead of the repo (tests)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(HERE, "..");
const REGISTRY_PATH = "docs/state-surfaces.json";
const GENERATOR = "scripts/generate-front-door.ts";

/** Ops' live verdicts for the whole fleet. Password-gated in production. */
export const OPS_STANDING_URL = "https://hirobius-ops-adrian-6234s-projects.vercel.app/ops/standing";
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

/** Every apps/<slug> that has a package.json, sorted by slug. */
export function readApps(root: string): AppInfo[] {
  const dir = join(root, "apps");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, "package.json")))
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
 * The generated front door: read order, where live state lives, and every
 * registered document by kind. Holds no versions, counts or open work.
 */
export function buildFrontDoor(registry: Registry): string {
  const first = registry.alwaysOn ?? [];
  const index = KIND_ORDER.flatMap(([kind, title, gloss]) => {
    const rows = registry.surfaces.filter((s) => s.kind === kind);
    if (rows.length === 0) return [];
    return [
      `### ${title}`,
      "",
      gloss,
      "",
      ...rows.map((s) => `- ${code(s.path)}${s.section ? ` (${s.section})` : ""}: ${s.describes}`),
      "",
    ];
  });
  return [
    "## Front door",
    "",
    "### Read order",
    "",
    `1. ${first.length ? first.map(code).join(", then ") : code("CLAUDE.md")}. These are the always-on files: rules, read order and pointers, no state.`,
    `2. Running a lead to a gated preview: ${code("docs/PIPELINE-RUNBOOK.md")}. Building a client site: ${code("docs/INTAKE.md")}, then the config-only rules in ${code("CLAUDE.md")}.`,
    `3. Anything else: the index below.`,
    "",
    "### Where live state is",
    "",
    `Nothing in this repo records the release, the open work or what is blocked: ops derives them. Read ${OPS_STANDING_URL} (every verdict from live data; password-gated) and \`GET /api/projects\` on the same host (this repo is \`${REPO_SLUG}\`). ${code("status.json")} holds only the hand-written focus, phase and note. Open work is GitHub Issues in this repo; what waits on Adrian carries \`needs-adrian\` or \`needs-credential\`.`,
    "",
    "### Documents and what keeps them true",
    "",
    `Built from ${code(REGISTRY_PATH)}, which ${code("scripts/check-state-surfaces.ts")} gates. Re-read an editorial document, bump its \`reviewedAt\` there, then run \`pnpm state:generate\`.`,
    "",
    ...index,
  ]
    .join("\n")
    .trimEnd();
}

interface Target {
  file: string;
  blocks: string[];
}
const TARGETS: Target[] = [
  { file: "README.md", blocks: ["roster", "scripts"] },
  { file: "AGENTS.md", blocks: ["front-door", "roster"] },
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

/** What README.md and AGENTS.md should contain, keyed by repo-relative path. */
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
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const rootFlag = argv.indexOf("--root");
  const root = rootFlag >= 0 ? resolve(argv[rootFlag + 1]) : DEFAULT_ROOT;
  let want: Record<string, string>;
  try {
    want = expectedFiles(root);
  } catch (error) {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  }
  if (argv.includes("--check")) {
    const stale = Object.entries(want)
      .filter(([file, text]) => readFileSync(join(root, file), "utf8") !== text)
      .map(([file]) => file);
    if (stale.length) {
      console.error(
        `✗ ${stale.join(" and ")} out of date with apps/*, package.json scripts or ${REGISTRY_PATH}. Run: pnpm state:generate (hand-edit only outside the state: markers).`,
      );
      process.exit(1);
    }
    console.log("✓ generate-front-door: README.md and AGENTS.md are current");
    return;
  }
  for (const [file, text] of Object.entries(want)) writeFileSync(join(root, file), text);
  console.log(`✓ wrote ${Object.keys(want).join(" and ")}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
