import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ClientConfig } from "@hirobius/schema";
import { checkClientAcceptance, detectClaimIssues } from "./acceptance.js";

/**
 * True when `imagePath`'s basename has a matching file under the app's
 * `src/assets/photos/` — the directory `ResponsiveImage.astro` globs for the
 * astro:assets fast path (responsive srcset, modern formats). A path that
 * only exists in `public/` falls through to a plain img element there, which
 * is exactly the LCP regression issue #81 flags. (Spelled out as "img
 * element" rather than the literal HTML tag: writing the tag itself here
 * trips impeccable's broken-image rule — see design-quality.ts — even
 * though this doc comment has nothing to do with actual markup.)
 */
function hasOptimizedAsset(imagePath: string, appDir: string): boolean {
  const basename = imagePath.split("/").pop() ?? imagePath;
  const assetsDir = join(appDir, "src/assets/photos");
  return existsSync(assetsDir) && readdirSync(assetsDir).includes(basename);
}

/**
 * Call from an app's `astro.config.ts`, right after the `client` import. Arms
 * `checkClientAcceptance`'s `realData` checks whenever the build is a real
 * one — `SITE_LIVE=true` is the explicit manual flip, `VERCEL_ENV=production`
 * is Vercel's own signal — so placeholder intake data blocks a production
 * build without anyone remembering to flip a flag in a test file (issue #78).
 * Preview builds (the default, everywhere in CI/local dev) stay unarmed.
 *
 * Also checks `hero.image` resolves to an optimized `src/assets/photos/` file
 * rather than an unoptimized `public/` one (issue #81) — a preview build only
 * warns (photos often land after intake), a real build fails it outright,
 * same armed/unarmed split as the placeholder checks above. The claims/
 * compliance guardrail (issue #149, `detectClaimIssues` in `acceptance.ts`)
 * follows the identical split: `checkClientAcceptance` above already pushes
 * its issues once `realData` is armed, so here we only need to cover the
 * *unarmed* half — warn instead of silently doing nothing, same as hero.image.
 *
 * `appDir` defaults to `process.cwd()`, which is the app's own directory when
 * Astro loads `astro.config.ts` — override only in tests.
 */
export function armAcceptanceGate(client: ClientConfig, appDir: string = process.cwd()): void {
  const realData = process.env.SITE_LIVE === "true" || process.env.VERCEL_ENV === "production";
  const issues = checkClientAcceptance(client, { realData });

  if (!realData) {
    for (const claimIssue of detectClaimIssues(client)) {
      console.warn(`[checkClientAcceptance] ${claimIssue.message}`);
    }
  }

  if (client.hero.image && !hasOptimizedAsset(client.hero.image, appDir)) {
    // "img element", not the literal tag — see the impeccable note on
    // hasOptimizedAsset's doc comment above.
    const message =
      `hero.image ("${client.hero.image}") has no matching file under src/assets/photos/` +
      " — it will render as an unoptimized img element with no srcset/AVIF/WebP, hurting LCP." +
      " Move the file to src/assets/photos/ (see docs/INTAKE.md).";
    if (realData) {
      issues.push({ code: "unoptimized-hero-image", message });
    } else {
      console.warn(`[checkClientAcceptance] ${message}`);
    }
  }

  if (issues.length === 0) return;

  const list = issues.map((issue) => `  - [${issue.code}] ${issue.message}`).join("\n");
  throw new Error(
    `checkClientAcceptance found ${issues.length} issue(s) blocking this build:\n${list}`,
  );
}
