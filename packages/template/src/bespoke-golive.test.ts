import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Go-live safety for the BESPOKE tier (se#204).
 *
 * Bespoke apps opt out of the shared template components, so `armAcceptanceGate`
 * — which reasons about `ClientConfig` — sees none of this. That left four
 * hand-authored pages each emitting an unconditional
 * `<meta name="robots" content="noindex, nofollow">`, which is correct for a
 * speculative preview and catastrophic the moment a client signs: the site goes
 * live and stays deindexed, while `middleware.ts` (which owns preview
 * de-indexing via `X-Robots-Tag`) passes through untouched at SITE_LIVE=true.
 *
 * These assertions are on SOURCE, deliberately. The build cannot prove it:
 * `checkClientAcceptance` blocks any live-mode build until every go-live
 * requirement is met, so a live render is unobtainable until the exact moment
 * this bug would otherwise fire.
 *
 * A bespoke app is identified by owning `src/components/PreviewControls.astro`,
 * so a future bespoke app is covered the day it is scaffolded.
 */

const APPS_DIR = fileURLToPath(new URL("../../../apps", import.meta.url));
const EXEMPT = new Set(["_template", "_gallery"]);

/** The single predicate that defines "preview" — PreviewControls.astro's own. */
const PREVIEW_PREDICATE =
  'process.env.SITE_LIVE !== "true" && process.env.VERCEL_ENV !== "production"';

function bespokeApps(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !EXEMPT.has(e.name))
    .map((e) => e.name)
    .filter((app) =>
      existsSync(join(APPS_DIR, app, "src", "components", "PreviewControls.astro")),
    );
}

function pagesOf(app: string): string[] {
  const dir = join(APPS_DIR, app, "src", "pages");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".astro"));
}

const APPS = bespokeApps();

describe("bespoke go-live safety", () => {
  it("finds the bespoke apps (guards against the discovery silently matching nothing)", () => {
    expect(APPS.length).toBeGreaterThan(0);
  });

  describe.each(APPS)("%s", (app) => {
    const pages = pagesOf(app);

    it("has at least one page to check", () => {
      expect(pages.length).toBeGreaterThan(0);
    });

    it.each(pages)("%s emits no unconditional robots meta", (page) => {
      const src = readFileSync(join(APPS_DIR, app, "src", "pages", page), "utf8");
      // Preview de-indexing is middleware's X-Robots-Tag. A page-level meta
      // survives go-live and keeps a signed client invisible to search.
      expect(src).not.toMatch(/<meta\s+name="robots"/);
    });

    it.each(pages)("%s gates the font explorer behind the preview predicate", (page) => {
      const src = readFileSync(join(APPS_DIR, app, "src", "pages", page), "utf8");
      const hasExplorer =
        src.includes("fonts.googleapis.com") || src.includes("api.fontshare.com");
      if (!hasExplorer) return;

      // The page must compute isPreview from the SAME predicate PreviewControls
      // uses, so the two can never disagree about what "live" means.
      expect(src).toContain(PREVIEW_PREDICATE);
      expect(src).toMatch(/\{isPreview \?/);

      // The multi-family explorer payload and the localStorage restore are
      // preview-only; both must sit inside an isPreview branch.
      if (src.includes("localStorage.getItem")) {
        expect(src).toMatch(/\{isPreview &&/);
      }
    });

    it.each(pages)("%s still loads its own faces in live mode", (page) => {
      const src = readFileSync(join(APPS_DIR, app, "src", "pages", page), "utf8");
      if (!src.includes("fonts.googleapis.com")) return;

      // The live branch of the isPreview ternary must itself load a font link,
      // or a signed client renders in fallback system faces.
      const liveBranch = src.split(") : (")[1];
      expect(liveBranch, `${page} has no live branch`).toBeDefined();
      expect(liveBranch.slice(0, 900)).toMatch(
        /fonts\.googleapis\.com|api\.fontshare\.com/,
      );
    });

    it("ships the shared llms.txt route, byte-identical to _template", () => {
      const canonical = readFileSync(
        join(APPS_DIR, "_template", "src", "pages", "llms.txt.ts"),
        "utf8",
      );
      const actual = readFileSync(
        join(APPS_DIR, app, "src", "pages", "llms.txt.ts"),
        "utf8",
      );
      expect(actual).toBe(canonical);
    });
  });
});
