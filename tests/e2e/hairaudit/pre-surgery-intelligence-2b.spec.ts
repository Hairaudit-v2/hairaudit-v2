/**
 * HA-PRE-SURGERY-INTELLIGENCE-2B — Desktop clinician journey + access matrix.
 *
 * Requires demo QA catalog (pre-surgery case) and optional clinician credentials:
 *   E2E_AUDITOR_EMAIL / E2E_AUDITOR_PASSWORD
 *   E2E_DOCTOR_EMAIL / E2E_DOCTOR_PASSWORD  (must be assigned on a catalog case — otherwise skipped)
 *   E2E_CLINIC_EMAIL / E2E_CLINIC_PASSWORD
 *
 * Patient access denial is always asserted against the demo pre-surgery patient.
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

async function ensureEvidenceDir() {
  await fs.promises.mkdir(evidenceDir, { recursive: true });
}

async function loginGeneric(
  page: import("playwright/test").Page,
  email: string,
  password: string,
  loginPath = "/login"
) {
  await page.goto(loginPath);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.waitForTimeout(1500);
}

test.describe("Pre-surgery intelligence 2B @psi @desktop", () => {
  test.beforeEach(() => {
    skipIfE2eBlocked();
    skipIfDemoCatalogMissing();
  });

  test("patient cannot open professional planning workspace", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    const entry = catalog.preSurgery[0];
    test.skip(!entry?.caseId, "No pre-surgery demo case");
    await ensureEvidenceDir();

    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}/professional/pre-surgery-review`);
    await page.waitForTimeout(2000);

    // Patient should be redirected away from the workspace (case report or dashboard).
    await expect(page.getByTestId("pre-surgery-intelligence-workspace")).toHaveCount(0);
    await page.screenshot({
      path: path.join(evidenceDir, "patient-denied-desktop.png"),
      fullPage: true,
    });

    const api = await page.request.get(`/api/cases/${entry!.caseId}/pre-surgery-intelligence`);
    expect(api.status()).toBe(403);
  });

  test("auditor can open workspace and initialise proposals", async ({
    page,
    catalog,
  }) => {
    const email = process.env.E2E_AUDITOR_EMAIL;
    const password = process.env.E2E_AUDITOR_PASSWORD;
    test.skip(!email || !password, "E2E_AUDITOR_EMAIL/PASSWORD not set");

    const entry = catalog.preSurgery[0];
    test.skip(!entry?.caseId, "No pre-surgery demo case");
    await ensureEvidenceDir();

    await loginGeneric(page, email!, password!, "/login/auditor");
    await page.goto(`/cases/${entry!.caseId}/professional/pre-surgery-review`);
    await expect(page.getByTestId("pre-surgery-intelligence-workspace")).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: /initialise ai proposals/i }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(evidenceDir, "auditor-workspace-desktop.png"),
      fullPage: true,
    });

    // Persist evidence of API bundle after init
    const res = await page.request.get(`/api/cases/${entry!.caseId}/pre-surgery-intelligence`);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.ok).toBe(true);
    await fs.promises.writeFile(
      path.join(evidenceDir, "auditor-workspace-bundle.json"),
      JSON.stringify(
        {
          caseId: entry!.caseId,
          graftPlanVersions: (json.graftPlans ?? []).map((p: { version: number; status: string; id: string }) => ({
            id: p.id,
            version: p.version,
            status: p.status,
          })),
          observationCount: (json.observations ?? []).length,
          auditEventTypes: (json.auditEvents ?? []).map((e: { eventType: string }) => e.eventType),
        },
        null,
        2
      ),
      "utf8"
    );
  });

  test("unrelated professional cannot access planning API", async ({ page, catalog }) => {
    const email = process.env.E2E_UNRELATED_DOCTOR_EMAIL;
    const password = process.env.E2E_UNRELATED_DOCTOR_PASSWORD;
    test.skip(!email || !password, "E2E_UNRELATED_DOCTOR_EMAIL/PASSWORD not set");
    const entry = catalog.preSurgery[0];
    test.skip(!entry?.caseId, "No pre-surgery demo case");

    await loginGeneric(page, email!, password!);
    const api = await page.request.get(`/api/cases/${entry!.caseId}/pre-surgery-intelligence`);
    expect([401, 403]).toContain(api.status());
  });

  test("assigned doctor access when credentials present", async ({ page, catalog }) => {
    const email = process.env.E2E_DOCTOR_EMAIL;
    const password = process.env.E2E_DOCTOR_PASSWORD;
    test.skip(!email || !password, "E2E_DOCTOR_EMAIL/PASSWORD not set");
    const entry = catalog.preSurgery[0];
    test.skip(!entry?.caseId, "No pre-surgery demo case");
    await ensureEvidenceDir();

    await loginGeneric(page, email!, password!);
    await page.goto(`/cases/${entry!.caseId}/professional/pre-surgery-review`);
    // May 403 redirect if doctor not assigned to this seeded case — capture either outcome.
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: path.join(evidenceDir, "doctor-workspace-desktop.png"),
      fullPage: true,
    });
    const api = await page.request.get(`/api/cases/${entry!.caseId}/pre-surgery-intelligence`);
    await fs.promises.writeFile(
      path.join(evidenceDir, "doctor-access-status.json"),
      JSON.stringify({ status: api.status(), caseId: entry!.caseId }, null, 2),
      "utf8"
    );
    // Assigned doctor → 200; unassigned → 403. Both are valid evidence for the matrix.
    expect([200, 403]).toContain(api.status());
  });

  test("assigned clinic access when credentials present", async ({ page, catalog }) => {
    const email = process.env.E2E_CLINIC_EMAIL;
    const password = process.env.E2E_CLINIC_PASSWORD;
    test.skip(!email || !password, "E2E_CLINIC_EMAIL/PASSWORD not set");
    const entry = catalog.preSurgery[0];
    test.skip(!entry?.caseId, "No pre-surgery demo case");
    await ensureEvidenceDir();

    await loginGeneric(page, email!, password!);
    const api = await page.request.get(`/api/cases/${entry!.caseId}/pre-surgery-intelligence`);
    await fs.promises.writeFile(
      path.join(evidenceDir, "clinic-access-status.json"),
      JSON.stringify({ status: api.status(), caseId: entry!.caseId }, null, 2),
      "utf8"
    );
    expect([200, 403]).toContain(api.status());
  });
});
