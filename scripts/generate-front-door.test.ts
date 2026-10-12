// generate-front-door (site-engine#229, idea from hirobius/hds#612
// scripts/generate-agents-md.mjs). Seams: readApps/buildRoster/buildScripts/buildFrontDoor
// for the generated text, expectedFiles() for splicing it into hand-written
// files (and building docs/DOCS-INDEX.md whole), and the CLI's --check for the
// drift gate.
import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOCS_INDEX_PATH,
  buildDocsIndex,
  buildFrontDoor,
  buildRoster,
  buildScripts,
  expectedFiles,
  readApps,
} from "./generate-front-door.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/generate-front-door.ts");

const temps: string[] = [];
afterEach(() => {
  while (temps.length) rmSync(temps.pop() as string, { recursive: true, force: true });
});

const config = (name: string) => `export const client = defineClient({\n  slug: "x",\n  business: {\n    name: "${name}",\n  },\n});\n`;
const START = (id: string) => `<!-- state:${id}:start -->`;
const END = (id: string) => `<!-- state:${id}:end -->`;

/** A small monorepo on disk with marked README.md and AGENTS.md. */
function mono(overrides: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), "front-door-"));
  temps.push(root);
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ scripts: { build: "turbo run build", "new-client": "tsx scripts/new-client.ts" } }),
    "apps/zeta-lawn/package.json": JSON.stringify({ name: "@hirobius/zeta-lawn" }),
    "apps/zeta-lawn/client.config.ts": config("Zeta Lawn & Co"),
    "apps/alpha-bespoke/package.json": JSON.stringify({ name: "@hirobius/alpha-bespoke" }),
    "apps/alpha-bespoke/client.config.ts": config("Alpha Bespoke"),
    "apps/alpha-bespoke/site-spec.ts": "export {};\n",
    "apps/_template/package.json": JSON.stringify({ name: "@hirobius/app-template" }),
    "apps/_template/client.config.ts": config("Stub Co"),
    "apps/not-an-app/readme.txt": "no package.json here\n",
    "docs/state-surfaces.json": JSON.stringify({
      alwaysOn: ["CLAUDE.md", "AGENTS.md"],
      surfaces: [
        { path: "README.md", section: "app roster", describes: "App roster", kind: "generated", by: "scripts/generate-front-door.ts" },
        { path: "docs/RUNBOOK.md", describes: "How to run a lead", kind: "editorial", owner: "Adrian", reviewedAt: "2026-10-12", maxAgeDays: 90 },
        { path: "docs/gate.json", describes: "A gated file", kind: "checked", by: "scripts/gate.ts" },
      ],
    }),
    "README.md": `# Repo\n\nIntro.\n\n${START("roster")}\nstale\n${END("roster")}\n\nMiddle prose.\n\n${START("scripts")}\nstale\n${END("scripts")}\n\nOutro.\n`,
    "AGENTS.md": `# Agents\n\nHand-written lane.\n\n${START("front-door")}\nstale\n${END("front-door")}\n\nRalph bar.\n`,
    ...overrides,
  };
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

const cli = (root: string, args: string[] = []) => {
  try {
    const stdout = execFileSync(process.execPath, ["--import", "tsx", SCRIPT, "--root", root, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "pipe",
    });
    return { status: 0, stdout, stderr: "" };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { status: err.status, stdout: err.stdout, stderr: err.stderr };
  }
};

describe("readApps", () => {
  it("lists every apps/* directory that has a package.json, sorted by slug", () => {
    expect(readApps(mono()).map((a) => a.slug)).toEqual(["_template", "alpha-bespoke", "zeta-lawn"]);
  });

  it("derives kind from the files: _ prefix is internal, site-spec.ts is bespoke, the rest config-only", () => {
    const kinds = Object.fromEntries(readApps(mono()).map((a) => [a.slug, a.kind]));
    expect(kinds).toEqual({ _template: "internal", "alpha-bespoke": "bespoke", "zeta-lawn": "config-only" });
  });

  it("reads the business name out of client.config.ts, and tolerates apps without one", () => {
    const root = mono({ "apps/_gallery/package.json": JSON.stringify({ name: "@hirobius/gallery" }) });
    const byslug = Object.fromEntries(readApps(root).map((a) => [a.slug, a.business]));
    expect(byslug["zeta-lawn"]).toBe("Zeta Lawn & Co");
    expect(byslug["_gallery"]).toBeNull();
  });
});

describe("readApps and test fixtures", () => {
  it("ignores zzz-* fixture apps, which tests scaffold and delete in parallel with this one", () => {
    const root = mono({
      "apps/zzz-ralph-newclient-fixture/package.json": JSON.stringify({ name: "@hirobius/zzz-ralph-newclient-fixture" }),
      // a copy caught half-written must not be read at all
      "apps/zzz-ralph-half-written/package.json": "{",
    });
    expect(readApps(root).map((a) => a.slug)).toEqual(["_template", "alpha-bespoke", "zeta-lawn"]);
  });
});

describe("buildRoster", () => {
  it("lists client sites before internal apps, one row each, naming the app path and business", () => {
    const text = buildRoster(readApps(mono()));
    const rows = text.split("\n").filter((l) => l.startsWith("| `apps/"));
    expect(rows.map((r) => r.match(/apps\/([\w-]+)/)?.[1])).toEqual(["alpha-bespoke", "zeta-lawn", "_template"]);
    expect(rows[1]).toContain("config-only");
    expect(rows[1]).toContain("Zeta Lawn & Co");
    expect(rows[0]).toContain("bespoke");
  });

  it("states no count, since the rows are the count", () => {
    expect(buildRoster(readApps(mono()))).not.toMatch(/\b\d+ (apps?|sites?)\b/i);
  });
});

describe("buildScripts", () => {
  it("lists every root package.json script with the command it runs", () => {
    const text = buildScripts({ build: "turbo run build", "new-client": "tsx scripts/new-client.ts" });
    expect(text).toContain("| `pnpm build` | `turbo run build` |");
    expect(text).toContain("| `pnpm new-client` | `tsx scripts/new-client.ts` |");
  });
});

describe("buildFrontDoor", () => {
  const registry = JSON.parse(readFileSync(join(mono(), "docs/state-surfaces.json"), "utf8"));

  it("gives the read order starting with the always-on files, in registry order", () => {
    const door = buildFrontDoor(registry);
    expect(door.indexOf("`CLAUDE.md`")).toBeGreaterThan(-1);
    expect(door.indexOf("`CLAUDE.md`")).toBeLessThan(door.indexOf("`AGENTS.md`"));
  });

  it("points live state at the ops dashboard's /ops/standing, naming no host, and copies none of it", () => {
    const door = buildFrontDoor(registry);
    expect(door).toContain("`/ops/standing`");
    expect(door).toContain("ops dashboard");
    expect(door).not.toMatch(/https?:\/\//);
    expect(door).not.toContain("vercel.app");
    expect(door).toContain("`status.json`");
    expect(door).not.toMatch(/\b\d+ (apps?|issues?|open)\b/i);
  });

  it("stays short and sends the full document index to the on-demand file", () => {
    const door = buildFrontDoor(registry);
    expect(door).toContain(`\`${DOCS_INDEX_PATH}\``);
    expect(DOCS_INDEX_PATH).toBe("docs/DOCS-INDEX.md");
    expect(door).not.toContain("### Generated");
    expect(door).not.toContain("How to run a lead");
    expect(door.split("\n").length).toBeLessThan(25);
  });
});

describe("buildDocsIndex", () => {
  const registry = JSON.parse(readFileSync(join(mono(), "docs/state-surfaces.json"), "utf8"));

  it("indexes every registered surface under its kind, in kind order", () => {
    const index = buildDocsIndex(registry);
    const gen = index.indexOf("## Generated");
    const chk = index.indexOf("## Checked");
    const edit = index.indexOf("## Editorial");
    expect(gen).toBeGreaterThan(-1);
    expect(gen).toBeLessThan(chk);
    expect(chk).toBeLessThan(edit);
    expect(index.slice(gen, chk)).toContain("`README.md` (app roster)");
    expect(index.slice(chk, edit)).toContain("`docs/gate.json`");
    expect(index.slice(edit)).toContain("`docs/RUNBOOK.md`");
    expect(index.slice(edit)).toContain("How to run a lead");
  });

  it("says it is generated and how to refresh it", () => {
    const index = buildDocsIndex(registry);
    expect(index).toContain("generate-front-door.ts");
    expect(index).toContain("pnpm state:generate");
  });
});

describe("expectedFiles", () => {
  it("replaces only the marked blocks and keeps the hand-written text byte for byte", () => {
    const out = expectedFiles(mono());
    const readme = out["README.md"];
    expect(readme.startsWith("# Repo\n\nIntro.\n\n")).toBe(true);
    expect(readme).toContain("\n\nMiddle prose.\n\n");
    expect(readme.endsWith("\n\nOutro.\n")).toBe(true);
    expect(readme).toContain("Zeta Lawn & Co");
    expect(readme).toContain("`pnpm new-client`");
    expect(readme).not.toContain("stale");
    expect(out["AGENTS.md"]).toContain("## Front door");
    expect(out["AGENTS.md"]).toContain("Ralph bar.");
  });

  it("keeps the app roster out of the always-on AGENTS.md: it lives in README.md only", () => {
    const out = expectedFiles(mono());
    expect(out["README.md"]).toContain("Zeta Lawn & Co");
    expect(out["AGENTS.md"]).not.toContain("Zeta Lawn & Co");
    expect(out["AGENTS.md"]).not.toContain("apps/zeta-lawn");
  });

  it("builds docs/DOCS-INDEX.md whole, from the registry", () => {
    const out = expectedFiles(mono());
    expect(out[DOCS_INDEX_PATH]).toContain("`docs/RUNBOOK.md`");
    expect(out[DOCS_INDEX_PATH]).toContain("pnpm state:generate");
  });

  it("is idempotent: generating from generated output changes nothing", () => {
    const root = mono();
    const once = expectedFiles(root);
    for (const [rel, text] of Object.entries(once)) writeFileSync(join(root, rel), text);
    expect(expectedFiles(root)).toEqual(once);
  });

  it("fails loud, naming file and block, when a marker pair is missing", () => {
    const root = mono({ "README.md": "# Repo\n" });
    expect(() => expectedFiles(root)).toThrow(/README\.md.*roster/s);
  });
});

describe("CLI", () => {
  it("--check exits 1 naming the stale file and the fix; a plain run writes; --check then exits 0", () => {
    const root = mono();
    const stale = cli(root, ["--check"]);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain("README.md");
    expect(stale.stderr).toContain("pnpm state:generate");
    expect(cli(root).status).toBe(0);
    expect(cli(root, ["--check"]).status).toBe(0);
    expect(readFileSync(join(root, "README.md"), "utf8")).toContain("Zeta Lawn & Co");
    expect(readFileSync(join(root, DOCS_INDEX_PATH), "utf8")).toContain("`docs/RUNBOOK.md`");
  });

  it("--check names docs/DOCS-INDEX.md when it is missing or hand-edited", () => {
    const root = mono();
    cli(root);
    writeFileSync(join(root, DOCS_INDEX_PATH), "hand edit\n");
    const res = cli(root, ["--check"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("docs/DOCS-INDEX.md");
    rmSync(join(root, DOCS_INDEX_PATH));
    expect(cli(root, ["--check"]).status).toBe(1);
  });

  it("--check catches a new app dropped into apps/", () => {
    const root = mono();
    cli(root);
    mkdirSync(join(root, "apps/new-one"), { recursive: true });
    writeFileSync(join(root, "apps/new-one/package.json"), JSON.stringify({ name: "@hirobius/new-one" }));
    const res = cli(root, ["--check"]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("README.md");
  });
});

describe("this repo", () => {
  it("has README.md and AGENTS.md in step with apps/*, package.json and the registry", () => {
    const want = expectedFiles(ROOT);
    for (const [rel, text] of Object.entries(want)) {
      expect(readFileSync(join(ROOT, rel), "utf8"), rel).toBe(text);
    }
  });
});
