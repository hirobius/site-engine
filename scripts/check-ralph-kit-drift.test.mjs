import { describe, it, expect, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "check-ralph-kit-drift.mjs");
const KIT = [
  "lib.sh",
  "next.sh",
  "run.sh",
  "loop.sh",
  "status.sh",
  "prompt.md",
];
const sha = (s) => createHash("sha256").update(s).digest("hex");

let cleanup = [];
afterEach(() => {
  for (const d of cleanup) rmSync(d, { recursive: true, force: true });
  cleanup = [];
});

// A scratch git repo holding ralph/<kit files> committed + a lock pinned to them.
function repo() {
  const dir = mkdtempSync(join(tmpdir(), "ralph-kit-drift-"));
  cleanup.push(dir);
  mkdirSync(join(dir, "ralph"));
  const files = {};
  for (const f of KIT) {
    writeFileSync(join(dir, "ralph", f), `kit ${f}\n`);
    files[f] = sha(`kit ${f}\n`);
  }
  writeFileSync(
    join(dir, "ralph", "kit.lock.json"),
    JSON.stringify({ ref: "hirobius/ralph@test", files }),
  );
  const git = (...a) => execFileSync("git", a, { cwd: dir, stdio: "pipe" });
  git("init", "-q");
  git("-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");
  return { dir, git };
}

function run(dir, args = []) {
  const r = spawnSync("node", [SCRIPT, ...args], {
    env: { ...process.env, RALPH_KIT_ROOT: dir },
    encoding: "utf8",
  });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

describe("check-ralph-kit-drift", () => {
  it("passes when every kit file equals the pinned hash", () => {
    const { dir } = repo();
    expect(run(dir).code).toBe(0);
  });

  it("fails an edited prompt.md when staged, naming the file and the fix", () => {
    const { dir, git } = repo();
    writeFileSync(join(dir, "ralph", "prompt.md"), "edited\n");
    git("add", "ralph/prompt.md");
    const r = run(dir, ["--staged"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("✗ ralph/prompt.md drifted from the vendored kit");
    expect(r.out).toContain("edit hirobius/ralph/kit instead");
    expect(r.out).toContain("--update");
  });

  it("names lib.sh with the same fix text (no repo-specific behind-note)", () => {
    const { dir, git } = repo();
    writeFileSync(join(dir, "ralph", "lib.sh"), "edited\n");
    git("add", "ralph/lib.sh");
    const r = run(dir, ["--staged"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("✗ ralph/lib.sh drifted");
    expect(r.out).not.toContain("behind");
  });

  it("ignores unstaged drift in --staged mode", () => {
    const { dir } = repo();
    writeFileSync(join(dir, "ralph", "prompt.md"), "edited but unstaged\n");
    const r = run(dir, ["--staged"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("nothing to check");
  });

  it("--update repins, after which the edited file passes", () => {
    const { dir } = repo();
    writeFileSync(join(dir, "ralph", "prompt.md"), "edited\n");
    expect(run(dir).code).toBe(1);
    expect(run(dir, ["--update"]).code).toBe(0);
    expect(run(dir).code).toBe(0);
    const lock = JSON.parse(
      readFileSync(join(dir, "ralph", "kit.lock.json"), "utf8"),
    );
    expect(lock.files["prompt.md"]).toBe(sha("edited\n"));
    expect(lock.ref).toBe("hirobius/ralph@test");
  });

  it("--report lists drifted lib.sh/next.sh and never blocks", () => {
    const { dir } = repo();
    writeFileSync(join(dir, "ralph", "lib.sh"), "ahead\n");
    writeFileSync(join(dir, "ralph", "next.sh"), "ahead\n");
    const r = run(dir, ["--report"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("ralph/lib.sh");
    expect(r.out).toContain("ralph/next.sh");
    expect(r.out).not.toContain("ralph/run.sh");
  });
});

// Outcome check: `pnpm test` (and so ralph-gate) fails when the vendored kit in
// this checkout no longer matches ralph/kit.lock.json. There is no pre-commit
// hook in this repo, so this is the wiring.
describe("this repo’s vendored kit", () => {
  it("matches ralph/kit.lock.json", () => {
    const r = spawnSync("node", [SCRIPT], { encoding: "utf8" });
    expect(r.stdout + r.stderr).toContain("match hirobius/ralph@");
    expect(r.status).toBe(0);
  });
});
