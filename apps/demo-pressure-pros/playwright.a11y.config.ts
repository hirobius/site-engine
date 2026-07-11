import { defineConfig, devices } from "@playwright/test";

const PORT = 4324;

/**
 * Accessibility budget (issue #88): axe-core scan of the built demo, run by
 * .github/workflows/lighthouse.yml alongside Lighthouse CI. Kept in its own
 * config/directory (not playwright.config.ts's testDir) so it never runs as
 * part of the plain `pnpm test` smoke suite in ci.yml — this is a separate,
 * dedicated CI job.
 */
export default defineConfig({
  testDir: "./a11y",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // brand.motion defaults to "rich"; force reduced-motion so Document.astro's
    // arm script never adds `.motion-ready` and every `.reveal` element renders
    // fully visible immediately — otherwise axe can sample a still-fading
    // element mid-transition and flag a false-positive contrast violation
    // (same flake guard as apps/_gallery's visual regression, clients#22/#74).
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm preview --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
