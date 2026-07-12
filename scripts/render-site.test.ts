import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { leadToConfig, type LeadRow } from "../packages/schema/src/lead-to-config.js";
import { renderConfigFile, writeClientConfig } from "./render-site.js";

/**
 * Coverage for the render-site pipeline's config-write half (issue #121,
 * deliverable 2). `.github/workflows/render-site.yml` scaffolds apps/<slug>
 * via `new-client`, then calls this script to overwrite client.config.ts with
 * the lead's mapped config. The critical contract: a malformed dispatch
 * payload fails HERE with a clear error, before it ever reaches `astro build`.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TSX = resolve(ROOT, "node_modules/.bin/tsx");
const NEW_CLIENT = resolve(ROOT, "scripts/new-client.ts");
const RENDER_SITE = resolve(ROOT, "scripts/render-site.ts");

const ROLLING_SUDS: LeadRow = {
  name: "Rolling Suds of Seattle",
  slug: "rolling-suds-of-seattle",
  category: "Pressure washing service",
  city: "Seattle",
  region: "WA",
  phone: "(206) 555-0142",
  email: "info@rollingsudsseattle.com",
  hours: [
    { days: "Mon–Fri", hours: "8:00 AM – 5:00 PM" },
    { days: "Sat", hours: "9:00 AM – 1:00 PM" },
  ],
  serviceArea: ["Seattle, WA", "Bellevue, WA", "Redmond, WA"],
};

const tmpDirs: string[] = [];
function makeTmp(prefix: string) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

describe("renderConfigFile / writeClientConfig", () => {
  it("wraps a validated config in a defineClient() module", () => {
    const { config } = leadToConfig(ROLLING_SUDS);
    const src = renderConfigFile(config);
    expect(src).toContain(`import { defineClient } from "@hirobius/schema";`);
    expect(src).toContain(`"slug": "rolling-suds-of-seattle"`);
  });

  it("writes client.config.ts from a JSON config string", () => {
    const { config } = leadToConfig(ROLLING_SUDS);
    const appDir = makeTmp("ralph-render-site-app-");
    writeClientConfig(appDir, JSON.stringify(config));
    const written = readFileSync(resolve(appDir, "client.config.ts"), "utf8");
    expect(written).toContain(`"name": "Rolling Suds of Seattle"`);
  });

  it("throws on invalid JSON instead of writing a broken file", () => {
    const appDir = makeTmp("ralph-render-site-app-");
    expect(() => writeClientConfig(appDir, "{not json")).toThrow(/not valid JSON/);
    expect(existsSync(resolve(appDir, "client.config.ts"))).toBe(false);
  });

  it("throws on a config defineClient() rejects — never fabricates a fallback", () => {
    const appDir = makeTmp("ralph-render-site-app-");
    expect(() => writeClientConfig(appDir, JSON.stringify({ slug: "x" }))).toThrow();
    expect(existsSync(resolve(appDir, "client.config.ts"))).toBe(false);
  });
});

describe("render-site CLI", () => {
  const FIXTURE = "zzz-ralph-rendersite-fixture";
  const appDir = () => resolve(ROOT, "apps", FIXTURE);

  afterAll(() => {
    rmSync(appDir(), { recursive: true, force: true });
  });

  it("overwrites a scaffolded app's client.config.ts with a config that passes defineClient()", () => {
    rmSync(appDir(), { recursive: true, force: true });
    // Mirrors the real pipeline (render-site.yml step 1 -> step 2): scaffold
    // with the real new-client script first, so this exercises the exact
    // fixture new-client produces (astro.config.ts + middleware.ts included),
    // not a bare directory that would fail packages/template's gate tests.
    const scaffold = spawnSync(TSX, [NEW_CLIENT, FIXTURE, "--preset", "pressure-washing"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(scaffold.status, scaffold.stderr).toBe(0);

    const { config } = leadToConfig(ROLLING_SUDS);
    const configPath = join(makeTmp("ralph-render-site-cfg-"), "config.json");
    writeFileSync(configPath, JSON.stringify(config));

    const res = spawnSync(TSX, [RENDER_SITE, FIXTURE, "--config", configPath], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(res.status, res.stderr).toBe(0);

    const probeDir = mkdtempSync(join(ROOT, "scripts", "ralph-probe-"));
    tmpDirs.push(probeDir);
    const cfgSrc = readFileSync(resolve(appDir(), "client.config.ts"), "utf8");
    writeFileSync(resolve(probeDir, "gen.config.ts"), cfgSrc);
    const probe = resolve(probeDir, "validate.ts");
    writeFileSync(
      probe,
      `import { client } from "./gen.config.ts";\n` +
        `console.log(JSON.stringify({ slug: client.slug, name: client.business.name }));\n`,
    );
    const probeRes = spawnSync(TSX, [probe], { cwd: ROOT, encoding: "utf8" });
    expect(probeRes.status, probeRes.stderr).toBe(0);
    expect(JSON.parse(probeRes.stdout.trim())).toEqual({
      slug: "rolling-suds-of-seattle",
      name: "Rolling Suds of Seattle",
    });
  });

  it("fails without creating apps/<slug> first", () => {
    const missingSlug = "zzz-ralph-rendersite-missing";
    rmSync(resolve(ROOT, "apps", missingSlug), { recursive: true, force: true });
    const configPath = join(makeTmp("ralph-render-site-cfg-"), "config.json");
    writeFileSync(configPath, JSON.stringify(leadToConfig(ROLLING_SUDS).config));

    const res = spawnSync(TSX, [RENDER_SITE, missingSlug, "--config", configPath], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/does not exist/);
  });
});
