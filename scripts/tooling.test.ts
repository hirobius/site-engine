import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PALETTE_PRESETS } from "../packages/schema/src/presets.js";
import { readVersion } from "./eject-client.js";

/**
 * Golden-path coverage for the two sanctioned scaffolding tools (CLAUDE.md rule
 * #1 / the handoff policy): `new-client` and `eject-client`. They had zero tests,
 * so a silent regression only surfaced when a human noticed a bad scaffold or a
 * broken handoff.
 *
 * These tests drive the real scripts as subprocesses (how `pnpm new-client` /
 * `pnpm eject-client` invoke them) and assert the deterministic contract:
 *   - new-client produces a clean, correctly-stubbed scaffold whose generated
 *     config PASSES `defineClient()` (executed through tsx),
 *   - eject-client produces a standalone folder with NO `workspace:*` deps and
 *     NO residual `@hirobius/*` import specifiers.
 *
 * A full `astro build` / isolated-`install` smoke ("builds standalone") is
 * deliberately NOT run here — it needs a network install of astro/tailwind/sharp
 * and minutes of wall-clock, which doesn't belong in the per-commit vitest gate.
 * That heavier smoke is flagged back on issue #54 as a separate CI job.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TSX = resolve(ROOT, "node_modules/.bin/tsx");
const NEW_CLIENT = resolve(ROOT, "scripts/new-client.ts");
const EJECT_CLIENT = resolve(ROOT, "scripts/eject-client.ts");

/** Distinctive throwaway slugs so cleanup + intent are unambiguous. */
const FIXTURE = "zzz-ralph-newclient-fixture";
const BAD_SLUG = "Zzz_Ralph_Bad";
const DUP_SLUG = "zzz-ralph-dup-fixture";
const PRESET_SLUG = "zzz-ralph-preset-fixture";
const BESPOKE_FIXTURE = "zzz-ralph-bespoke-fixture";
const BESPOKE_CONFLICT_SLUG = "zzz-ralph-bespoke-conflict-fixture";

const appDir = (slug: string) => resolve(ROOT, "apps", slug);

function run(script: string, args: string[]) {
  return spawnSync(TSX, [script, ...args], { cwd: ROOT, encoding: "utf8" });
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const tmpDirs: string[] = [];
function makeTmp(prefix: string) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

// new-client now registers a fleet entry per scaffold (issue #12). Snapshot +
// restore apps/_gallery/src/data/fleet.ts so these fixture slugs never leak
// into it — this suite drives the real script against the real repo.
const FLEET_PATH = resolve(ROOT, "apps/_gallery/src/data/fleet.ts");
const originalFleetSource = readFileSync(FLEET_PATH, "utf8");

afterAll(() => {
  for (const slug of [
    FIXTURE,
    BAD_SLUG.toLowerCase(),
    DUP_SLUG,
    PRESET_SLUG,
    BESPOKE_FIXTURE,
    BESPOKE_CONFLICT_SLUG,
  ]) {
    rmSync(appDir(slug), { recursive: true, force: true });
  }
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
  writeFileSync(FLEET_PATH, originalFleetSource);
});

describe("new-client", () => {
  beforeAll(() => {
    rmSync(appDir(FIXTURE), { recursive: true, force: true });
    const res = run(NEW_CLIENT, [FIXTURE, "--name", "Ralph Fixture Co", "--preset", "landscaping"]);
    expect(res.status, res.stderr).toBe(0);
  });

  it("creates apps/<slug> with the scoped package name", () => {
    expect(existsSync(appDir(FIXTURE))).toBe(true);
    const pkg = JSON.parse(readFileSync(resolve(appDir(FIXTURE), "package.json"), "utf8"));
    expect(pkg.name).toBe(`@hirobius/${FIXTURE}`);
  });

  it("stubs slug, name, preset, and a placeholder siteUrl into client.config.ts", () => {
    const cfg = readFileSync(resolve(appDir(FIXTURE), "client.config.ts"), "utf8");
    expect(cfg).toContain(`slug: "${FIXTURE}"`);
    expect(cfg).toContain(`name: "Ralph Fixture Co"`);
    expect(cfg).toContain(`palettePreset: "landscaping"`);
    expect(cfg).toContain(`siteUrl: "https://${FIXTURE}.example"`);
  });

  it("registers the new site in the _gallery fleet list (issue #12)", () => {
    const fleetSrc = readFileSync(FLEET_PATH, "utf8");
    const templateVersion = JSON.parse(
      readFileSync(resolve(ROOT, "packages/template/package.json"), "utf8"),
    ).version;
    expect(fleetSrc).toMatch(new RegExp(`slug: "${FIXTURE}"[\\s\\S]*?templateVersion: "${templateVersion}"`));
    expect(fleetSrc).toContain(`trade: "landscaping"`);
    expect(fleetSrc).toContain(`status: "preview"`);
  });

  it("copies a clean scaffold (no node_modules/dist/.astro/.turbo)", () => {
    for (const junk of ["node_modules", "dist", ".astro", ".turbo"]) {
      expect(existsSync(resolve(appDir(FIXTURE), junk)), junk).toBe(false);
    }
  });

  it("generates a brand-colored monogram favicon.svg (issue #106)", () => {
    const svg = readFileSync(resolve(appDir(FIXTURE), "public/favicon.svg"), "utf8");
    expect(svg).toContain(">R<"); // "Ralph Fixture Co" -> R
    expect(svg).toContain(`fill="${PALETTE_PRESETS.landscaping["--brand-primary"]}"`);
  });

  it("produces a config that PASSES defineClient()", () => {
    // The generated config imports the bare `@hirobius/schema` specifier, which
    // node resolves from the importing file's OWN location upward. Copy it into
    // a temp dir UNDER this package (which depends on @hirobius/schema), then
    // execute it through tsx: `defineClient` runs at module load and throws
    // (non-zero exit) on an invalid config.
    const probeDir = mkdtempSync(join(ROOT, "scripts", "ralph-probe-"));
    tmpDirs.push(probeDir);
    cpSync(resolve(appDir(FIXTURE), "client.config.ts"), resolve(probeDir, "gen.config.ts"));
    const probe = resolve(probeDir, "validate.ts");
    writeFileSync(
      probe,
      `import { client } from "./gen.config.ts";\n` +
        `console.log(JSON.stringify({ slug: client.slug, preset: client.brand.palettePreset }));\n`,
    );
    const res = spawnSync(TSX, [probe], { cwd: ROOT, encoding: "utf8" });
    expect(res.status, res.stderr).toBe(0);
    expect(JSON.parse(res.stdout.trim())).toEqual({ slug: FIXTURE, preset: "landscaping" });
  });

  it("rejects a non-kebab slug without creating a directory", () => {
    const res = run(NEW_CLIENT, [BAD_SLUG]);
    expect(res.status).not.toBe(0);
    expect(existsSync(appDir(BAD_SLUG.toLowerCase()))).toBe(false);
    expect(existsSync(appDir(BAD_SLUG))).toBe(false);
  });

  it("rejects an unknown preset without creating a directory", () => {
    const res = run(NEW_CLIENT, [PRESET_SLUG, "--preset", "teal-dream"]);
    expect(res.status).not.toBe(0);
    expect(existsSync(appDir(PRESET_SLUG))).toBe(false);
  });

  it("refuses to overwrite an existing app", () => {
    rmSync(appDir(DUP_SLUG), { recursive: true, force: true });
    expect(run(NEW_CLIENT, [DUP_SLUG]).status).toBe(0);
    const second = run(NEW_CLIENT, [DUP_SLUG]);
    expect(second.status).not.toBe(0);
    expect(second.stderr).toMatch(/already exists/);
  });
});

describe("new-client --bespoke (se#210)", () => {
  beforeAll(() => {
    rmSync(appDir(BESPOKE_FIXTURE), { recursive: true, force: true });
    const res = run(NEW_CLIENT, [BESPOKE_FIXTURE, "--bespoke", "--name", "Demo Bespoke Co"]);
    expect(res.status, res.stderr).toBe(0);
  });

  it("copies from apps/_bespoke-template and writes site-spec.ts alongside client.config.ts", () => {
    expect(existsSync(appDir(BESPOKE_FIXTURE))).toBe(true);
    expect(existsSync(resolve(appDir(BESPOKE_FIXTURE), "site-spec.ts"))).toBe(true);
    expect(existsSync(resolve(appDir(BESPOKE_FIXTURE), "client.config.ts"))).toBe(true);
  });

  it("stubs slug, client name, and a wordmark split from --name into site-spec.ts", () => {
    const spec = readFileSync(resolve(appDir(BESPOKE_FIXTURE), "site-spec.ts"), "utf8");
    expect(spec).toContain(`slug: "${BESPOKE_FIXTURE}"`);
    expect(spec).toContain(`client: "Demo Bespoke Co"`);
    expect(spec).toContain(`wordmark: { lead: "Demo", accent: "Bespoke Co" }`);
  });

  it("stubs the business name into client.config.ts (business.name, not the _bespoke-template stub)", () => {
    const cfg = readFileSync(resolve(appDir(BESPOKE_FIXTURE), "client.config.ts"), "utf8");
    expect(cfg).toContain(`slug: "${BESPOKE_FIXTURE}"`);
    expect(cfg).toContain(`name: "Demo Bespoke Co"`);
    expect(cfg).not.toContain("Bespoke Template Co");
  });

  it("produces a client.config.ts that PASSES defineClient()", () => {
    const probeDir = mkdtempSync(join(ROOT, "scripts", "ralph-probe-"));
    tmpDirs.push(probeDir);
    cpSync(resolve(appDir(BESPOKE_FIXTURE), "client.config.ts"), resolve(probeDir, "gen.config.ts"));
    const probe = resolve(probeDir, "validate.ts");
    writeFileSync(
      probe,
      `import { client } from "./gen.config.ts";\n` +
        `console.log(JSON.stringify({ slug: client.slug }));\n`,
    );
    const res = spawnSync(TSX, [probe], { cwd: ROOT, encoding: "utf8" });
    expect(res.status, res.stderr).toBe(0);
    expect(JSON.parse(res.stdout.trim())).toEqual({ slug: BESPOKE_FIXTURE });
  });

  it("its pages reference site-spec (not client.config alone)", () => {
    const indexPage = readFileSync(resolve(appDir(BESPOKE_FIXTURE), "src/pages/index.astro"), "utf8");
    expect(indexPage).toContain(`from "../../site-spec"`);
  });

  it("satisfies bespoke-template-gate.test.ts's byte-identity check against _bespoke-template", () => {
    const TEMPLATE_APP = resolve(ROOT, "apps/_bespoke-template");
    for (const file of [
      "src/pages/index.astro",
      "src/pages/v2.astro",
      "src/components/PreviewControls.astro",
      "scripts/fetch-photos.mjs",
    ]) {
      const canonical = readFileSync(resolve(TEMPLATE_APP, file), "utf8");
      const actual = readFileSync(resolve(appDir(BESPOKE_FIXTURE), file), "utf8");
      expect(actual, file).toBe(canonical);
    }
  });

  it("rejects --bespoke combined with --preset, naming the bespoke tier and the config-only path", () => {
    const res = run(NEW_CLIENT, [
      BESPOKE_CONFLICT_SLUG,
      "--bespoke",
      "--preset",
      "landscaping",
    ]);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/mutually exclusive/);
    expect(res.stderr).toMatch(/bespoke/i);
    expect(existsSync(appDir(BESPOKE_CONFLICT_SLUG))).toBe(false);
  });
});

describe("eject-client", () => {
  let outDir: string;

  beforeAll(() => {
    // Reuse the fixture scaffolded above; ensure it exists independently.
    if (!existsSync(appDir(FIXTURE))) {
      const res = run(NEW_CLIENT, [FIXTURE, "--preset", "landscaping"]);
      expect(res.status, res.stderr).toBe(0);
    }
    outDir = join(makeTmp("ralph-eject-"), "ejected");
    const res = run(EJECT_CLIENT, [FIXTURE, "--out", outDir]);
    expect(res.status, res.stderr).toBe(0);
  });

  it("emits a standalone package.json with NO workspace:* deps", () => {
    const pkg = JSON.parse(readFileSync(resolve(outDir, "package.json"), "utf8"));
    expect(pkg.name).toBe(FIXTURE);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, version] of Object.entries(allDeps)) {
      expect(String(version), name).not.toMatch(/^workspace:/);
    }
    // Real runtime + build deps are pinned, not left as workspace links.
    expect(pkg.dependencies).toHaveProperty("zod");
    expect(pkg.dependencies).toHaveProperty("@vercel/functions");
    expect(pkg.devDependencies).toHaveProperty("astro");
  });

  it("leaves NO workspace:* reference anywhere in the ejected tree", () => {
    for (const file of walk(outDir)) {
      expect(readFileSync(file, "utf8"), file).not.toContain("workspace:");
    }
  });

  it("inlines the workspace packages and rewrites every @hirobius/* import", () => {
    expect(existsSync(resolve(outDir, "src/_vendor/template"))).toBe(true);
    expect(existsSync(resolve(outDir, "src/_vendor/schema"))).toBe(true);
    for (const file of walk(outDir).filter((f) => /\.(astro|ts|mjs|css)$/.test(f))) {
      const code = readFileSync(file, "utf8");
      expect(code, file).not.toContain(`"@hirobius/`);
      expect(code, file).not.toContain(`'@hirobius/`);
    }
  });

  it("does not vendor the packages' own monorepo-fleet-wide tests (issue #109)", () => {
    // packages/template/src and packages/schema/src ship tests that assert
    // fleet-wide invariants (every app under apps/, an ops snapshot file) and
    // don't resolve their paths once vendored into a standalone repo — copying
    // them made `pnpm test` fail on every fresh ejection.
    const vendoredTests = walk(resolve(outDir, "src/_vendor")).filter((f) => f.endsWith(".test.ts"));
    expect(vendoredTests).toEqual([]);
  });

  it("writes the standalone support files and copies no build artifacts", () => {
    for (const f of ["tsconfig.json", ".gitignore", "README.md"]) {
      expect(existsSync(resolve(outDir, f)), f).toBe(true);
    }
    expect(existsSync(resolve(outDir, "node_modules"))).toBe(false);
    expect(existsSync(resolve(outDir, "dist"))).toBe(false);
  });

  it("pins every dependency to a real version — never the 'latest' fallback (issue #109)", () => {
    const pkg = JSON.parse(readFileSync(resolve(outDir, "package.json"), "utf8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, version] of Object.entries(allDeps)) {
      expect(String(version), name).not.toBe("latest");
      expect(String(version), name).toMatch(/^\^\d+\.\d+\.\d+/);
    }
    expect(pkg.packageManager).toMatch(/^pnpm@/);
  });

  it("ships a runnable test script + vitest devDep, so the ejected CI's test step works", () => {
    const pkg = JSON.parse(readFileSync(resolve(outDir, "package.json"), "utf8"));
    expect(pkg.scripts.test).toBe("vitest run");
    expect(pkg.devDependencies).toHaveProperty("vitest");
  });

  it("writes a minimal ejected-repo CI workflow: install, build, acceptance test — nothing else (issue #109)", () => {
    const workflow = readFileSync(resolve(outDir, ".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm build");
    expect(workflow).toContain("pnpm test");
    // No monorepo assumptions: no turbo, no --filter, no Playwright/browser step.
    expect(workflow).not.toContain("turbo");
    expect(workflow).not.toContain("--filter");
    expect(workflow).not.toContain("playwright");
  });

  it("documents the CI gate in the handoff README", () => {
    const readme = readFileSync(resolve(outDir, "README.md"), "utf8");
    expect(readme).toMatch(/ci\.yml/);
    expect(readme).toMatch(/green build/i);
  });
});

describe("readVersion", () => {
  it("throws instead of silently falling back to 'latest' when no candidate resolves (issue #109)", () => {
    expect(() => readVersion("some-unresolvable-pkg", ["/nonexistent/a/package.json", "/nonexistent/b/package.json"])).toThrow(
      /some-unresolvable-pkg/,
    );
  });

  it("returns the caret-pinned version from the first candidate that exists", () => {
    const io: Parameters<typeof readVersion>[2] = {
      existsSync: (p) => p === "/fake/exists/package.json",
      readFileSync: () => JSON.stringify({ version: "1.2.3" }),
    };
    expect(readVersion("some-pkg", ["/fake/missing/package.json", "/fake/exists/package.json"], io)).toBe("^1.2.3");
  });
});
