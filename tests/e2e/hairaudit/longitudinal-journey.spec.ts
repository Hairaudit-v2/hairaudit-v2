/**
 * FI-OUTCOME-INTELLIGENCE-1F — PR smoke browser journeys (@longitudinal @smoke).
 *
 * Requires:
 *   FI_LONGITUDINAL_E2E_FIXTURES_ENABLED=true pnpm longitudinal-e2e:seed
 *   FI_LONGITUDINAL_CAPTURE_UI_ENABLED=true (app env)
 */

import {
  test,
  expect,
  loginAsPatient,
  skipIfE2eBlocked,
} from "../fixtures/hairaudit.fixture";
import { LongitudinalLandingPage } from "../helpers/longitudinal/LongitudinalLandingPage";
import { GuidedCapturePage } from "../helpers/longitudinal/GuidedCapturePage";
import {
  loadLongitudinalE2eCatalog,
  requireCatalogEntry,
  skipIfLongitudinalCatalogMissing,
} from "../helpers/longitudinal/catalog";
import * as fs from "node:fs";
import { syntheticImagePath } from "../../fixtures/longitudinalE2e/syntheticImagePaths";

const catalog = loadLongitudinalE2eCatalog();

test.describe("Longitudinal E2E smoke @longitudinal @patient @projection @smoke", () => {
  test.beforeEach(async () => {
    skipIfE2eBlocked();
    skipIfLongitudinalCatalogMissing(test, catalog);
    test.skip(
      !fs.existsSync(syntheticImagePath("front")),
      "Synthetic images missing — run longitudinal-e2e:seed"
    );
  });

  test("A. Month 6 due → complete required → ready_for_review", async ({
    page,
  }) => {
    const entry = requireCatalogEntry(catalog, "FRONTAL");
    test.skip(!entry, "FRONTAL fixture missing");

    await loginAsPatient(page, entry!.email, entry!.password);
    const guided = new GuidedCapturePage(page);
    await guided.open(entry!.caseId, entry!.focusStage);

    const dto = await guided.pollGuidedApi(
      entry!.caseId,
      entry!.focusStage,
      (j) => j.status === "due" || j.status === "evidence_incomplete"
    );
    const progress = dto.progress as {
      requiredTotal: number;
      requiredComplete: number;
    };
    expect(progress.requiredTotal).toBeGreaterThanOrEqual(3);

    await guided.completeAllRequired(progress.requiredTotal);

    await guided.pollGuidedApi(
      entry!.caseId,
      entry!.focusStage,
      (j) => j.status === "ready_for_review"
    );
    await expect(guided.complete()).toContainText(/complete/i);
  });

  test("B. partial capture → resume at first missing required", async ({
    page,
  }) => {
    const entry = requireCatalogEntry(catalog, "RESUME");
    test.skip(!entry, "RESUME fixture missing");

    await loginAsPatient(page, entry!.email, entry!.password);
    const guided = new GuidedCapturePage(page);
    await guided.open(entry!.caseId, entry!.focusStage);

    await guided.pollGuidedApi(
      entry!.caseId,
      entry!.focusStage,
      (j) => j.status === "evidence_incomplete"
    );

    await guided.startCapture();
    await guided.expectViewLabel(/Recipient Close-up/i);
    await expect(guided.viewStep()).not.toContainText(/^Front View$/i);
  });

  test("I. cross-patient access denied", async ({ page }) => {
    const a = requireCatalogEntry(catalog, "ISOLATION-A");
    const b = requireCatalogEntry(catalog, "ISOLATION-B");
    test.skip(!a || !b, "ISOLATION fixtures missing");

    await loginAsPatient(page, a!.email, a!.password);

    const landingRes = await page.goto(
      `/cases/${b!.caseId}/patient/follow-up`,
      { waitUntil: "domcontentloaded" }
    );
    // Gateway redirects to dashboard or shows denied — must not render B's wizard.
    const status = landingRes?.status() ?? 200;
    expect(status).toBeLessThan(500);
    await expect(page.getByTestId("guided-capture-wizard")).toHaveCount(0);
    await expect(page.getByTestId("longitudinal-capture-landing")).toHaveCount(0);

    const stageRes = await page.request.get(
      `/api/patient/cases/${encodeURIComponent(b!.caseId)}/guided-capture?stage=month_6`
    );
    expect([401, 403, 404]).toContain(stageRes.status());
  });
});
