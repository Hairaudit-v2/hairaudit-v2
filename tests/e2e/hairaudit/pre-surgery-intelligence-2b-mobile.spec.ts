/**
 * HA-PRE-SURGERY-INTELLIGENCE-2B — Mobile viewport coverage for professional workspace.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  test,
  expect,
  loginAsPatient,
  skipIfE2eBlocked,
  skipIfDemoCatalogMissing,
} from "../fixtures/hairaudit.fixture";

const evidenceDir = path.join("tmp", "pre-surgery-intelligence-2b-evidence");

test.describe("Pre-surgery intelligence 2B @psi @mobile", () => {
  test.beforeEach(() => {
    skipIfE2eBlocked();
    skipIfDemoCatalogMissing();
  });

  test("patient denied on mobile viewport", async ({ page, catalog, demoPassword }) => {
    const entry = catalog.preSurgery[0];
    test.skip(!entry?.caseId, "No pre-surgery demo case");
    await fs.promises.mkdir(evidenceDir, { recursive: true });

    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}/professional/pre-surgery-review`);
    await page.waitForTimeout(2000);
    await expect(page.getByTestId("pre-surgery-intelligence-workspace")).toHaveCount(0);
    await page.screenshot({
      path: path.join(evidenceDir, "patient-denied-mobile.png"),
      fullPage: true,
    });
  });

  test("auditor workspace renders on mobile when credentials present", async ({
    page,
    catalog,
  }) => {
    const email = process.env.E2E_AUDITOR_EMAIL;
    const password = process.env.E2E_AUDITOR_PASSWORD;
    test.skip(!email || !password, "E2E_AUDITOR_EMAIL/PASSWORD not set");
    const entry = catalog.preSurgery[0];
    test.skip(!entry?.caseId, "No pre-surgery demo case");
    await fs.promises.mkdir(evidenceDir, { recursive: true });

    await page.goto("/login/auditor");
    await page.locator("#email").fill(email!);
    await page.locator("#password").fill(password!);
    await page.getByRole("button", { name: /sign in/i }).first().click();
    await page.waitForTimeout(1500);
    await page.goto(`/cases/${entry!.caseId}/professional/pre-surgery-review`);
    await expect(page.getByTestId("pre-surgery-intelligence-workspace")).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({
      path: path.join(evidenceDir, "auditor-workspace-mobile.png"),
      fullPage: true,
    });
  });
});
