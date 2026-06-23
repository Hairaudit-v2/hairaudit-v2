import { test, expect } from "../fixtures/hairaudit.fixture";
import { tryCreateSupabaseAdminClient } from "../../../src/lib/supabase/admin";
import {
  createEphemeralPatientUser,
  deleteEphemeralUser,
  loginPatient,
  logoutPatient,
  liveJourneyBlockedReason,
  startPatientAudit,
  LIVE_JOURNEY_PASSWORD,
} from "../helpers/liveJourney";
import { DEMO_QA_SEED_USER_PASSWORD } from "../helpers/demoQaCatalog";

test.describe("Live Supabase patient journey", () => {
  test.beforeEach(() => {
    const reason = liveJourneyBlockedReason();
    if (reason) test.skip(true, reason);
  });

  test("anonymous free audit start — pre-surgery and post-surgery", async ({ page }) => {
    await page.context().clearCookies();

    for (const pathway of ["pre_surgery", "post_surgery"] as const) {
      const started = await startPatientAudit(page, pathway);
      expect(started, `audit/start failed for ${pathway}`).not.toBeNull();

      await page.goto(started!.next);
      await expect(page.getByTestId("guided-upload-wizard")).toBeVisible();
      await expect(page.getByTestId("guided-upload-step")).toHaveCount(1);

      const label =
        pathway === "pre_surgery" ? "Pre-Surgery Review" : "Post-Surgery Audit";
      await expect(page.getByTestId("guided-upload-pathway-label")).toHaveText(label);

      await page.context().clearCookies();
    }
  });

  test("pre-surgery upload wizard loads required first step", async ({ page }) => {
    await page.context().clearCookies();
    const started = await startPatientAudit(page, "pre_surgery");
    test.skip(!started, "Could not start pre-surgery audit");

    await page.goto(started!.next);
    await expect(page.getByText("Photo Facing Forward")).toBeVisible();
    await expect(page.getByTestId("guided-upload-continue")).toHaveCount(0);
  });

  test("post-surgery upload wizard loads required first step", async ({ page }) => {
    await page.context().clearCookies();
    const started = await startPatientAudit(page, "post_surgery");
    test.skip(!started, "Could not start post-surgery audit");

    await page.goto(started!.next);
    await expect(page.getByText("Front Photo")).toBeVisible();
    await expect(page.getByTestId("guided-upload-continue")).toHaveCount(0);
  });

  test("logout and login resume incomplete case", async ({ page }) => {
    const admin = tryCreateSupabaseAdminClient();
    test.skip(!admin, "Supabase admin unavailable");

    const patient = await createEphemeralPatientUser(admin);
    test.skip(!patient, "Could not create ephemeral patient user");

    try {
      await loginPatient(page, patient!.email, patient!.password);

      const started = await startPatientAudit(page, "pre_surgery");
      test.skip(!started, "Could not start audit for resume test");

      await page.goto(started!.next);
      await expect(page.getByTestId("guided-upload-wizard")).toBeVisible();

      await logoutPatient(page);
      await loginPatient(page, patient!.email, patient!.password);

      await page.goto("/dashboard/patient");
      const panel = page.getByTestId("patient-resume-review-panel");
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute("data-resume-step", "photos_incomplete");

      const resumeCta = page.getByTestId("patient-resume-primary-cta");
      await expect(resumeCta).toBeVisible();
      await resumeCta.click();
      await page.waitForURL(new RegExp(`/cases/${started!.caseId}/patient/photos`));
      await expect(page.getByTestId("guided-upload-wizard")).toBeVisible();
    } finally {
      if (patient?.userId) {
        await deleteEphemeralUser(admin, patient.userId);
      }
    }
  });

  test("patient cannot download another patient report PDF", async ({ page }) => {
    test.skip(process.env.E2E_HAS_DEMO_CATALOG !== "true", "Demo QA catalog required for cross-patient PDF test");

    const raw = process.env.E2E_DEMO_CATALOG_JSON;
    test.skip(!raw, "Missing demo catalog JSON");

    const catalog = JSON.parse(raw) as {
      preSurgery: Array<{ email: string; reportId: string | null }>;
      postSurgery: Array<{ email: string; reportId: string | null }>;
    };

    const owner = catalog.preSurgery[0];
    const other = catalog.postSurgery[0];
    test.skip(!owner?.reportId || !other?.email, "Demo catalog entries incomplete");

    const admin = tryCreateSupabaseAdminClient();
    test.skip(!admin, "Supabase admin unavailable");

    const intruder = await createEphemeralPatientUser(admin);
    test.skip(!intruder, "Could not create intruder user");

    try {
      await loginPatient(page, intruder!.email, LIVE_JOURNEY_PASSWORD);
      const response = await page.request.get(`/api/reports/${owner!.reportId}/download`);
      expect(response.status()).toBeGreaterThanOrEqual(403);
      expect(response.status()).toBeLessThan(500);
    } finally {
      await deleteEphemeralUser(admin, intruder!.userId);
    }
  });

  test("patient can download own report PDF when demo seed exists", async ({ page }) => {
    test.skip(process.env.E2E_HAS_DEMO_CATALOG !== "true", "Demo QA catalog required");

    const raw = process.env.E2E_DEMO_CATALOG_JSON;
    test.skip(!raw, "Missing demo catalog JSON");

    const catalog = JSON.parse(raw) as {
      preSurgery: Array<{ email: string; reportId: string | null; caseId: string }>;
    };
    const entry = catalog.preSurgery[0];
    test.skip(!entry?.reportId, "Missing pre-surgery demo report");

    await loginPatient(page, entry.email, DEMO_QA_SEED_USER_PASSWORD);

    const downloadResponse = await page.request.get(`/api/reports/${entry.reportId}/download`);
    expect(downloadResponse.status()).toBe(200);
    expect(downloadResponse.headers()["content-type"]).toContain("application/pdf");

    await page.goto(`/cases/${entry.caseId}`);
    await expect(page.getByTestId("pre-surgery-report-shell")).toBeVisible();
    await expect(page.getByTestId("report-pdf-link")).toBeVisible();
  });
});
