import { defineConfig, devices } from "@playwright/test";

const PORT = 4322;

/**
 * Visual regression for the template fleet.
 *
 * Target = the gallery app, which renders every preset, both hero variants, and
 * every section on deterministic pages (no real photos, third-party requests are
 * blocked in the spec). A pixel diff here means a packages/* change altered how
 * client sites render — exactly the "silent restyle" we want to catch before it
 * ships to live sites.
 *
 * Baselines are platform-specific. Generate/refresh them in the pinned Linux
 * Playwright container (see .github/workflows/visual.yml and the README), so the
 * committed snapshots match what CI compares against.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      // Tolerate sub-pixel antialiasing noise; real regressions are far larger.
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm preview --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
