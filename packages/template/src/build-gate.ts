import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ClientConfig } from "@hirobius/schema";
import {
  checkClientAcceptance,
  detectClaimIssues,
  detectVisibleContactPlaceholders,
} from "./acceptance.js";

/**
 * Where each placeholder contact value is actually rendered, so the preview
 * warning tells the operator what the business owner would see rather than
 * just naming a config key (ops#27). Keep in sync with the components that
 * read `business.phone`/`business.email`.
 */
const CONTACT_SURFACES: Record<string, string> = {
  "placeholder-phone":
    "the hero CTA, the sticky CTA, the footer, the contact form, the thank-you page, llms.txt and the JSON-LD telephone",
  "placeholder-email": "the footer, the contact form, llms.txt and the JSON-LD contact details",
};

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
 * Exception — `PREVIEW_BUILD=true` (issue #188): a gated `deploy-preview` build
 * is NOT go-live even when Vercel labels it production. Vercel misclassifies a
 * fresh project's FIRST deploy as `VERCEL_ENV=production` even for a `?key=`
 * gated preview, which used to arm the gate and block the intended placeholder
 * intake data. `deploy-preview` sets `PREVIEW_BUILD=true`, which suppresses the
 * Vercel-production signal so the gated preview builds. `SITE_LIVE=true` still
 * always arms, so real go-live (which never sets `PREVIEW_BUILD`) is unaffected.
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
  const gatedPreview = process.env.PREVIEW_BUILD === "true";
  const realData =
    process.env.SITE_LIVE === "true" ||
    (process.env.VERCEL_ENV === "production" && !gatedPreview);
  const issues = checkClientAcceptance(client, { realData });

  if (!realData) {
    for (const claimIssue of detectClaimIssues(client)) {
      console.warn(`[checkClientAcceptance] ${claimIssue.message}`);
    }
    // ops#27: an unarmed build is the cold-outreach build. `deploy-preview`
    // sets PREVIEW_BUILD=true precisely so placeholder intake data does NOT
    // block it — and the link it prints is then sent to the business owner the
    // preview was generated for. A stub phone is correct in the repo (contact
    // details live on the lead row, never in git) and wrong in that owner's
    // browser, where every call-now button would show a number that is not
    // theirs. The armed gate fails on these; the preview build says so out
    // loud instead of shipping them silently.
    for (const contactIssue of detectVisibleContactPlaceholders(client)) {
      console.warn(
        `[checkClientAcceptance] ${contactIssue.message} — the preview renders it in ${
          CONTACT_SURFACES[contactIssue.code] ?? "the page the owner will open"
        }. DO NOT SEND this preview to the business it was generated for until the value is set` +
          " from the lead row (see docs/PIPELINE-RUNBOOK.md).",
      );
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
