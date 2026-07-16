import { EventEmitter } from "node:events";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEOUT_MS,
  runImpeccableDetect,
  type ImpeccableFinding,
  type RunImpeccableOptions,
  type SpawnLike,
} from "./design-quality.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** Vitest's own test timeout must exceed runImpeccableDetect's internal
 *  timeout, or vitest would kill the test before the npx-unavailable skip
 *  path even gets a chance to fire. */
const REAL_SWEEP_TEST_TIMEOUT_MS = DEFAULT_TIMEOUT_MS + 10_000;

const FINDING: ImpeccableFinding = {
  antipattern: "overused-font",
  name: "Overused font",
  severity: "warning",
  file: "/abs/path/theme.ts",
  line: 16,
  snippet: "Google Fonts: inter",
};

/**
 * Fakes the minimal async ChildProcess surface `runImpeccableDetect` reads
 * (`SpawnLike`) — emits its scripted outcome on the next microtask, same as
 * a real child process reporting back asynchronously, so these tests also
 * exercise the async (non-blocking) contract, not just the final result.
 */
function fakeSpawn(outcome: {
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  launchError?: Error;
  spawnError?: NodeJS.ErrnoException;
}): NonNullable<RunImpeccableOptions["spawn"]> {
  return () => {
    if (outcome.launchError) throw outcome.launchError;

    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const child = new EventEmitter() as unknown as SpawnLike & EventEmitter;
    (child as unknown as { stdout: EventEmitter }).stdout = stdout;
    (child as unknown as { stderr: EventEmitter }).stderr = stderr;
    child.kill = () => {};

    queueMicrotask(() => {
      if (outcome.spawnError) {
        child.emit("error", outcome.spawnError);
        return;
      }
      if (outcome.stdout) stdout.emit("data", Buffer.from(outcome.stdout));
      if (outcome.stderr) stderr.emit("data", Buffer.from(outcome.stderr));
      child.emit("close", outcome.exitCode ?? 0);
    });

    return child;
  };
}

describe("runImpeccableDetect", () => {
  it("resolves findings on a clean run (exit 0)", async () => {
    const result = await runImpeccableDetect(["src"], { cwd: ROOT, spawn: fakeSpawn({ stdout: "[]\n", exitCode: 0 }) });
    expect(result).toEqual({ skipped: false, findings: [] });
  });

  it("resolves findings on a findings run (exit 2)", async () => {
    const result = await runImpeccableDetect(["src"], {
      cwd: ROOT,
      spawn: fakeSpawn({ stdout: JSON.stringify([FINDING]), exitCode: 2 }),
    });
    expect(result).toEqual({ skipped: false, findings: [FINDING] });
  });

  it("skips when npx can't even be launched", async () => {
    const result = await runImpeccableDetect(["src"], {
      cwd: ROOT,
      spawn: fakeSpawn({ launchError: Object.assign(new Error("spawn npx ENOENT"), { code: "ENOENT" }) }),
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toMatch(/npx failed to launch/);
  });

  it("skips when the spawned process errors (npx missing from PATH)", async () => {
    const result = await runImpeccableDetect(["src"], {
      cwd: ROOT,
      spawn: fakeSpawn({ spawnError: Object.assign(new Error("spawn npx ENOENT"), { code: "ENOENT" }) }),
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toMatch(/npx failed:/);
  });

  it("skips on an unexpected exit code (tool itself failed, not a clean/findings run)", async () => {
    const result = await runImpeccableDetect(["src"], {
      cwd: ROOT,
      spawn: fakeSpawn({ exitCode: 1, stderr: "network error: getaddrinfo ENOTFOUND registry.npmjs.org" }),
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toMatch(/impeccable exited 1/);
  });

  it("skips on unparseable JSON (upstream --json contract changed)", async () => {
    const result = await runImpeccableDetect(["src"], {
      cwd: ROOT,
      spawn: fakeSpawn({ stdout: "not json", exitCode: 0 }),
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toMatch(/could not parse/);
  });

  it("skips on a non-array JSON shape", async () => {
    const result = await runImpeccableDetect(["src"], {
      cwd: ROOT,
      spawn: fakeSpawn({ stdout: JSON.stringify({ findings: [] }), exitCode: 0 }),
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toMatch(/unexpected impeccable --json shape/);
  });

  it("times out (and kills the child) instead of hanging forever when npx never reports back", async () => {
    let killed = false;
    const spawn: NonNullable<RunImpeccableOptions["spawn"]> = () => {
      const child = new EventEmitter() as unknown as SpawnLike & EventEmitter;
      (child as unknown as { stdout: EventEmitter }).stdout = new EventEmitter();
      (child as unknown as { stderr: EventEmitter }).stderr = new EventEmitter();
      child.kill = () => {
        killed = true;
      };
      return child; // never emits close/error — simulates a hung npx
    };
    const result = await runImpeccableDetect(["src"], { cwd: ROOT, spawn, timeoutMs: 5 });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toMatch(/timed out/);
    expect(killed).toBe(true);
  });
});

/**
 * Real end-to-end sweep: runs the actual `npx impeccable@3 detect --json`
 * against the shared visual surface (see design-quality.ts's doc comment for
 * why `packages/template/src` covers every section variant + skin). Skips
 * gracefully — never fails the suite — when npx/network is unavailable, per
 * the offline-safe contract above. A long timeout covers the first-run npx
 * package fetch under load; `detect` itself is local and fast once fetched.
 */
describe("template design-quality sweep (real impeccable detect)", () => {
  it(
    "finds no design anti-patterns in packages/template/src",
    async (ctx) => {
      const result = await runImpeccableDetect(["packages/template/src"], { cwd: ROOT });
      if (result.skipped) {
        ctx.skip(`impeccable unavailable — ${result.reason}`);
        return;
      }
      const report = result.findings
        .map(
          (f) =>
            `  ${f.file}:${f.line ?? "?"}  [${f.antipattern}] ${f.name}${f.snippet ? `: ${f.snippet}` : ""}`,
        )
        .join("\n");
      expect(result.findings, `impeccable findings:\n${report}`).toEqual([]);
    },
    REAL_SWEEP_TEST_TIMEOUT_MS,
  );
});
