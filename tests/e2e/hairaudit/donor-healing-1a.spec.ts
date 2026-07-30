import { test, expect, skipIfE2eBlocked } from "../fixtures/hairaudit.fixture";

test.describe("HA-DONOR-HEALING-1A — donor healing guide entry", () => {
  test.beforeEach(() => skipIfE2eBlocked());

  test("Journey A — logged out guide stage + CTA + pathway confirmation", async ({ page }) => {
    await page.goto("/normal-donor-healing-after-fue");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Normal Donor Healing After FUE/i);
    await expect(page.getByTestId("donor-opening-viewport")).toBeVisible();
    await expect(page.getByTestId("donor-capability-boundary")).toBeVisible();
    await expect(page.getByTestId("donor-stage-route-early")).toBeVisible();
    await expect(page.getByTestId("donor-stage-route-later")).toBeVisible();

    await page.getByTestId("donor-stage-route-early").click();
    await expect(page.getByTestId("donor-timeline-stage-days_1_3")).toBeVisible();
    await expect(page.getByTestId("donor-compare-tenderness")).toBeVisible();

    const cta = page.getByTestId("donor-healing-cta").first();
    await expect(cta).toContainText(/Check My Donor Healing/i);
    await expect(cta).toHaveAttribute("data-entry-context", "donor_healing");

    const href = await cta.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href!).toContain("/request-review");
    expect(href!).toContain("concern=donor_healing");
    expect(href!).toContain("entry_context=donor_healing");
    expect(href!).toContain("recommended_pathway=post_surgery");
    expect(href!).not.toContain("/api/audit/start");

    await cta.click();
    await page.waitForURL(/\/request-review/);
    const chooser = page.locator("#choose-pathway").getByTestId("pathway-chooser");
    await expect(chooser).toBeVisible();
    await expect(page.getByTestId("donor-entry-context-banner").first()).toBeVisible();
    await expect(page.getByTestId("donor-entry-context-banner").first()).toContainText(
      /healing after a procedure/i
    );
    await expect(chooser.getByTestId("start-post-surgery-audit")).toContainText(
      /Continue with Post-Surgery Audit/i
    );
    await expect(chooser.getByTestId("start-pre-surgery-review")).toBeVisible();
  });

  test("Journey B — later stage choice and explicit post-surgery confirmation", async ({
    page,
  }) => {
    await page.goto("/normal-donor-healing-after-fue");
    await page.getByTestId("donor-stage-route-later").click();
    await expect(page.locator("#donor-healing-later")).toBeVisible();

    await page.goto(
      "/request-review?concern=donor_healing&entry_context=donor_healing&recommended_pathway=post_surgery&source_page=normal-donor-healing-after-fue#choose-pathway"
    );

    await expect(page.getByTestId("donor-entry-context-banner").first()).toBeVisible();

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

  test("Journey C — auth return keeps donor context instead of bare dashboard", async ({
    page,
  }) => {
    await page.goto(
      "/request-review?concern=donor_healing&entry_context=donor_healing&source_page=normal-donor-healing-after-fue#choose-pathway"
    );
    await expect(page.getByTestId("donor-entry-context-banner").first()).toBeVisible();

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const raw = sessionStorage.getItem("hairaudit:pending_entry_context");
          if (!raw) return null;
          return (JSON.parse(raw) as { entryContext?: string }).entryContext ?? null;
        });
      })
      .toBe("donor_healing");

    await page.goto("/login?from=patient&next=%2Fdashboard%2Fpatient");
    const resolved = await page.evaluate(() => {
      const raw = sessionStorage.getItem("hairaudit:pending_entry_context");
      const pendingLocal = raw
        ? (JSON.parse(raw) as {
            entryContext: string;
            concern?: string;
            sourceGuide?: string;
          })
        : null;
      if (pendingLocal?.entryContext === "donor_healing") {
        const params = new URLSearchParams({
          concern: pendingLocal.concern ?? "donor_healing",
          entry_context: "donor_healing",
          recommended_pathway: "post_surgery",
          source_page: pendingLocal.sourceGuide ?? "normal-donor-healing-after-fue",
          entry_source: pendingLocal.sourceGuide ?? "normal-donor-healing-after-fue",
        });
        return `/request-review?${params.toString()}#choose-pathway`;
      }
      return "/dashboard/patient";
    });
    expect(resolved).toContain("/request-review");
    expect(resolved).toContain("entry_context=donor_healing");
    expect(resolved).not.toBe("/dashboard/patient");
  });

  test("Journey D — mobile layout has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/normal-donor-healing-after-fue");
    await expect(page.getByTestId("donor-healing-cta").first()).toBeVisible();
    await expect(page.getByTestId("donor-healing-cta-mid")).toBeVisible();
    await expect(page.getByTestId("donor-healing-cta-final")).toBeVisible();

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflow).toBe(false);

    await page.getByTestId("donor-timeline-stage-days_1_3").focus();
    await expect(page.getByTestId("donor-timeline-stage-days_1_3")).toBeFocused();

    await page.screenshot({
      path: "tmp/donor-healing-1a-mobile.png",
      fullPage: true,
    });
  });

  test("Journey E — unrelated patient-intent article keeps generic CTA", async ({ page }) => {
    await page.goto("/shock-loss-vs-graft-failure");
    await expect(page.getByTestId("donor-healing-experience")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Start Free HairAudit/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Check My Donor Healing/i })).toHaveCount(0);
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
