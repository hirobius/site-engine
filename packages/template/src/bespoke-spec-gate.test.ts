import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Icon-coverage gate for the BESPOKE tier's V2 page (se#208).
 *
 * `src/pages/v2.astro` is now identical across every bespoke app; the icons it
 * renders come from that app's own `site-spec.ts` (`content.serviceIcons`,
 * `content.features[].icon`, `content.steps[].icon`, `content.heroTrust[].icon`).
 * `Icon.astro` stays a deliberately pruned PER-APP subset (#184 fix 3 — 12 ids
 * for pnw, 10 for septic), so nothing catches a spec that names an icon its own
 * app never vendored — the page would just render a blank slot. This test is
 * that catch: it reads both files as source (no TS/Astro toolchain needed) and
 * asserts every icon id the spec names exists in that app's `ICONS` map.
 *
 * Read as plain text, deliberately, so this test never needs to execute
 * `site-spec.ts` (which imports `@hirobius/schema` and a local
 * `photo-queries.json`) or compile the `.astro` file — it only needs to see
 * what identifiers each file mentions.
 */

const APPS_DIR = fileURLToPath(new URL("../../../apps", import.meta.url));
const EXEMPT = new Set(["_template", "_gallery"]);

/** A bespoke app is identified by owning its own `site-spec.ts` (mirrors
 * `bespoke-golive.test.ts`'s `PreviewControls.astro` discovery). */
function bespokeApps(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !EXEMPT.has(e.name))
    .map((e) => e.name)
    .filter((app) => existsSync(join(APPS_DIR, app, "site-spec.ts")));
}

function iconIdsIn(app: string): Set<string> {
  const path = join(APPS_DIR, app, "src", "components", "Icon.astro");
  const src = readFileSync(path, "utf8");
  const body = src.match(/const ICONS: Record<string, string> = \{([\s\S]*?)\n\};/)?.[1];
  if (body === undefined) {
    throw new Error(`${app}/src/components/Icon.astro: could not find the ICONS map`);
  }
  const ids = [...body.matchAll(/^\s*"?([a-zA-Z0-9-]+)"?:\s*`/gm)].map((m) => m[1]!);
  return new Set(ids);
}

/** Every icon id `site-spec.ts` names for the V2 page — `icon: "…"` fields
 * (features, steps, heroTrust) plus `serviceIcons`'s string array. */
function specIconRefs(app: string): string[] {
  const src = readFileSync(join(APPS_DIR, app, "site-spec.ts"), "utf8");
  const fromFields = [...src.matchAll(/icon:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]!);
  const serviceIconsBlock = src.match(/serviceIcons:\s*\[([^\]]*)\]/)?.[1] ?? "";
  const fromServiceIcons = [...serviceIconsBlock.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]!);
  return [...new Set([...fromFields, ...fromServiceIcons])];
}

const APPS = bespokeApps();

describe("bespoke V2 icon coverage (se#208)", () => {
  it("finds the bespoke apps (guards against the discovery silently matching nothing)", () => {
    expect(APPS.length).toBeGreaterThan(0);
  });

  describe.each(APPS)("%s", (app) => {
    it("names at least one icon in site-spec.ts", () => {
      expect(specIconRefs(app).length).toBeGreaterThan(0);
    });

    it("every icon site-spec.ts names for V2 exists in this app's Icon.astro", () => {
      const available = iconIdsIn(app);
      const used = specIconRefs(app);
      const missing = used.filter((id) => !available.has(id));
      expect(missing).toEqual([]);
    });
  });
});
