import type { ClientConfig } from "@hirobius/schema";
import { checkClientAcceptance } from "./acceptance.js";

/**
 * Call from an app's `astro.config.ts`, right after the `client` import. Arms
 * `checkClientAcceptance`'s `realData` checks whenever the build is a real
 * one — `SITE_LIVE=true` is the explicit manual flip, `VERCEL_ENV=production`
 * is Vercel's own signal — so placeholder intake data blocks a production
 * build without anyone remembering to flip a flag in a test file (issue #78).
 * Preview builds (the default, everywhere in CI/local dev) stay unarmed.
 */
export function armAcceptanceGate(client: ClientConfig): void {
  const realData = process.env.SITE_LIVE === "true" || process.env.VERCEL_ENV === "production";
  const issues = checkClientAcceptance(client, { realData });
  if (issues.length === 0) return;

  const list = issues.map((issue) => `  - [${issue.code}] ${issue.message}`).join("\n");
  throw new Error(
    `checkClientAcceptance found ${issues.length} issue(s) blocking this build:\n${list}`,
  );
}
