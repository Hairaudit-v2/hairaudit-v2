import { test, expect, loginAsPatient, skipIfE2eBlocked } from "../fixtures/hairaudit.fixture";
import { ensureProcessingCaseForUser } from "../helpers/demoQaCatalog";
import { tryCreateSupabaseAdminClient } from "../../../src/lib/supabase/admin";

test.describe("Waiting timeline (submitted, no PDF)", () => {
  test.beforeEach(() => skipIfE2eBlocked());

  test("shows live processing timeline, polls status, then ready state", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    const entry = catalog.postSurgery[0];
    test.skip(!entry, "No demo post-surgery case for processing test");

    const admin = tryCreateSupabaseAdminClient();
    test.skip(!admin, "Supabase admin unavailable");

    const { data: userRow } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = userRow?.users.find((u) => u.email?.toLowerCase() === entry.email.toLowerCase());
    test.skip(!user?.id, `Demo user not found: ${entry.email}`);

    const processingCaseId = await ensureProcessingCaseForUser({
      userId: user!.id,
      pathway: "post_surgery",
    });
    test.skip(!processingCaseId, "Could not create processing case");

    let pollCount = 0;
    await page.route(`**/api/patient/cases/${processingCaseId}/status`, async (route) => {
      pollCount += 1;
      const reportReady = pollCount >= 2;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          caseId: processingCaseId,
          status: reportReady ? "complete" : "submitted",
          reportReady,
          reportUrl: reportReady ? `/cases/${processingCaseId}` : null,
          submittedAt: new Date().toISOString(),
          maskedEmail: "p***@hairaudit.test",
          timeline: [
            { stage: "photos_received", state: "complete" },
            { stage: "clinical_review", state: reportReady ? "complete" : "active" },
            { stage: "report_preparation", state: reportReady ? "ready" : "pending" },
          ],
        }),
      });
    });

    await loginAsPatient(page, entry.email, demoPassword);
    await page.goto(`/cases/${processingCaseId}`);

    const timeline = page.getByTestId("patient-processing-timeline");
    await expect(timeline).toBeVisible();
    await expect(timeline).toHaveAttribute("data-processing-state", "waiting");

    await expect(page.getByTestId("post-surgery-report-shell")).toHaveCount(0);
    await expect(page.getByTestId("pre-surgery-report-shell")).toHaveCount(0);

    await expect(page.getByText("Photos received")).toBeVisible();
    await expect(page.getByText("Live")).toBeVisible();
    await expect(page.getByText(/independent review in progress|being reviewed now/i)).toBeVisible();

    await expect(timeline).toHaveAttribute("data-processing-state", "ready", { timeout: 25_000 });
    await expect(page.getByText("Your report is ready")).toBeVisible();
    expect(pollCount).toBeGreaterThanOrEqual(2);
  });
});
