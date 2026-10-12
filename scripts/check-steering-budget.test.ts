// check-steering-budget (site-engine#229, ported from hirobius/hds#612,
// itself ported from ops#292). Seams: evaluateBudget (the arithmetic) and the
// CLI, which reads docs/guardrails/steering-budget.json under FIXTURE_DIR (or
// the repo) and reports over-budget or missing files.
import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBudget } from "./check-steering-budget.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/check-steering-budget.ts");
const temps: string[] = [];
afterEach(() => {
  while (temps.length) rmSync(temps.pop() as string, { recursive: true, force: true });
});

function mini(files: Record<string, string>, manifest: unknown) {
  const root = mkdtempSync(join(tmpdir(), "steering-"));
  temps.push(root);
  for (const [rel, text] of Object.entries(files)) writeFileSync(join(root, rel), text);
  mkdirSync(join(root, "docs/guardrails"), { recursive: true });
  writeFileSync(join(root, "docs/guardrails/steering-budget.json"), JSON.stringify(manifest));
  return root;
}
const run = (root: string, args: string[] = []) => {
  try {
    const stdout = execFileSync(process.execPath, ["--import", "tsx", SCRIPT, ...args], {
      cwd: ROOT,
      env: { ...process.env, FIXTURE_DIR: root },
      encoding: "utf8",
      stdio: "pipe",
    });
    return { status: 0, stdout, stderr: "" };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { status: err.status, stdout: err.stdout, stderr: err.stderr };
  }
};

describe("evaluateBudget", () => {
  it("passes at exactly the budget", () => {
    expect(evaluateBudget({ maxTotalBytes: 10, sizes: { a: 4, b: 6 } })).toMatchObject({
      total: 10,
      over: 0,
      violations: [],
    });
  });

  it("fails one byte over, naming the largest file and the fix", () => {
    const { violations, over } = evaluateBudget({ maxTotalBytes: 10, sizes: { a: 4, b: 7 } });
    expect(over).toBe(1);
    expect(violations).toHaveLength(1);
    expect(violations[0].detail).toContain("Largest contributor: b");
    expect(violations[0].detail).toContain("on-demand");
  });

  it("fails a missing file", () => {
    const { violations } = evaluateBudget({ maxTotalBytes: 10, sizes: { a: null } });
    expect(violations[0].id).toBe("missing-a");
  });
});

describe("CLI", () => {
  it("exits 0 within budget and 1 over it", () => {
    const files = { "A.md": "x".repeat(100) };
    expect(run(mini(files, { maxTotalBytes: 100, files: ["A.md"] })).status).toBe(0);
    const over = run(mini(files, { maxTotalBytes: 99, files: ["A.md"] }));
    expect(over.status).toBe(1);
    expect(over.stderr).toContain("always-on agent context");
  });

  it("exits 1 for a listed file that is gone", () => {
    expect(run(mini({}, { maxTotalBytes: 100, files: ["A.md"] })).status).toBe(1);
  });

  it("emits { violations } with --json", () => {
    const res = run(mini({ "A.md": "xxxx" }, { maxTotalBytes: 1, files: ["A.md"] }), ["--json"]);
    expect(res.status).toBe(1);
    expect(JSON.parse(res.stdout).violations[0].id).toBe("steering-budget-exceeded");
  });
});

describe("committed fixtures prove the gate fires", () => {
  const fixture = (name: string) => join(ROOT, "scripts/fixtures/check-steering-budget", name);
  it("passes the passing mini-root and fails the violating one", () => {
    expect(run(fixture("passing.example.d")).status).toBe(0);
    expect(run(fixture("violating.example.d")).status).toBe(1);
  });
});

describe("this repo", () => {
  it("stays within its committed budget, and lists the same files as the state-surface alwaysOn", () => {
    expect(run(ROOT).status).toBe(0);
    const budget = JSON.parse(readFileSync(join(ROOT, "docs/guardrails/steering-budget.json"), "utf8"));
    const surfaces = JSON.parse(readFileSync(join(ROOT, "docs/state-surfaces.json"), "utf8"));
    expect([...budget.files].sort()).toEqual([...surfaces.alwaysOn].sort());
  });
});
