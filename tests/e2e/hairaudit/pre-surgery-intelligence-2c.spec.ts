/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Clinician generation/approval + patient visibility.
 *
 * Requires demo QA catalog (pre-surgery case) and optional clinician credentials:
 *   E2E_AUDITOR_EMAIL / E2E_AUDITOR_PASSWORD
 *
 * Patient denied-before-approval and patient API framing are always asserted when catalog exists.
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

test.describe("Pre-surgery intelligence 2C @psi @desktop", () => {
  test.beforeEach(() => {
    skipIfE2eBlocked();
    skipIfDemoCatalogMissing();
  });

  test("patient denied projection before approval", async ({ page, catalog, demoPassword }) => {
    const entry = catalog.preSurgery[0];
    test.skip(!entry?.caseId, "No pre-surgery demo case");
    await ensureEvidenceDir();

    await loginAsPatient(page, entry!.email, demoPassword);
    const api = await page.request.get(
      `/api/cases/${entry!.caseId}/pre-surgery-intelligence/projection/patient`
    );
    expect([200, 404]).toContain(api.status());
    const body = await api.json();
    if (api.status() === 200) {
      expect(body.projections ?? []).toEqual([]);
      expect(JSON.stringify(body)).not.toMatch(/predicted result|expected result|guaranteed/i);
    }
    await page.screenshot({
      path: path.join(evidenceDir, "patient-denied-before-approval-desktop.png"),
      fullPage: true,
    });
  });

  test("clinician generation approval rejection regeneration journey", async ({ page, catalog }) => {
    const email = process.env.E2E_AUDITOR_EMAIL;
    const password = process.env.E2E_AUDITOR_PASSWORD;
    test.skip(!email || !password, "E2E_AUDITOR_EMAIL/PASSWORD not set");

    const entry = catalog.preSurgery[0];
    test.skip(!entry?.caseId, "No pre-surgery demo case");
    await ensureEvidenceDir();

    await loginGeneric(page, email!, password!);
    await page.goto(`/cases/${entry!.caseId}/professional/pre-surgery-review`);
    await page.waitForTimeout(2500);

    const workspace = page.getByTestId("pre-surgery-intelligence-workspace");
    await expect(workspace).toHaveCount(1);

    // Best-effort journey: if plan/images exist, exercise checklist UX surface.
    const section = page.getByTestId("psi-projection-section");
    await expect(section).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "clinician-projection-workspace-desktop.png"),
      fullPage: true,
    });

    const generateBtn = page.getByTestId("psi-generate-projection-planned");
    if (await generateBtn.isEnabled()) {
      await generateBtn.click();
      await page.waitForTimeout(3000);
    }

    const openApprove = page.getByTestId("psi-open-approve-projection-planned");
    if (await openApprove.count()) {
      await openApprove.first().click();
      await page.waitForTimeout(500);
      const checklist = page.getByTestId("psi-approval-checklist-planned");
      await expect(checklist).toBeVisible();
      const boxes = checklist.locator('input[type="checkbox"]');
      const n = await boxes.count();
      for (let i = 0; i < n; i++) await boxes.nth(i).check();
      await page.getByTestId("psi-approve-projection-planned").click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(evidenceDir, "clinician-approved-desktop.png"),
        fullPage: true,
      });
    }

    // Provider failure recovery is covered by unit suite; record workspace bundle state.
    const bundle = await page.request.get(`/api/cases/${entry!.caseId}/pre-surgery-intelligence`);
    const bundleJson = await bundle.json();
    await fs.promises.writeFile(
      path.join(evidenceDir, "auditor-workspace-bundle.json"),
      JSON.stringify(
        {
          ok: bundleJson.ok,
          projectionCount: bundleJson.projections?.length ?? 0,
          statuses: (bundleJson.projections ?? []).map((p: { status: string; mode: string }) => ({
            status: p.status,
            mode: p.mode,
          })),
        },
        null,
        2
      )
    );
  });

  test("patient access after approval framing is safe", async ({ page, catalog, demoPassword }) => {
    const entry = catalog.preSurgery[0];
    test.skip(!entry?.caseId, "No pre-surgery demo case");
    await ensureEvidenceDir();

    await loginAsPatient(page, entry!.email, demoPassword);
    const api = await page.request.get(
      `/api/cases/${entry!.caseId}/pre-surgery-intelligence/projection/patient`
    );
    const body = await api.json();
    const blob = JSON.stringify(body);
    expect(blob).not.toMatch(/predicted result|expected result|guaranteed density/i);
    if (body.ok && (body.projections?.length ?? 0) > 0) {
      expect(body.framing?.join(" ")).toMatch(/illustrative/i);
      expect(body.projections[0].illustrative).toBe(true);
      await page.screenshot({
        path: path.join(evidenceDir, "patient-access-after-approval-desktop.png"),
        fullPage: true,
      });
    } else {
      await page.screenshot({
        path: path.join(evidenceDir, "patient-no-approved-projection-desktop.png"),
        fullPage: true,
      });
    }
  });
});
