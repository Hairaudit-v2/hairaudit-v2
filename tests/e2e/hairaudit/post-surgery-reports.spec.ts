import { test, expect, loginAsPatient, skipIfE2eBlocked, skipIfDemoCatalogMissing } from "../fixtures/hairaudit.fixture";

test.describe("Post-surgery report rendering (demo QA seed)", () => {
  test.beforeEach(() => {
    skipIfE2eBlocked();
    skipIfDemoCatalogMissing();
  });

  for (let index = 1; index <= 10; index += 1) {
    test(`demo case ${String(index).padStart(2, "0")} renders post-surgery audit report`, async ({
      page,
      catalog,
      demoPassword,
    }) => {
      const entry = catalog.postSurgery.find((c) => c.index === index);
      test.skip(!entry?.reportId, `Missing seeded post-surgery demo case ${index}`);

      await loginAsPatient(page, entry!.email, demoPassword);
      await page.goto(`/cases/${entry!.caseId}`);

      const shell = page.getByTestId("post-surgery-report-shell");
      await expect(shell).toBeVisible();

      await expect(shell.getByRole("heading", { level: 2 })).toContainText(/post-surgery audit/i);
      await expect(shell.getByText("Procedural assessment scores")).toBeVisible();
      await expect(shell.getByText("Recommended Next Steps")).toBeVisible();

      const pdfLink = page.getByTestId("report-pdf-link");
      await expect(pdfLink).toBeVisible();
      await expect(pdfLink).toHaveAttribute("href", new RegExp(`/api/reports/${entry!.reportId}/download`));

      await expect(page.getByTestId("pre-surgery-report-shell")).toHaveCount(0);
      await expect(page.getByText("Pre-surgery review complete")).toHaveCount(0);
      await expect(page.getByText("Planning assessment scorecards")).toHaveCount(0);
    });
  }
});
