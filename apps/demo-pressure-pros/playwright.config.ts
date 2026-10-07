import { defineConfig, devices } from "@playwright/test";
import { resolveChromiumExecutable } from "../../scripts/resolve-playwright-browser.js";

const PORT = 4321;

// Use the sandbox's pre-installed Chromium when present; undefined elsewhere so
// CI/local Playwright-managed browsers are left untouched (see the resolver).
const chromiumExecutable = resolveChromiumExecutable();

/**
 * Smoke tests run against the built static output via `astro preview`, so they
 * exercise exactly what Vercel serves. `turbo test` runs `build` first, so dist
 * exists by the time this server starts.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
      },
    },
  ],
  webServer: {
    command: `pnpm preview --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
