import { test, expect } from "@playwright/test";

/**
 * Snapshot the deterministic gallery pages. The presets and sections pages use
 * fixture configs with no real photos, so the only sources of nondeterminism are
 * third-party requests (maps, fonts, hcaptcha, screenshot service) — which we
 * block below to keep the baseline stable. Scroll-reveal motion is neutralized
 * globally via `reducedMotion: "reduce"` in playwright.config.ts.
 */
test.beforeEach(async ({ page }) => {
  await page.route(
    /google\.com\/maps|api\.microlink\.io|fonts\.googleapis|fonts\.gstatic|js\.hcaptcha\.com/,
    (route) => route.abort(),
  );
});

test("presets — all trades + hero variants", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("presets.png", { fullPage: true });
});

test("sections — component kitchen sink", async ({ page }) => {
  await page.goto("/sections");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("sections.png", {
    fullPage: true,
    // The lazy map embed is third-party and non-deterministic even when blocked.
    mask: [page.locator("#serviceAreaMap")],
  });
});
