import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home page has zero axe violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
