/**
 * ralph/test.sh + ralph/check-tests.sh — the consumer hooks for the kit's
 * red-first and tests-with-code checks (ops#504, ops#568). A fake `pnpm` on PATH
 * records what test.sh would run, so these tests need no install.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RALPH = resolve(dirname(fileURLToPath(import.meta.url)), "../ralph");

let dir;
const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8" });
const write = (root, rel, body) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
};
const commit = (root, files, msg = "c") => {
  for (const [rel, body] of Object.entries(files)) write(root, rel, body);
  git(root, "add", "-A");
  git(root, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", msg);
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ralph-hooks-"));
  const main = join(dir, "main");
  mkdirSync(join(main, "ralph"), { recursive: true });
  git(main, "init", "-q", "-b", "main");
  for (const f of ["test.sh", "check-tests.sh"]) {
    copyFileSync(join(RALPH, f), join(main, "ralph", f));
    chmodSync(join(main, "ralph", f), 0o755);
  }
  write(main, ".gitignore", "node_modules\n");
  mkdirSync(join(dir, "bin"));
  // Fake pnpm: logs "<cwd-relative-to-worktree> <args>"; `exec vitest` fails if FAKE_RED.
  write(
    dir,
    "bin/pnpm",
    '#!/usr/bin/env bash\necho "${PWD##*/wt}|$*" >> "$PNPM_LOG"\n[ "$1" = install ] && exit 0\n[ -z "$FAKE_RED" ]\n',
  );
  chmodSync(join(dir, "bin/pnpm"), 0o755);
  commit(main, { "packages/schema/src/a.ts": "export const a = 1;\n" }, "base");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

function worktreeAfter(files) {
  const main = join(dir, "main");
  commit(main, files, "test commit");
  const wt = join(dir, "wt");
  git(main, "worktree", "add", "-q", "--detach", wt, "HEAD");
  return wt;
}

function runTestSh(wt, env = {}) {
  const log = join(dir, "pnpm.log");
  const r = spawnSync("bash", [join(wt, "ralph/test.sh")], {
    cwd: wt,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${join(dir, "bin")}:${process.env.PATH}`,
      PNPM_LOG: log,
      FAKE_RED: "",
      ...env,
    },
  });
  const lines = existsSync(log)
    ? readFileSync(log, "utf8").trim().split("\n")
    : [];
  return { code: r.status, out: r.stdout + r.stderr, lines };
}

describe("ralph/test.sh", () => {
  it("installs, then runs only the commit’s vitest files from each owning package", () => {
    const wt = worktreeAfter({
      "packages/schema/src/new.test.ts": "x",
      "scripts/tool.test.ts": "x",
      "packages/schema/src/a.ts": "export const a = 2;\n",
    });
    const r = runTestSh(wt);
    expect(r.code).toBe(0);
    expect(r.lines[0]).toMatch(/\|install --frozen-lockfile/);
    expect(r.lines.slice(1)).toEqual([
      "/packages/schema|exec vitest run src/new.test.ts",
      "/scripts|exec vitest run tool.test.ts",
    ]);
  });

  it("exits non-zero (red) when the new test fails", () => {
    const wt = worktreeAfter({ "scripts/tool.test.ts": "x" });
    expect(runTestSh(wt, { FAKE_RED: "1" }).code).not.toBe(0);
  });

  it("skips Playwright *.spec.ts files and exits non-zero with nothing to judge", () => {
    const wt = worktreeAfter({
      "apps/demo-pressure-pros/tests/smoke.spec.ts": "x",
      "apps/_gallery/tests/visual.spec.ts": "x",
    });
    const r = runTestSh(wt);
    expect(r.code).not.toBe(0);
    expect(r.lines).toEqual([]);
    expect(r.out).toMatch(/no vitest test file/);
  });
});

describe("ralph/check-tests.sh", () => {
  const run = (base, head) => {
    const r = spawnSync(
      "bash",
      [join(dir, "main/ralph/check-tests.sh"), base, head],
      {
        cwd: join(dir, "main"),
        encoding: "utf8",
      },
    );
    return { code: r.status, out: r.stdout + r.stderr };
  };
  const branch = (files) => {
    const main = join(dir, "main");
    git(main, "checkout", "-q", "-b", "feat");
    commit(main, files, "feat");
    return run("main", "feat");
  };

  it("fails when factory source changes with no test", () => {
    const r = branch({ "packages/schema/src/a.ts": "export const a = 2;\n" });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/source changed without a test/);
  });

  it("passes when a test changes alongside the source", () => {
    expect(
      branch({
        "packages/schema/src/a.ts": "export const a = 2;\n",
        "packages/schema/src/a.test.ts": "x",
      }).code,
    ).toBe(0);
  });

  it("passes for a client config + photos change (data, validated by Zod at build)", () => {
    expect(
      branch({
        "apps/acme/client.config.ts": "export default {};\n",
        "apps/acme/public/og.txt": "x",
      }).code,
    ).toBe(0);
  });
});
