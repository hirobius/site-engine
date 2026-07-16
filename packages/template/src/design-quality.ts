/**
 * Design-quality gate — wraps `impeccable detect --json` (pbakaus/impeccable
 * v3, 46 deterministic anti-pattern rules: overused AI-default fonts,
 * bounce/elastic easing, layout-property animation, "AI slop" gradient/border
 * tells, WCAG contrast, cramped padding, etc. — no LLM, no API key) over the
 * shared visual surface in this package.
 *
 * Every section variant and every skin (`packages/schema/src/skins.ts`) is a
 * pin to a config key + a combination of components that live under
 * `packages/template/src` — skins don't ship their own markup. Scanning this
 * package once therefore covers the whole fleet's visual surface, closing the
 * gap ops#209 flagged ("impeccable is opt-in and wired to nothing that
 * fires") and mirroring hds's own `check-impeccable-detect.mjs` (hds#182).
 *
 * `impeccable` is pinned as an exact-version devDependency of this package
 * (see `package.json`) rather than invoked via a floating `npx impeccable@3`
 * — a "deterministic" gate that resolves a different tool version every run
 * isn't actually deterministic. The pinned binary lives in this package's own
 * `node_modules/.bin`, resolved relative to this source file (`IMPECCABLE_BIN`
 * below) so it works regardless of the caller's `cwd` (targets are resolved
 * against `cwd`; the binary is not).
 *
 * Still offline-safe: `detect` runs fully locally (jsdom + regex matching, no
 * network calls) once the workspace is `pnpm install`ed, which is required
 * infra everywhere this gate runs. If the binary isn't installed (fresh
 * checkout, no install) or the tool itself is unavailable, this resolves
 * `{ skipped: true, reason }` instead of throwing — `design-quality.test.ts`
 * turns that into a vitest dynamic `ctx.skip()` rather than a hard failure,
 * so a sandboxed/pre-install run never blocks on infra it can't reach.
 *
 * Deliberately async (spawn, not spawnSync): a long *synchronous*
 * child-process wait blocks the whole event loop — inside a vitest worker
 * that starves the worker's own RPC heartbeat to the main process
 * ("Timeout calling onTaskUpdate"), failing the suite even though the test
 * itself would have passed. Async spawn keeps the event loop free while
 * impeccable runs, so a slow-but-successful run never masquerades as a crash.
 *
 * Exemptions for deliberate design choices are impeccable's own inline
 * `// impeccable-disable-line <rule> -- <reason>` comments (honored by the
 * CLI itself, on by default), not a side allowlist — see `lib/theme.ts`'s
 * `FONT_HREFS` / `FONT_PAIRING_HREFS` for the exemptions this gate's first
 * run found and kept: Inter / Geist / Fraunces / Space Grotesk are
 * selectable `brand.font` / `brand.fontPairing` options a client site opts
 * into, not a default this engine imposes.
 */
import { spawn as nodeSpawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ImpeccableFinding {
  antipattern: string;
  name: string;
  description?: string;
  severity: string;
  file: string;
  line: number | null;
  snippet?: string;
}

export type DesignQualityResult =
  | { skipped: true; reason: string }
  | { skipped: false; findings: ImpeccableFinding[] };

/** Minimal surface of `ChildProcess` this module needs — small enough to fake in tests. */
export interface SpawnLike {
  stdout: { on(event: "data", listener: (chunk: Buffer | string) => void): void } | null;
  stderr: { on(event: "data", listener: (chunk: Buffer | string) => void): void } | null;
  on(event: "error", listener: (err: NodeJS.ErrnoException) => void): void;
  on(event: "close", listener: (code: number | null) => void): void;
  kill(): void;
}

export interface RunImpeccableOptions {
  /** Repo root — targets are resolved relative to this. */
  cwd: string;
  timeoutMs?: number;
  /** Injectable for tests; defaults to the real `node:child_process.spawn`. */
  spawn?: (command: string, args: string[], options: { cwd: string; shell: boolean }) => SpawnLike;
}

/**
 * Generous headroom for a cold run (jsdom parsing the whole scanned surface
 * under load). Exported so callers that wrap this in their own timeout (e.g.
 * design-quality.test.ts's real end-to-end test, which needs vitest's own
 * per-test timeout to exceed this) derive from one number instead of a
 * second, undocumented copy of the same assumption.
 */
export const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Absolute path to the `impeccable` binary installed as this package's own
 * pinned devDependency. Resolved relative to this source file rather than a
 * caller-supplied `cwd` — the caller's `cwd`/`targets` describe what to scan,
 * not where the tool itself lives, and `packages/template/node_modules/.bin`
 * is the one place pnpm actually places the symlink for a package-local
 * devDependency (it does not get hoisted to the workspace root).
 */
const IMPECCABLE_BIN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  ".bin",
  process.platform === "win32" ? "impeccable.cmd" : "impeccable",
);

/**
 * Adapts `node:child_process.spawn`'s real (heavily overloaded) type down to
 * the minimal `SpawnLike` surface this module actually reads. A plain return
 * statement lets TS check structural compatibility directly — `ChildProcess`
 * really does satisfy `SpawnLike` — without an `as unknown as` cast at the
 * call site, which would silently swallow a real mismatch.
 */
function defaultSpawn(command: string, args: string[], options: { cwd: string; shell: boolean }): SpawnLike {
  return nodeSpawn(command, args, options);
}

/**
 * Run the pinned local `impeccable detect --json <targets>` binary and
 * resolve its findings, or `{ skipped: true, reason }` when the tool is
 * unavailable. Never rejects — unavailability (not yet `pnpm install`ed, a
 * bad install, a timeout, an upstream contract change) is treated as "can't
 * run right now", not as design debt.
 */
export function runImpeccableDetect(
  targets: string[],
  options: RunImpeccableOptions,
): Promise<DesignQualityResult> {
  const { cwd, timeoutMs = DEFAULT_TIMEOUT_MS, spawn = defaultSpawn } = options;

  return new Promise((resolveResult) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const settle = (result: DesignQualityResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveResult(result);
    };

    let child: SpawnLike;
    try {
      child = spawn(IMPECCABLE_BIN, ["detect", "--json", ...targets], { cwd, shell: false });
    } catch (err) {
      settle({ skipped: true, reason: `impeccable failed to launch: ${(err as Error).message}` });
      return;
    }

    timer = setTimeout(() => {
      child.kill();
      settle({ skipped: true, reason: "impeccable timed out" });
    }, timeoutMs);

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      settle({ skipped: true, reason: `impeccable failed: ${err.message}` });
    });

    child.on("close", (status) => {
      // impeccable's own exit-code contract: 0 = clean, 2 = findings
      // (eslint-style). Anything else means the tool itself failed (missing
      // install, bad binary, corrupt output) — that's unavailability, not
      // debt.
      if (status !== 0 && status !== 2) {
        const firstErrLine = stderr.trim().split("\n")[0] || "no stderr";
        settle({ skipped: true, reason: `impeccable exited ${status ?? "null"}: ${firstErrLine}` });
        return;
      }

      let findings: unknown;
      try {
        findings = JSON.parse(stdout);
      } catch {
        settle({
          skipped: true,
          reason: "could not parse impeccable --json output (upstream contract changed?)",
        });
        return;
      }
      if (!Array.isArray(findings)) {
        settle({ skipped: true, reason: "unexpected impeccable --json shape (expected an array)" });
        return;
      }

      settle({ skipped: false, findings: findings as ImpeccableFinding[] });
    });
  });
}
