#!/usr/bin/env tsx
/**
 * lead-to-preview — one command from a lead to a gated preview (spec #232).
 *
 *   pnpm lead-to-preview --lead <lead.json>     [--deploy] [--dry-run] [--force]
 *   pnpm lead-to-preview --render <render.json> [--deploy] [--dry-run] [--force]
 *
 * Replaces the manual runbook path (docs/PIPELINE-RUNBOOK.md):
 *
 *   scaffold (new-client) -> pnpm install -> render-site -> check -> build
 *   and, ONLY with --deploy: -> deploy-preview -> verify-live --expect-gated
 *
 * Input is either a raw ops lead row (`LeadRow`, mapped with `leadToConfig()`)
 * or an ops render payload `{ slug, config, lead_id? }` (the shape #121's
 * dispatch carries). Without `--deploy` the command stops after a green build
 * and prints the next command: deploying stays a deliberate human step
 * (hirobius/ops docs/specs/leads-to-site.md). It never commits, never pushes, and never
 * passes `--prod` (deploy-preview itself refuses to).
 *
 * Each step is the existing script run as a subprocess (argv array, no
 * shell), so every step keeps its own tested guards: Zod + live-config
 * refusal in render-site, preview-only in deploy-preview. `verify-live
 * --expect-gated` is the real gate: deploy-preview only warns when its own
 * check fails, so this command's exit code comes from verify-live.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { leadToConfig, type LeadRow } from "../packages/schema/src/lead-to-config.js";
import { PALETTE_PRESET_IDS } from "../packages/schema/src/presets.js";
import { extractDeployUrl } from "./deploy-preview.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Same rule new-client enforces; checked here so nothing runs on a bad slug. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** verify-live attempts before the gate is declared broken (a fresh deploy can still be propagating). */
const VERIFY_ATTEMPTS = 3;
const VERIFY_WAIT_MS = 5_000;

export interface PipelineInput {
  slug: string;
  name: string;
  preset: string;
  config: unknown;
  /** Stubbed/defaulted facts to fix before go-live (from `leadToConfig`). */
  todos: string[];
  leadId?: string;
}

export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export type StepName = "scaffold" | "install" | "render" | "check" | "build" | "deploy" | "verify-gated";

export interface Step {
  name: StepName;
  cmd: string;
  args: string[];
  /** Capture stdout (the deploy step's output carries the URL); otherwise stream it. */
  capture?: boolean;
}

export interface PipelineDeps {
  run: (cmd: string, args: string[], opts: { capture: boolean }) => RunResult;
  appExists: (slug: string) => boolean;
  /** Writes the config JSON somewhere private; `cleanup` removes it. */
  writeTempConfig: (json: string) => { path: string; cleanup: () => void };
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
}

export interface PipelineOptions {
  deploy: boolean;
  force: boolean;
  dryRun: boolean;
}

export interface PipelineResult {
  ok: boolean;
  failedStep?: StepName;
  /** The keyed `?key=` link, only once verify-live proved the gate closed. */
  previewLink?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Parses a lead row or render payload into what the pipeline needs, rejecting
 * anything that would build a bad path or argv before a single step runs.
 */
export function parseInput(kind: "lead" | "render", json: string): PipelineInput {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new Error(`${kind} file is not valid JSON: ${(err as Error).message}`);
  }
  if (!isRecord(raw)) throw new Error(`${kind} file must hold a JSON object.`);

  let slug: unknown;
  let config: unknown;
  let todos: string[] = [];
  let leadId: string | undefined;

  if (kind === "lead") {
    slug = raw.slug;
    if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
      throw new Error(`lead slug ${JSON.stringify(slug)} must be kebab-case (e.g. pressure-pros).`);
    }
    ({ config, todos } = leadToConfig(raw as unknown as LeadRow));
  } else {
    slug = raw.slug;
    config = raw.config;
    if (typeof raw.lead_id === "string") leadId = raw.lead_id;
    if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
      throw new Error(`render payload slug ${JSON.stringify(slug)} must be kebab-case (e.g. pressure-pros).`);
    }
    if (!isRecord(config)) throw new Error("render payload must carry a `config` object (a ClientConfig).");
    if (config.slug !== slug) {
      throw new Error(`config.slug ${JSON.stringify(config.slug)} does not match the payload slug "${slug}".`);
    }
  }

  const cfg = config as { business?: { name?: unknown }; brand?: { palettePreset?: unknown } };
  const name = cfg.business?.name;
  // new-client reads a value starting with "-" as the next flag, and splices
  // --name into String.replace, where "$" is a replacement pattern.
  if (typeof name !== "string" || !name.trim() || name.startsWith("-") || name.includes("$")) {
    throw new Error(
      `business name ${JSON.stringify(name)} can't be passed to new-client (empty, starts with "-", or contains "$").`,
    );
  }
  const preset = cfg.brand?.palettePreset;
  if (typeof preset !== "string" || !(PALETTE_PRESET_IDS as readonly string[]).includes(preset)) {
    throw new Error(`palette preset ${JSON.stringify(preset)} is not one of: ${PALETTE_PRESET_IDS.join(", ")}.`);
  }

  return { slug, name, preset, config, todos, ...(leadId ? { leadId } : {}) };
}

/** The ordered steps up to (and, with `deploy`, including) the preview deploy. */
export function planSteps(
  input: PipelineInput,
  opts: { configPath: string; appExists: boolean; deploy: boolean; force: boolean },
): Step[] {
  const { slug } = input;
  const steps: Step[] = [];
  if (!opts.appExists) {
    steps.push({
      name: "scaffold",
      cmd: "pnpm",
      args: ["new-client", slug, "--name", input.name, "--preset", input.preset],
    });
  }
  // Not --frozen-lockfile: a new app is a new lockfile importer.
  steps.push({ name: "install", cmd: "pnpm", args: ["install"] });
  steps.push({
    name: "render",
    cmd: "pnpm",
    args: ["render-site", slug, "--config", opts.configPath, ...(opts.force ? ["--force"] : [])],
  });
  steps.push({ name: "check", cmd: "pnpm", args: ["--filter", `@hirobius/${slug}`, "check"] });
  steps.push({ name: "build", cmd: "pnpm", args: ["--filter", `@hirobius/${slug}`, "build"] });
  if (opts.deploy) {
    steps.push({ name: "deploy", cmd: "pnpm", args: ["deploy-preview", slug], capture: true });
  }
  return steps;
}

/**
 * deploy-preview prints the keyed link last. Takes the last `.vercel.app`
 * line (earlier output, e.g. `vercel link`, may mention other hosts) and
 * returns it with and without its query: verify-live must hit the bare URL,
 * or the `?key=` would let it in and the 401 check would fail.
 */
export function deployUrlFromOutput(output: string): { keyed: string; bare: string } {
  const line = output
    .split("\n")
    .filter((l) => l.includes(".vercel.app"))
    .at(-1);
  if (!line) throw new Error("deploy-preview printed no deployment URL — see its output above.");
  const keyed = extractDeployUrl(line);
  const bare = new URL(keyed);
  bare.search = "";
  return { keyed, bare: bare.toString() };
}

const fmt = (s: Step | { cmd: string; args: string[] }) =>
  [s.cmd, ...s.args.map((a) => (/[\s"'$]/.test(a) ? JSON.stringify(a) : a))].join(" ");

function closingNotes(input: PipelineInput, log: (l: string) => void): void {
  if (input.todos.length > 0) {
    log("\nTODO before go-live (stubbed or defaulted by leadToConfig):");
    for (const t of input.todos) log(`  - ${t}`);
  }
  log(
    "\nBefore sending a link: set business.phone to the lead's real number for the deploy, and keep it out of the commit (runbook pre-send step, ops#27).",
  );
  log("Nothing was committed: review the new app, the README roster and pnpm-lock.yaml before committing.");
}

export async function runLeadToPreview(
  input: PipelineInput,
  opts: PipelineOptions,
  deps: PipelineDeps,
): Promise<PipelineResult> {
  const { log } = deps;
  const appExists = deps.appExists(input.slug);

  if (opts.dryRun) {
    const steps = planSteps(input, { ...opts, appExists, configPath: "<temp config.json>" });
    log(`Plan for ${input.slug}${input.leadId ? ` (lead ${input.leadId})` : ""} — dry run, nothing executed:`);
    for (const s of steps) log(`  ${s.name.padEnd(13)} ${fmt(s)}`);
    if (opts.deploy) log(`  ${"verify-gated".padEnd(13)} pnpm verify-live <deployment url> --expect-gated`);
    return { ok: true };
  }

  const temp = deps.writeTempConfig(JSON.stringify(input.config, null, 2));
  try {
    const steps = planSteps(input, { ...opts, appExists, configPath: temp.path });
    let deployOutput = "";
    for (const step of steps) {
      log(`\n→ [${step.name}] ${fmt(step)}`);
      const res = deps.run(step.cmd, step.args, { capture: Boolean(step.capture) });
      if (step.capture) log(res.stdout);
      if (res.status !== 0) {
        if (res.stderr) log(res.stderr);
        log(`\n✖ Step "${step.name}" failed — fix the error above, then re-run this command.`);
        return { ok: false, failedStep: step.name };
      }
      if (step.name === "deploy") deployOutput = res.stdout;
    }

    if (!opts.deploy) {
      log(`\n✓ ${input.slug} builds green. Deploying is a deliberate human step — when ready, re-run with --deploy:`);
      log(`\n  pnpm lead-to-preview <same input> --deploy\n`);
      log(`  (or: pnpm deploy-preview ${input.slug}, then pnpm verify-live <deployment url> --expect-gated)`);
      closingNotes(input, log);
      return { ok: true };
    }

    let urls: { keyed: string; bare: string };
    try {
      urls = deployUrlFromOutput(deployOutput);
    } catch (err) {
      log(`\n✖ ${(err as Error).message}`);
      return { ok: false, failedStep: "deploy" };
    }

    const verify = { cmd: "pnpm", args: ["verify-live", urls.bare, "--expect-gated"] };
    for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
      log(`\n→ [verify-gated] ${fmt(verify)} (attempt ${attempt}/${VERIFY_ATTEMPTS})`);
      const res = deps.run(verify.cmd, verify.args, { capture: false });
      if (res.status === 0) {
        log(`\n✓ Gated preview deployed and proven closed without the key. Send this link:\n\n  ${urls.keyed}\n`);
        closingNotes(input, log);
        return { ok: true, previewLink: urls.keyed };
      }
      if (attempt < VERIFY_ATTEMPTS) await deps.sleep(VERIFY_WAIT_MS);
    }
    log(
      `\n✖ verify-live --expect-gated failed ${VERIFY_ATTEMPTS}x on ${urls.bare}. Do NOT send the link. ` +
        "If deploy-preview printed a Deployment Protection deep link, disable it there and re-run.",
    );
    return { ok: false, failedStep: "verify-gated" };
  } finally {
    temp.cleanup();
  }
}

const defaultDeps: PipelineDeps = {
  run: (cmd, args, { capture }) => {
    const res = spawnSync(cmd, args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    });
    return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
  },
  appExists: (slug) => existsSync(resolve(ROOT, "apps", slug)),
  writeTempConfig: (json) => {
    // The config can carry a lead's real phone/email: owner-only, removed after the run.
    const dir = mkdtempSync(join(tmpdir(), "lead-to-preview-"));
    const path = join(dir, "config.json");
    writeFileSync(path, json, { mode: 0o600 });
    return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  log: (line) => console.log(line),
};

const USAGE =
  "Usage: pnpm lead-to-preview (--lead <lead.json> | --render <render.json>) [--deploy] [--dry-run] [--force]";

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isMain()) {
  const argv = process.argv.slice(2);
  const valueOf = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const leadFile = valueOf("--lead");
  const renderFile = valueOf("--render");
  if (!leadFile && !renderFile) die(USAGE);
  if (leadFile && renderFile) die(`Pass exactly one of --lead or --render.\n  ${USAGE}`);

  const kind = leadFile ? "lead" : "render";
  const file = (leadFile ?? renderFile)!;
  let input: PipelineInput;
  try {
    input = parseInput(kind, readFileSync(resolve(file), "utf8"));
  } catch (err) {
    die((err as Error).message);
  }

  const result = await runLeadToPreview(
    input,
    { deploy: argv.includes("--deploy"), force: argv.includes("--force"), dryRun: argv.includes("--dry-run") },
    defaultDeps,
  );
  process.exit(result.ok ? 0 : 1);
}
