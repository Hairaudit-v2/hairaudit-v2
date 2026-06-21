import { test, expect, skipIfE2eBlocked } from "../fixtures/hairaudit.fixture";

test.describe("Patient entry architecture", () => {
  test.beforeEach(() => skipIfE2eBlocked());

  test("header CTA routes to pathway chooser without starting audit", async ({ page }) => {
    await page.goto("/");

    const headerCta = page.getByTestId("choose-review-pathway-header");
    await expect(headerCta).toBeVisible();
    await expect(headerCta).toHaveAttribute("href", "/request-review#choose-pathway");

    const auditStart = page.waitForRequest(
      (req) => req.url().includes("/api/audit/start") && req.method() === "POST",
      { timeout: 2000 }
    ).catch(() => null);

    await headerCta.click();
    await page.waitForURL(/\/request-review/);

    const pending = await auditStart;
    expect(pending).toBeNull();
    await expect(page.locator("#choose-pathway")).toBeVisible();
  });

  test("mobile menu CTA routes to pathway chooser", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByLabel("Open navigation menu").click();
    const mobileCta = page.getByTestId("choose-review-pathway-mobile-menu");
    await expect(mobileCta).toBeVisible();
    await expect(mobileCta).toHaveAttribute("href", "/request-review#choose-pathway");
    await mobileCta.click();
    await page.waitForURL(/\/request-review/);
    await expect(page.locator("#choose-pathway")).toBeVisible();
  });

  test("footer CTA routes to pathway chooser", async ({ page }) => {
    await page.goto("/");

    const footerCta = page.getByTestId("choose-review-pathway-footer");
    await expect(footerCta).toBeVisible();
    await expect(footerCta).toHaveAttribute("href", "/request-review#choose-pathway");
    await footerCta.click();
    await page.waitForURL(/\/request-review/);
    await expect(page.locator("#choose-pathway")).toBeVisible();
  });

  test("request-review has pathway chooser and no generic start-free CTA", async ({ page }) => {
    await page.goto("/request-review");

    await expect(page.locator("#choose-pathway")).toBeVisible();
    await expect(page.getByText("Choose your review type")).toBeVisible();
    await expect(page.getByTestId("pathway-chooser")).toBeVisible();
    await expect(page.getByText("Start Free HairAudit")).toHaveCount(0);
  });

  test("/api/audit/start rejects missing pathway", async ({ page }) => {
    const response = await page.request.post("/api/audit/start", {
      data: {},
    });

    expect(response.status()).toBe(400);
    const json = (await response.json()) as { ok?: boolean; error?: string };
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/choose a review type/i);
  });

  test("rate-my CTA routes to pathway chooser without starting audit", async ({ page }) => {
    await page.goto("/rate-my-hair-transplant");

    const auditStart = page
      .waitForRequest(
        (req) => req.url().includes("/api/audit/start") && req.method() === "POST",
        { timeout: 2000 }
      )
      .catch(() => null);

    await page.getByRole("link", { name: "Choose Your Review" }).first().click();
    await page.waitForURL(/\/request-review/);
    await expect(page.locator("#choose-pathway")).toBeVisible();

    const pending = await auditStart;
    expect(pending).toBeNull();
  });
});
