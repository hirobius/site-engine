// check-state-surfaces (site-engine#229, ported from hirobius/hds@511209ab527b67a1b68765f0b3122983dc8671a1).
// Seams under test, each observed from outside:
//   1. checkStateSurfaces({ root, today }) -> { violations, ok }   (the rules)
//   2. the CLI in fixture mode (FIXTURE_DIR)
//   3. the committed docs/state-surfaces.json against this repo
// Every rule is driven through a throwaway repo built on disk, so the tests
// name the behaviour (what the gate reports), never the gate's internals.
import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkStateSurfaces } from "./check-state-surfaces.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/check-state-surfaces.ts");
const TODAY = "2026-10-12";

const temps: string[] = [];
afterEach(() => {
  while (temps.length) rmSync(temps.pop() as string, { recursive: true, force: true });
});

type Surface = Record<string, unknown>;

/** A repo on disk: `files` maps path -> text; `surfaces` is the registry. */
function repo(files: Record<string, string>, surfaces: Surface[], extra: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), "state-surfaces-"));
  temps.push(root);
  const put = (rel: string, text: string) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  for (const [rel, text] of Object.entries(files)) put(rel, text);
  put("docs/state-surfaces.json", JSON.stringify({ surfaces, ...extra }, null, 2));
  return root;
}
const rules = (root: string, today = TODAY) =>
  checkStateSurfaces({ root, today }).violations.map((v) => v.rule);

const generated = (path: string, by = "scripts/gen.ts"): Surface => ({
  path,
  describes: "x",
  kind: "generated",
  by,
});
const editorial = (path: string, reviewedAt: string, maxAgeDays = 90): Surface => ({
  path,
  describes: "x",
  kind: "editorial",
  owner: "Adrian",
  reviewedAt,
  maxAgeDays,
});

describe("registered paths exist", () => {
  it("passes when every registered path exists", () => {
    const root = repo({ "a.json": "{}", "scripts/gen.ts": "" }, [generated("a.json")]);
    expect(rules(root)).toEqual([]);
  });

  it("fails a registered file that is gone, naming it", () => {
    const root = repo({ "scripts/gen.ts": "" }, [generated("gone.json")]);
    const { violations, ok } = checkStateSurfaces({ root, today: TODAY });
    expect(ok).toBe(false);
    expect(violations.map((v) => [v.rule, v.file])).toEqual([["SURFACE_MISSING", "gone.json"]]);
  });

  it("accepts a directory as a surface", () => {
    const root = repo({ "docs/agents/a.md": "# a\n", "scripts/gen.ts": "" }, [
      editorial("docs/agents", "2026-10-01"),
    ]);
    expect(rules(root)).toEqual([]);
  });
});

describe("registry shape", () => {
  it("fails an unknown kind", () => {
    const root = repo({ "a.md": "" }, [{ path: "a.md", describes: "x", kind: "vibes" }]);
    expect(rules(root)).toContain("REGISTRY_INVALID");
  });

  it("requires generated and checked entries to name their generator or check", () => {
    const root = repo({ "a.json": "{}" }, [{ path: "a.json", describes: "x", kind: "generated" }]);
    expect(rules(root)).toContain("REGISTRY_INVALID");
    const checked = repo({ "a.json": "{}" }, [{ path: "a.json", describes: "x", kind: "checked" }]);
    expect(rules(checked)).toContain("REGISTRY_INVALID");
  });

  it("requires editorial entries to carry owner, reviewedAt and maxAgeDays", () => {
    const root = repo({ "a.md": "" }, [{ path: "a.md", describes: "x", kind: "editorial" }]);
    expect(rules(root)).toContain("REGISTRY_INVALID");
  });

  it("rejects a reviewedAt that is not a calendar day", () => {
    const root = repo({ "a.md": "" }, [editorial("a.md", "2026-02-30")]);
    expect(rules(root)).toContain("REGISTRY_INVALID");
  });

  it("fails a registry file that is not there, with the fix", () => {
    const root = mkdtempSync(join(tmpdir(), "state-surfaces-"));
    temps.push(root);
    const { violations } = checkStateSurfaces({ root, today: TODAY });
    expect(violations.map((v) => v.rule)).toEqual(["REGISTRY_MISSING"]);
  });
});

describe("the generator or check a surface names", () => {
  it("fails a generator script that does not exist", () => {
    const root = repo({ "a.json": "{}" }, [generated("a.json", "scripts/nope.ts")]);
    expect(rules(root)).toEqual(["BY_MISSING"]);
  });

  it("accepts a `by` that is a command rather than a path", () => {
    const root = repo({ "a.json": "{}" }, [generated("a.json", "changesets (pnpm changeset:version)")]);
    expect(rules(root)).toEqual([]);
  });
});

describe("editorial review age", () => {
  it("passes a surface reviewed inside its max age", () => {
    const root = repo({ "a.md": "" }, [editorial("a.md", "2026-09-01", 90)]);
    expect(rules(root)).toEqual([]);
  });

  it("passes on the last day of the window", () => {
    // 2026-07-14 + 90 days = 2026-10-12
    const root = repo({ "a.md": "" }, [editorial("a.md", "2026-07-14", 90)]);
    expect(rules(root)).toEqual([]);
  });

  it("fails the day after, with 'review due' and the owner", () => {
    const root = repo({ "a.md": "" }, [editorial("a.md", "2026-07-13", 90)]);
    const { violations } = checkStateSurfaces({ root, today: TODAY });
    expect(violations.map((v) => v.rule)).toEqual(["REVIEW_DUE"]);
    expect(violations[0].message).toContain("review due");
    expect(violations[0].message).toContain("Adrian");
  });

  it("does not age generated or checked surfaces", () => {
    const root = repo({ "a.json": "{}", "scripts/gen.ts": "" }, [
      { ...generated("a.json"), reviewedAt: "2020-01-01", maxAgeDays: 1 },
    ]);
    expect(rules(root)).toEqual([]);
  });
});

describe("dead path references in registered markdown", () => {
  const doc = (body: string) =>
    repo({ "README.md": body, "real/file.md": "", "scripts/gen.ts": "" }, [
      editorial("README.md", "2026-10-01"),
    ]);

  it("passes backticked paths and link targets that resolve", () => {
    expect(rules(doc("See `real/file.md` and [it](real/file.md#top).\n"))).toEqual([]);
  });

  it("fails a backticked repo path that does not exist, with file and line", () => {
    const { violations } = checkStateSurfaces({
      root: doc("Intro.\n\nSee `real/gone.md`.\n"),
      today: TODAY,
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ rule: "DEAD_REFERENCE", file: "README.md", line: 3 });
    expect(violations[0].message).toContain("real/gone.md");
  });

  it("fails a link target that does not exist", () => {
    expect(rules(doc("[x](real/gone.md)\n"))).toEqual(["DEAD_REFERENCE"]);
  });

  it("resolves a link relative to the file that holds it", () => {
    const root = repo(
      { "docs/a.md": "[b](b.md) and [c](../real/file.md)\n", "docs/b.md": "", "real/file.md": "" },
      [editorial("docs/a.md", "2026-10-01")],
    );
    expect(rules(root)).toEqual([]);
  });

  it("ignores URLs, anchors, mailto, globs, placeholders, and absolute or home paths", () => {
    const body = [
      "[a](https://example.com/x.md) [b](#top) [c](mailto:a@b.co)",
      "`docs/*.md` `fixtures/<id>/x.json` `${HOME}/x/y.json` `~/x/y.json` `/etc/x/y.json`",
      "`@hirobius/schema/x.json` `https://example.com/a/b.json`",
    ].join("\n");
    expect(rules(doc(body))).toEqual([]);
  });

  it("ignores fenced code blocks", () => {
    expect(rules(doc("```\ncat real/gone.md\n```\n"))).toEqual([]);
  });

  it("ignores a path under an ignoreReferences prefix the registry declares", () => {
    const root = repo(
      { "README.md": "Build writes `dist/index.js`.\n" },
      [editorial("README.md", "2026-10-01")],
      { ignoreReferences: ["dist/"] },
    );
    expect(rules(root)).toEqual([]);
  });

  it("treats a path the repo gitignores as present (build output a clean checkout lacks)", () => {
    const root = repo(
      {
        "README.md": "Build writes `out/model.json` and `out/deep/x.js`; `other/gone.md` is dead.\n",
        ".gitignore": "out/\n",
      },
      [editorial("README.md", "2026-10-01")],
    );
    execFileSync("git", ["init", "-q"], { cwd: root });
    const { violations } = checkStateSurfaces({ root, today: TODAY });
    expect(violations.map((v) => v.message).join("\n")).not.toContain("out/");
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("other/gone.md");
  });

  it("still honours .gitignore when another reference points outside the repo (../x)", () => {
    const root = repo(
      { "README.md": "Build writes `out/model.json`; see also `../elsewhere/x.md`.\n", ".gitignore": "out/\n" },
      [editorial("README.md", "2026-10-01")],
    );
    execFileSync("git", ["init", "-q"], { cwd: root });
    const { violations } = checkStateSurfaces({ root, today: TODAY });
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("../elsewhere/x.md");
  });

  it("strips a :line or #anchor suffix before resolving", () => {
    expect(rules(doc("`real/file.md:12` and `real/file.md#sec`\n"))).toEqual([]);
  });

  it("scans README, CLAUDE, CONTRIBUTING and AGENTS even when unregistered", () => {
    const root = repo(
      { "CLAUDE.md": "See `docs/gone.md`.\n", "a.json": "{}", "scripts/gen.ts": "" },
      [generated("a.json")],
    );
    expect(rules(root)).toEqual(["DEAD_REFERENCE"]);
  });

  it("scans the markdown inside a registered directory", () => {
    const root = repo({ "docs/agents/a.md": "See `docs/gone.md`.\n" }, [
      editorial("docs/agents", "2026-10-01"),
    ]);
    expect(rules(root)).toEqual(["DEAD_REFERENCE"]);
  });

  it("does not scan generated markdown (its generator owns the text)", () => {
    const root = repo({ "llms-full.md": "See `docs/gone.md`.\n", "scripts/gen.ts": "" }, [
      generated("llms-full.md"),
    ]);
    expect(rules(root)).toEqual([]);
  });
});

describe("derived facts in always-on agent files", () => {
  const always = (body: string) =>
    repo({ "CLAUDE.md": body, "scripts/gen.ts": "" }, [editorial("CLAUDE.md", "2026-10-01")], {
      alwaysOn: ["CLAUDE.md"],
    });
  const found = (body: string) => checkStateSurfaces({ root: always(body), today: TODAY }).violations;

  it("passes rules, read order and pointers", () => {
    expect(found("# Rules\n\nRead the runbook first. Never push to main (see ADR-0004, #229).\n")).toEqual([]);
  });

  it("flags a version string, naming file and line", () => {
    const [v] = found("Rules.\n\nThe repo is at 0.24.1 today.\n");
    expect(v).toMatchObject({ rule: "DERIVED_FACT", file: "CLAUDE.md", line: 3 });
    expect(v.message).toContain("0.24.1");
  });

  it("flags a hand-kept count", () => {
    expect(found("There are 11 apps and 81 tests.\n").map((v) => v.rule)).toEqual([
      "DERIVED_FACT",
      "DERIVED_FACT",
    ]);
  });

  it("does not flag a threshold a rule sets ('more than 50 files')", () => {
    expect(found("STOP if a fix touches more than 50 files, or at most 3 retries.\n")).toEqual([]);
  });

  it("flags a list of issue or PR numbers, but not a single citation", () => {
    expect(found("Open: #592, #593 and hds#601.\n").map((v) => v.rule)).toEqual(["DERIVED_FACT"]);
    expect(found("Gate added in hds#249.\n")).toEqual([]);
  });

  it("flags 'as of <date>' state, but not a provenance date in a heading", () => {
    expect(found("Roadmap as of 2026-10-12: all green.\n").map((v) => v.rule)).toEqual(["DERIVED_FACT"]);
    expect(found("## Skill protocol (2026-07-11)\n")).toEqual([]);
  });

  it("skips fenced code and files that are not always-on", () => {
    expect(found("```\nversion 1.2.3, 40 components\n```\n")).toEqual([]);
    const root = repo(
      { "README.md": "v 1.2.3 and 40 components\n", "CLAUDE.md": "Rules only.\n" },
      [editorial("README.md", "2026-10-01")],
      { alwaysOn: ["CLAUDE.md"] },
    );
    expect(checkStateSurfaces({ root, today: TODAY }).violations).toEqual([]);
  });

  it("fails an alwaysOn file that does not exist", () => {
    const root = repo({}, [], { alwaysOn: ["CLAUDE.md"] });
    expect(rules(root)).toEqual(["SURFACE_MISSING"]);
  });
});

describe("status.json shape (ADR-010 v2)", () => {
  const status = (obj: unknown) =>
    repo({ "status.json": JSON.stringify(obj) }, [editorial("status.json", "2026-10-01")], {
      statusFile: "status.json",
    });
  const good = {
    schemaVersion: 2,
    focus: "Ship the first paid client.",
    phase: "active",
    updatedAt: "2026-10-12T05:48:05Z",
  };

  it("passes a v2 status with an optional note", () => {
    expect(rules(status(good))).toEqual([]);
    expect(rules(status({ ...good, note: "State is derived." }))).toEqual([]);
  });

  it("fails a v1 status: hand-kept next, blocked and headline are derived state", () => {
    const { violations } = checkStateSurfaces({
      root: status({ ...good, schemaVersion: 1, headline: "x", next: [], blocked: [] }),
      today: TODAY,
    });
    expect(violations.every((v) => v.rule === "STATUS_SHAPE")).toBe(true);
    const text = violations.map((v) => v.message).join("\n");
    expect(text).toContain("schemaVersion");
    expect(text).toContain("next");
    expect(text).toContain("blocked");
    expect(text).toContain("headline");
  });

  it("fails a focus over 120 characters, a missing phase and a bad updatedAt", () => {
    expect(rules(status({ ...good, focus: "x".repeat(121) }))).toEqual(["STATUS_SHAPE"]);
    expect(rules(status({ ...good, phase: undefined }))).toEqual(["STATUS_SHAPE"]);
    expect(rules(status({ ...good, updatedAt: "yesterday" }))).toEqual(["STATUS_SHAPE"]);
  });

  it("fails when the declared status file is missing", () => {
    const root = repo({}, [], { statusFile: "status.json" });
    expect(rules(root)).toEqual(["STATUS_SHAPE"]);
  });
});

describe("every doc in a registerAll directory is classified", () => {
  it("fails a top-level doc no surface covers, and passes once it is registered", () => {
    const root = repo({ "docs/a.md": "", "docs/b.md": "" }, [editorial("docs/a.md", "2026-10-01")], {
      registerAll: ["docs"],
    });
    const { violations } = checkStateSurfaces({ root, today: TODAY });
    expect(violations.map((v) => [v.rule, v.file])).toEqual([["UNREGISTERED_DOC", "docs/b.md"]]);
  });

  it("counts a registered parent directory as covering what is inside it", () => {
    const root = repo({ "docs/adr/0001.md": "" }, [editorial("docs/adr", "2026-10-01")], {
      registerAll: ["docs", "docs/adr"],
    });
    expect(rules(root)).toEqual([]);
  });
});

describe("--run-checks", () => {
  it("runs a declared check command and fails the surface when it exits non-zero", () => {
    const entry = (check: string): Surface => ({ ...generated("a.json"), check });
    const bad = repo({ "a.json": "{}", "scripts/gen.ts": "" }, [entry('node -e "process.exit(3)"')]);
    const ran = checkStateSurfaces({ root: bad, today: TODAY, runChecks: true });
    expect(ran.violations.map((v) => v.rule)).toEqual(["GENERATED_STALE"]);
    const good = repo({ "a.json": "{}", "scripts/gen.ts": "" }, [entry('node -e "process.exit(0)"')]);
    expect(checkStateSurfaces({ root: good, today: TODAY, runChecks: true }).ok).toBe(true);
  });

  it("does not run declared checks by default", () => {
    const root = repo({ "a.json": "{}", "scripts/gen.ts": "" }, [
      { ...generated("a.json"), check: 'node -e "process.exit(3)"' },
    ]);
    expect(rules(root)).toEqual([]);
  });
});

describe("CLI", () => {
  const run = (args: string[] = [], env: Record<string, string> = {}) => {
    try {
      const stdout = execFileSync(process.execPath, ["--import", "tsx", SCRIPT, ...args], {
        cwd: ROOT,
        env: { ...process.env, ...env },
        encoding: "utf8",
        stdio: "pipe",
      });
      return { status: 0, stdout, stderr: "" };
    } catch (e) {
      const err = e as { status: number; stdout: string; stderr: string };
      return { status: err.status, stdout: err.stdout, stderr: err.stderr };
    }
  };

  it("exits 0 on a clean tree and 1 on a violating one, reading FIXTURE_DIR as the root", () => {
    const clean = repo({ "a.md": "" }, [editorial("a.md", "2099-01-01")]);
    expect(run([], { FIXTURE_DIR: clean }).status).toBe(0);
    const bad = repo({ "a.md": "" }, [editorial("a.md", "2000-01-01")]);
    const res = run([], { FIXTURE_DIR: bad });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("review due");
  });

  it("takes --root and --registry, so another repo can vendor it", () => {
    const root = repo({ "a.md": "" }, [editorial("a.md", "2099-01-01")]);
    mkdirSync(join(root, "meta"));
    writeFileSync(
      join(root, "meta/surfaces.json"),
      JSON.stringify({ surfaces: [editorial("a.md", "2099-01-01")] }),
    );
    expect(run(["--root", root, "--registry", "meta/surfaces.json"]).status).toBe(0);
    expect(run(["--root", root, "--registry", "meta/nope.json"]).status).toBe(1);
  });

  it("emits { violations, ok } with --json", () => {
    const bad = repo({}, [editorial("gone.md", "2099-01-01")]);
    const out = JSON.parse(run(["--root", bad, "--json"]).stdout);
    expect(out.ok).toBe(false);
    expect(out.violations[0].rule).toBe("SURFACE_MISSING");
  });
});

describe("committed fixtures prove the gate fires", () => {
  const fixture = (name: string) => join(ROOT, "scripts/fixtures/check-state-surfaces", name);
  it("passes the passing mini-root and fails the violating one for each rule it plants", () => {
    expect(checkStateSurfaces({ root: fixture("passing.example.d"), today: TODAY }).violations).toEqual([]);
    const found = rules(fixture("violating.example.d"));
    for (const rule of ["SURFACE_MISSING", "REVIEW_DUE", "DEAD_REFERENCE", "DERIVED_FACT"]) {
      expect(found).toContain(rule);
    }
  });
});

describe("this repo", () => {
  it("registers a state surface per kind and the committed tree passes the gate", () => {
    const result = checkStateSurfaces({ root: ROOT });
    expect(result.violations).toEqual([]);
    expect(Object.keys(result.summary.byKind).sort()).toEqual(["checked", "editorial", "generated"]);
  });
});
