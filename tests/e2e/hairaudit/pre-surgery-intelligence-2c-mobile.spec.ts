/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Mobile clinician review twin.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  test,
  expect,
  skipIfE2eBlocked,
  skipIfDemoCatalogMissing,
} from "../fixtures/hairaudit.fixture";

const evidenceDir = path.join("tmp", "pre-surgery-intelligence-2c-evidence");

async function ensureEvidenceDir() {
  await fs.promises.mkdir(evidenceDir, { recursive: true });
}

async function loginGeneric(
  page: import("playwright/test").Page,
  email: string,
  password: string
) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.waitForTimeout(1500);
}

test.describe("Pre-surgery intelligence 2C mobile @psi @mobile", () => {
  test.beforeEach(() => {
    skipIfE2eBlocked();
    skipIfDemoCatalogMissing();
  });

  test("mobile clinician projection review surface", async ({ page, catalog }) => {
    const email = process.env.E2E_AUDITOR_EMAIL;
    const password = process.env.E2E_AUDITOR_PASSWORD;
    test.skip(!email || !password, "E2E_AUDITOR_EMAIL/PASSWORD not set");

    const entry = catalog.preSurgery[0];
    test.skip(!entry?.caseId, "No pre-surgery demo case");
    await ensureEvidenceDir();

    await loginGeneric(page, email!, password!);
    await page.goto(`/cases/${entry!.caseId}/professional/pre-surgery-review`);
    await page.waitForTimeout(2500);
    await expect(page.getByTestId("pre-surgery-intelligence-workspace")).toHaveCount(1);
    await expect(page.getByTestId("psi-projection-section")).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "clinician-projection-workspace-mobile.png"),
      fullPage: true,
    });
  });
});
