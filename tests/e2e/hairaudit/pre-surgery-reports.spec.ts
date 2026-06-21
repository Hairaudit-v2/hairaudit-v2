import { test, expect, loginAsPatient, skipIfE2eBlocked } from "../fixtures/hairaudit.fixture";

test.describe("Pre-surgery report rendering (demo QA seed)", () => {
  test.beforeEach(() => skipIfE2eBlocked());

  for (let index = 1; index <= 10; index += 1) {
    test(`demo case ${String(index).padStart(2, "0")} renders pre-surgery planning report`, async ({
      page,
      catalog,
      demoPassword,
    }) => {
      const entry = catalog.preSurgery.find((c) => c.index === index);
      test.skip(!entry?.reportId, `Missing seeded pre-surgery demo case ${index}`);

      await loginAsPatient(page, entry!.email, demoPassword);
      await page.goto(`/cases/${entry!.caseId}`);

      const shell = page.getByTestId("pre-surgery-report-shell");
      await expect(shell).toBeVisible();

      await expect(shell.getByRole("heading", { level: 2 })).toContainText(/pre-surgery review/i);
      await expect(shell.getByText("Planning assessment scorecards")).toBeVisible();
      await expect(shell.getByText("Recommended Next Steps")).toBeVisible();

      const pdfLink = page.getByTestId("report-pdf-link");
      await expect(pdfLink).toBeVisible();
      await expect(pdfLink).toHaveAttribute("href", new RegExp(`/api/reports/${entry!.reportId}/download`));

      await expect(page.getByTestId("post-surgery-report-shell")).toHaveCount(0);
      await expect(page.getByText("Post-surgery review complete")).toHaveCount(0);
      await expect(page.getByText("Procedural assessment scores")).toHaveCount(0);
    });
  }
});
