import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import { leadToConfig, type LeadRow } from "../packages/schema/src/lead-to-config.js";
import {
  deployUrlFromOutput,
  parseInput,
  planSteps,
  runLeadToPreview,
  type PipelineDeps,
  type RunResult,
} from "./lead-to-preview.js";

/**
 * `pnpm lead-to-preview` (spec #232, tickets #233/#234). Every test drives the
 * pipeline through a fake runner: no test ever spawns `vercel`, `pnpm`, or
 * touches the network. The Vercel boundary is the `deploy-preview` subprocess,
 * and the fake runner stands in for it.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TSX = resolve(ROOT, "node_modules/.bin/tsx");
const CLI = resolve(ROOT, "scripts/lead-to-preview.ts");

/** Synthetic lead: every identifying field is invented (see render-site.test.ts). */
const LEAD: LeadRow = {
  name: "Example Suds of Tacoma",
  slug: "example-suds-of-tacoma",
  category: "Pressure washing service",
  city: "Tacoma",
  region: "WA",
  phone: "(253) 555-0142",
  email: "info@examplesuds.invalid",
  serviceArea: ["Tacoma, WA"],
};

function renderPayload(overrides: Record<string, unknown> = {}): string {
  const { config } = leadToConfig(LEAD);
  return JSON.stringify({ lead_id: "lead-123", slug: LEAD.slug, config, ...overrides });
}

const DEPLOY_OUTPUT = [
  "→ Deploying to Vercel preview (never production)...",
  "✓ with key — status 200",
  "",
  "✓ Gated preview ready and verified:",
  "",
  "  https://hirobius-example-suds-abc123.vercel.app/?key=deadbeef",
  "",
].join("\n");

const ok = (stdout = ""): RunResult => ({ status: 0, stdout, stderr: "" });

/** Fake deps: records every command, never touches disk or network. */
function fakeDeps(opts: { appExists?: boolean; results?: Record<string, RunResult[]> } = {}) {
  const calls: string[][] = [];
  const queues = new Map(Object.entries(opts.results ?? {}).map(([k, v]) => [k, [...v]]));
  const cleanup = vi.fn();
  const deps: PipelineDeps = {
    run: vi.fn((cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      const key = args.find((a) => ["new-client", "install", "render-site", "check", "build", "deploy-preview", "verify-live"].includes(a)) ?? "";
      const queue = queues.get(key);
      return queue && queue.length > 0 ? queue.shift()! : key === "deploy-preview" ? ok(DEPLOY_OUTPUT) : ok();
    }),
    appExists: () => opts.appExists ?? false,
    writeTempConfig: vi.fn(() => ({ path: "/tmp/ltp-x/config.json", cleanup })),
    sleep: vi.fn(async () => undefined),
    log: () => undefined,
  };
  return { deps, calls, cleanup };
}

const commandNames = (calls: string[][]) => calls.map((c) => c.slice(1).filter((a) => !a.startsWith("@")).slice(0, 2).join(" "));

describe("parseInput", () => {
  it("maps a raw lead through leadToConfig and keeps its TODOs", () => {
    const input = parseInput("lead", JSON.stringify(LEAD));
    expect(input.slug).toBe("example-suds-of-tacoma");
    expect(input.name).toBe("Example Suds of Tacoma");
    expect(input.preset).toBe("pressure-washing");
    expect(input.todos.join("\n")).toMatch(/form\.accessKey/);
  });

  it("accepts an ops render payload { slug, config, lead_id }", () => {
    const input = parseInput("render", renderPayload());
    expect(input.slug).toBe(LEAD.slug);
    expect(input.name).toBe(LEAD.name);
    expect(input.preset).toBe("pressure-washing");
    expect(input.leadId).toBe("lead-123");
  });

  it("rejects invalid JSON with a readable error", () => {
    expect(() => parseInput("render", "{nope")).toThrow(/not valid JSON/);
  });

  it("rejects a slug that is not kebab-case (no path or argv built from it)", () => {
    expect(() => parseInput("render", renderPayload({ slug: "../evil" }))).toThrow(/kebab-case/);
    expect(() => parseInput("lead", JSON.stringify({ ...LEAD, slug: "Bad Slug" }))).toThrow(/kebab-case/);
  });

  it("rejects a render payload whose config.slug differs from its slug", () => {
    expect(() => parseInput("render", renderPayload({ slug: "other-business" }))).toThrow(/does not match/);
  });

  it("rejects a render payload with no config object", () => {
    expect(() => parseInput("render", JSON.stringify({ slug: "x-y" }))).toThrow(/config/);
  });

  it("rejects a business name that new-client would parse as a flag or a replace pattern", () => {
    expect(() => parseInput("lead", JSON.stringify({ ...LEAD, name: "--bespoke" }))).toThrow(/name/);
    expect(() => parseInput("lead", JSON.stringify({ ...LEAD, name: "Cash $& Carry" }))).toThrow(/name/);
  });

  it("rejects an unknown palette preset", () => {
    const { config } = leadToConfig(LEAD);
    const bad = { ...config, brand: { ...config.brand, palettePreset: "plumbing" } };
    expect(() => parseInput("render", JSON.stringify({ slug: LEAD.slug, config: bad }))).toThrow(/preset/);
  });
});

describe("planSteps", () => {
  const input = parseInput("lead", JSON.stringify(LEAD));
  const base = { configPath: "/tmp/c.json", appExists: false, deploy: false, force: false };

  it("runs scaffold → install → render → check → build, with every value as its own argv entry", () => {
    const steps = planSteps(input, base);
    expect(steps.map((s) => s.name)).toEqual(["scaffold", "install", "render", "check", "build"]);
    expect(steps[0]!.args).toEqual(["new-client", LEAD.slug, "--name", LEAD.name, "--preset", "pressure-washing"]);
    expect(steps[2]!.args).toEqual(["render-site", LEAD.slug, "--config", "/tmp/c.json"]);
    expect(steps[3]!.args).toEqual(["--filter", `@hirobius/${LEAD.slug}`, "check"]);
    expect(steps[4]!.args).toEqual(["--filter", `@hirobius/${LEAD.slug}`, "build"]);
    expect(steps.every((s) => s.cmd === "pnpm")).toBe(true);
  });

  it("has no deploy step unless deploy is explicitly on", () => {
    expect(planSteps(input, base).some((s) => s.args.includes("deploy-preview"))).toBe(false);
    const withDeploy = planSteps(input, { ...base, deploy: true });
    expect(withDeploy.at(-1)!.name).toBe("deploy");
    expect(withDeploy.at(-1)!.args).toEqual(["deploy-preview", LEAD.slug]);
  });

  it("never passes --prod anywhere", () => {
    const all = planSteps(input, { ...base, deploy: true, force: true }).flatMap((s) => s.args);
    expect(all).not.toContain("--prod");
  });

  it("skips scaffold when apps/<slug> already exists", () => {
    expect(planSteps(input, { ...base, appExists: true }).map((s) => s.name)).toEqual([
      "install",
      "render",
      "check",
      "build",
    ]);
  });

  it("passes --force to render-site only when the operator asked for it", () => {
    const render = (force: boolean) => planSteps(input, { ...base, force }).find((s) => s.name === "render")!;
    expect(render(false).args).not.toContain("--force");
    expect(render(true).args).toContain("--force");
  });
});

describe("deployUrlFromOutput", () => {
  it("takes the last .vercel.app link deploy-preview printed and strips ?key=", () => {
    const out = "Linked to https://hirobius-x-old.vercel.app\n" + DEPLOY_OUTPUT;
    expect(deployUrlFromOutput(out)).toEqual({
      keyed: "https://hirobius-example-suds-abc123.vercel.app/?key=deadbeef",
      bare: "https://hirobius-example-suds-abc123.vercel.app/",
    });
  });

  it("throws a readable error when no deployment URL was printed", () => {
    expect(() => deployUrlFromOutput("✖ VERCEL_TOKEN is not set")).toThrow(/deployment URL/);
  });
});

describe("runLeadToPreview", () => {
  const input = parseInput("lead", JSON.stringify(LEAD));

  it("without --deploy: builds, never invokes deploy-preview or verify-live, and hands off the next command", async () => {
    const { deps, calls } = fakeDeps();
    const lines: string[] = [];
    deps.log = (l) => lines.push(l);
    const res = await runLeadToPreview(input, { deploy: false, force: false, dryRun: false }, deps);
    expect(res.ok).toBe(true);
    expect(commandNames(calls)).toEqual([
      `new-client ${LEAD.slug}`,
      "install",
      `render-site ${LEAD.slug}`,
      "--filter check",
      "--filter build",
    ]);
    expect(calls.flat()).not.toContain("deploy-preview");
    expect(calls.flat()).not.toContain("verify-live");
    const out = lines.join("\n");
    expect(out).toContain(`--deploy`);
    expect(out).toMatch(/form\.accessKey/); // leadToConfig TODOs surfaced
    expect(out).toMatch(/business\.phone/); // phone pre-send reminder (ops#27)
  });

  it("with --deploy: deploys, then verifies the key-stripped URL with --expect-gated", async () => {
    const { deps, calls } = fakeDeps();
    const res = await runLeadToPreview(input, { deploy: true, force: false, dryRun: false }, deps);
    expect(res.ok).toBe(true);
    expect(calls.at(-2)).toEqual(["pnpm", "deploy-preview", LEAD.slug]);
    expect(calls.at(-1)).toEqual([
      "pnpm",
      "verify-live",
      "https://hirobius-example-suds-abc123.vercel.app/",
      "--expect-gated",
    ]);
    expect(res.previewLink).toBe("https://hirobius-example-suds-abc123.vercel.app/?key=deadbeef");
  });

  it("retries verify-live (deploys can still be propagating) and passes once it does", async () => {
    const fail: RunResult = { status: 1, stdout: "✖ home page returns 401 — status 404", stderr: "" };
    const { deps, calls } = fakeDeps({ results: { "verify-live": [fail, ok()] } });
    const res = await runLeadToPreview(input, { deploy: true, force: false, dryRun: false }, deps);
    expect(res.ok).toBe(true);
    expect(calls.filter((c) => c[1] === "verify-live")).toHaveLength(2);
    expect(deps.sleep).toHaveBeenCalledTimes(1);
  });

  it("fails the run, naming verify-gated, when the gate never proves closed", async () => {
    const fail: RunResult = { status: 1, stdout: "✖ home page returns 401 — status 200", stderr: "" };
    const { deps, calls } = fakeDeps({ results: { "verify-live": [fail, fail, fail] } });
    const res = await runLeadToPreview(input, { deploy: true, force: false, dryRun: false }, deps);
    expect(res).toMatchObject({ ok: false, failedStep: "verify-gated" });
    expect(calls.filter((c) => c[1] === "verify-live")).toHaveLength(3);
    expect(res.previewLink).toBeUndefined();
  });

  it("stops at the first failing step, names it, and runs nothing after it", async () => {
    const { deps, calls } = fakeDeps({ results: { check: [{ status: 1, stdout: "", stderr: "1 error" }] } });
    const res = await runLeadToPreview(input, { deploy: true, force: false, dryRun: false }, deps);
    expect(res).toMatchObject({ ok: false, failedStep: "check" });
    expect(calls.flat()).not.toContain("build");
    expect(calls.flat()).not.toContain("deploy-preview");
  });

  it("removes the temp config file even when a step fails", async () => {
    const { deps, cleanup } = fakeDeps({ results: { "render-site": [{ status: 1, stdout: "", stderr: "Zod" }] } });
    const res = await runLeadToPreview(input, { deploy: false, force: false, dryRun: false }, deps);
    expect(res.ok).toBe(false);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("writes the config the render step reads", async () => {
    const { deps, calls } = fakeDeps();
    await runLeadToPreview(input, { deploy: false, force: false, dryRun: false }, deps);
    const written = JSON.parse((deps.writeTempConfig as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
    expect(written.slug).toBe(LEAD.slug);
    expect(calls.find((c) => c[1] === "render-site")).toContain("/tmp/ltp-x/config.json");
  });

  it("--dry-run prints the plan and runs nothing (not even the scaffold)", async () => {
    const { deps } = fakeDeps();
    const lines: string[] = [];
    deps.log = (l) => lines.push(l);
    const res = await runLeadToPreview(input, { deploy: true, force: false, dryRun: true }, deps);
    expect(res.ok).toBe(true);
    expect(deps.run).not.toHaveBeenCalled();
    expect(deps.writeTempConfig).not.toHaveBeenCalled();
    const out = lines.join("\n");
    expect(out).toContain(`pnpm new-client ${LEAD.slug}`);
    expect(out).toContain(`pnpm deploy-preview ${LEAD.slug}`);
    expect(out).toContain("--expect-gated");
  });
});

describe("CLI", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ltp-cli-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  const cli = (args: string[]) => spawnSync(TSX, [CLI, ...args], { cwd: ROOT, encoding: "utf8" });

  it("exits 1 with usage when no input file is given", () => {
    const res = cli([]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/Usage: pnpm lead-to-preview/);
  });

  it("exits 1 when both --lead and --render are given", () => {
    const res = cli(["--lead", "a.json", "--render", "b.json"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/exactly one/);
  });

  it("exits 1 on a bad payload before running any step", () => {
    const file = join(tmp, "bad.json");
    writeFileSync(file, renderPayload({ slug: "Not Kebab" }));
    const res = cli(["--render", file, "--dry-run"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/kebab-case/);
  });

  it("--dry-run on a valid payload prints the plan with no side effects", () => {
    const file = join(tmp, "ok.json");
    writeFileSync(file, renderPayload());
    const res = cli(["--render", file, "--dry-run"]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(`pnpm new-client ${LEAD.slug}`);
    expect(res.stdout).not.toContain("deploy-preview"); // no --deploy given
  });
});
