import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Drift gate for the BESPOKE tier's copy source, `apps/_bespoke-template`
 * (se#209).
 *
 * `_bespoke-template` is a copy source, not an import target — the same idiom
 * as `astro-config-gate.test.ts` / `middleware-gate.test.ts` for `_template`.
 * Once #208 made `v2.astro`, `PreviewControls.astro`, and `fetch-photos.mjs`
 * identical across every bespoke app, a real bespoke app is scaffolded by
 * copying `_bespoke-template`'s files, and `index.astro` happens to be
 * byte-identical across the fleet's two shipped bespoke apps today too. This
 * asserts none of the four ever silently diverges from the copy source again.
 *
 * A bespoke app is identified by owning its own `site-spec.ts` (mirrors
 * `bespoke-spec-gate.test.ts`'s discovery); `_bespoke-template` itself is
 * excluded — it's the canonical side of the comparison, not a subject of it.
 */
const APPS_DIR = fileURLToPath(new URL("../../../apps", import.meta.url));
const TEMPLATE_APP = "_bespoke-template";
const EXEMPT = new Set(["_template", "_gallery", TEMPLATE_APP]);

const SHARED_FILES = [
  "src/pages/index.astro",
  "src/pages/v2.astro",
  "src/components/PreviewControls.astro",
  "scripts/fetch-photos.mjs",
] as const;

function bespokeApps(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !EXEMPT.has(e.name))
    .map((e) => e.name)
    .filter((app) => existsSync(join(APPS_DIR, app, "site-spec.ts")));
}

const APPS = bespokeApps();

describe("bespoke apps match _bespoke-template (se#209)", () => {
  it("the copy source itself exists", () => {
    expect(existsSync(join(APPS_DIR, TEMPLATE_APP, "site-spec.ts"))).toBe(true);
  });

  it("finds the bespoke apps (guards against the discovery silently matching nothing)", () => {
    expect(APPS.length).toBeGreaterThan(0);
  });

  describe.each(APPS)("%s", (app) => {
    it.each(SHARED_FILES)("%s is byte-identical to _bespoke-template's copy", (file) => {
      const canonical = readFileSync(join(APPS_DIR, TEMPLATE_APP, file), "utf8");
      const actual = readFileSync(join(APPS_DIR, app, file), "utf8");
      expect(actual).toBe(canonical);
    });
  });
});
