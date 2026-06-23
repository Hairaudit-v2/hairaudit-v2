import { test, expect, loginAsPatient, skipIfE2eBlocked, skipIfDemoCatalogMissing } from "../fixtures/hairaudit.fixture";

test.describe("Mobile report layout smoke tests", () => {
  test.beforeEach(() => {
    skipIfE2eBlocked();
    skipIfDemoCatalogMissing();
  });

  test("pre-surgery report has no horizontal overflow and stacked scorecards", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    const entry = catalog.preSurgery[0];
    test.skip(!entry?.reportId, "Missing pre-surgery demo report");

    await loginAsPatient(page, entry.email, demoPassword);
    await page.goto(`/cases/${entry.caseId}`);

    const shell = page.getByTestId("pre-surgery-report-shell");
    await expect(shell).toBeVisible();

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 2;
    });
    expect(overflow).toBe(false);

    const scorecardGrid = shell.locator(".grid").first();
    await expect(scorecardGrid).toBeVisible();

    const pdfLink = page.getByTestId("report-pdf-link");
    await expect(pdfLink).toBeVisible();
    await expect(pdfLink).toBeInViewport();
  });

  test("post-surgery report has no horizontal overflow and visible CTAs", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    const entry = catalog.postSurgery[0];
    test.skip(!entry?.reportId, "Missing post-surgery demo report");

    await loginAsPatient(page, entry.email, demoPassword);
    await page.goto(`/cases/${entry.caseId}`);

    const shell = page.getByTestId("post-surgery-report-shell");
    await expect(shell).toBeVisible();

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 2;
    });
    expect(overflow).toBe(false);

    const pdfLink = page.getByTestId("report-pdf-link");
    await expect(pdfLink).toBeVisible();
    await expect(pdfLink).toBeInViewport();
  });
});
