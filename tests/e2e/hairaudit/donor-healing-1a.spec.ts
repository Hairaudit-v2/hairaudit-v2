import { test, expect, skipIfE2eBlocked } from "../fixtures/hairaudit.fixture";

test.describe("HA-DONOR-HEALING-1A — donor healing guide entry", () => {
  test.beforeEach(() => skipIfE2eBlocked());

  test("guide shows timeline, CTA, and routes to pathway confirmation", async ({ page }) => {
    await page.goto("/normal-donor-healing-after-fue");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("donor-stage-route-early")).toBeVisible();
    await expect(page.getByTestId("donor-stage-route-later")).toBeVisible();
    await expect(page.getByTestId("donor-timeline-stage-days_1_3")).toBeVisible();
    await expect(page.getByTestId("donor-compare-redness")).toBeVisible();

    const cta = page.getByTestId("donor-healing-cta").first();
    await expect(cta).toContainText(/Check My Donor Healing/i);
    await expect(cta).toHaveAttribute("data-entry-context", "donor_healing");

    const href = await cta.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href!).toContain("/request-review");
    expect(href!).toContain("concern=donor_healing");
    expect(href!).not.toContain("/api/audit/start");

    await cta.click();
    await page.waitForURL(/\/request-review/);
    const chooser = page.locator("#choose-pathway").getByTestId("pathway-chooser");
    await expect(chooser).toBeVisible();
    await expect(page.getByTestId("donor-entry-context-banner").first()).toBeVisible();
    await expect(chooser.getByTestId("start-post-surgery-audit")).toBeVisible();
    await expect(chooser.getByTestId("start-pre-surgery-review")).toBeVisible();
  });

  test("donor CTA still requires explicit post-surgery confirmation before case create", async ({
    page,
  }) => {
    await page.goto(
      "/request-review?concern=donor_healing&entry_context=donor_healing#choose-pathway"
    );

    await expect(page.getByTestId("donor-entry-context-banner").first()).toBeVisible();

    // Architecture proof: mock start so local SSL/anon-auth env cannot block the contract check.
    await page.route("**/api/audit/start", async (route) => {
      const postData = route.request().postDataJSON() as {
        pathway?: string;
        entry_context?: string;
        entryContext?: string;
      };
      expect(postData.pathway).toBe("post_surgery");
      expect(postData.entry_context ?? postData.entryContext).toBe("donor_healing");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          caseId: "11111111-1111-4111-8111-111111111111",
          pathway: "post_surgery",
          entryContext: "donor_healing",
          next: "/cases/11111111-1111-4111-8111-111111111111/patient/photos?entry_context=donor_healing",
        }),
      });
    });

    const auditStart = page.waitForRequest(
      (req) => req.url().includes("/api/audit/start") && req.method() === "POST"
    );

    await page
      .locator("#choose-pathway")
      .getByTestId("start-post-surgery-audit")
      .click();

    const request = await auditStart;
    const body = request.postDataJSON() as {
      pathway?: string;
      entry_context?: string;
      entryContext?: string;
    };
    expect(body.pathway).toBe("post_surgery");
    expect(body.entry_context ?? body.entryContext).toBe("donor_healing");

    await page.waitForURL(/\/cases\/11111111-1111-4111-8111-111111111111\/patient\/photos/);
    expect(page.url()).toContain("entry_context=donor_healing");
  });

  test("mobile layout has no horizontal overflow on donor guide", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/normal-donor-healing-after-fue");
    await expect(page.getByTestId("donor-healing-cta").first()).toBeVisible();

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflow).toBe(false);

    await page.screenshot({
      path: "tmp/donor-healing-1a-mobile.png",
      fullPage: true,
    });
  });

  test("desktop screenshot evidence for donor guide hub", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/normal-donor-healing-after-fue");
    await expect(page.getByTestId("donor-stage-route-early")).toBeVisible();
    await page.screenshot({
      path: "tmp/donor-healing-1a-desktop.png",
      fullPage: true,
    });
  });
});
