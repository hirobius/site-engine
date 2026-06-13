import { test, expect } from "@playwright/test";

test("page renders the hero and key sections", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Pressure Pros/);
  await expect(page.locator("h1")).toContainText("Austin");
  await expect(page.locator("#services")).toBeAttached();
  await expect(page.locator("#contact")).toBeAttached();
});

test("a dialable tel: link is present", async ({ page }) => {
  await page.goto("/");
  const tel = page.locator('a[href^="tel:"]').first();
  await expect(tel).toHaveAttribute("href", /^tel:\+?\d{7,}$/);
});

test("LocalBusiness JSON-LD is emitted", async ({ page }) => {
  await page.goto("/");
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(ld).toBeTruthy();
  const data = JSON.parse(ld!);
  expect(data["@type"]).toBe("LocalBusiness");
  expect(data.telephone).toBeTruthy();
});

test("contact form posts to Web3Forms (mocked)", async ({ page }) => {
  await page.goto("/");

  let postData: string | null = null;
  await page.route("https://api.web3forms.com/submit", async (route) => {
    postData = route.request().postData();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "ok" }),
    });
  });

  await page.fill('input[name="name"]', "Test User");
  await page.fill('input[name="email"]', "test@example.com");
  await page.fill('textarea[name="message"]', "Please quote my driveway.");

  await Promise.all([
    page.waitForRequest("https://api.web3forms.com/submit"),
    page.click('button[type="submit"]'),
  ]);

  // The hidden access_key must ride along, and the honeypot must stay empty.
  expect(postData).toContain("access_key");
  expect(postData).not.toMatch(/botcheck=(?!&|$)./);
});
