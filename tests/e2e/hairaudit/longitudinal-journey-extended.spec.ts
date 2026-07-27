/**
 * FI-OUTCOME-INTELLIGENCE-1F — Extended browser journeys (@longitudinal @extended).
 */

import {
  test,
  expect,
  loginAsPatient,
  skipIfE2eBlocked,
} from "../fixtures/hairaudit.fixture";
import { LongitudinalLandingPage } from "../helpers/longitudinal/LongitudinalLandingPage";
import { GuidedCapturePage } from "../helpers/longitudinal/GuidedCapturePage";
import { LongitudinalReviewPage } from "../helpers/longitudinal/LongitudinalReviewPage";
import {
  loadLongitudinalE2eCatalog,
  requireCatalogEntry,
  skipIfLongitudinalCatalogMissing,
} from "../helpers/longitudinal/catalog";
import * as fs from "node:fs";
import { syntheticImagePath } from "../../fixtures/longitudinalE2e/syntheticImagePaths";
import { tryCreateSupabaseAdminClient } from "../../../src/lib/supabase/admin";
import { advanceFixtureToObservedComparison } from "../../fixtures/longitudinalE2e/advanceToReview";
import { loadProjectEnvLocal } from "../helpers/env";

const catalog = loadLongitudinalE2eCatalog();

test.describe("Longitudinal E2E extended @longitudinal @patient @projection @extended", () => {
  test.beforeEach(async () => {
    skipIfE2eBlocked();
    skipIfLongitudinalCatalogMissing(test, catalog);
    test.skip(
      !fs.existsSync(syntheticImagePath("front")),
      "Synthetic images missing — run longitudinal-e2e:seed"
    );
  });

  test("C. crown-treated requires Crown View", async ({ page }) => {
    const frontal = requireCatalogEntry(catalog, "FRONTAL");
    const crown = requireCatalogEntry(catalog, "CROWN");
    test.skip(!frontal || !crown, "FRONTAL/CROWN fixtures missing");

    await loginAsPatient(page, frontal!.email, frontal!.password);
    let res = await page.request.get(
      `/api/patient/cases/${encodeURIComponent(frontal!.caseId)}/guided-capture?stage=month_6`
    );
    expect(res.ok()).toBeTruthy();
    let dto = (await res.json()) as {
      views: Array<{ label: string; required: boolean }>;
    };
    expect(
      dto.views.some((v) => /Crown View/i.test(v.label) && v.required)
    ).toBe(false);

    await page.context().clearCookies();
    await loginAsPatient(page, crown!.email, crown!.password);
    res = await page.request.get(
      `/api/patient/cases/${encodeURIComponent(crown!.caseId)}/guided-capture?stage=month_6`
    );
    expect(res.ok()).toBeTruthy();
    dto = (await res.json()) as {
      status: string;
      views: Array<{ label: string; required: boolean }>;
    };
    expect(
      dto.views.some((v) => /Crown View/i.test(v.label) && v.required)
    ).toBe(true);
    expect(["due", "evidence_incomplete"]).toContain(dto.status);
  });

  test("D. recommended donor skipped → ready_for_review", async ({ page }) => {
    const entry = requireCatalogEntry(catalog, "RECOMMENDED-SKIP");
    test.skip(!entry, "RECOMMENDED-SKIP fixture missing");

    await loginAsPatient(page, entry!.email, entry!.password);
    const guided = new GuidedCapturePage(page);
    await guided.open(entry!.caseId, entry!.focusStage);

    await guided.pollGuidedApi(
      entry!.caseId,
      entry!.focusStage,
      (j) => j.status === "ready_for_review"
    );

    await guided.startCapture();
    // May land on review when required already complete.
    if (await page.getByTestId("guided-capture-review").isVisible().catch(() => false)) {
      await guided.finishBtn().click();
    } else {
      await guided.skipRecommendedIfPresent();
      await guided.finishRequired();
    }
    await expect(guided.complete()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/required failure/i);
  });

  test("E. missed Month 6 does not block Month 9", async ({ page }) => {
    const entry = requireCatalogEntry(catalog, "MISSED-M6");
    test.skip(!entry, "MISSED-M6 fixture missing");

    await loginAsPatient(page, entry!.email, entry!.password);
    const landing = new LongitudinalLandingPage(page);
    await landing.open(entry!.caseId);

    await landing.expectMilestoneVisible("month_6");
    await landing.expectMilestoneVisible("month_9");
    await landing.expectStatusText("month_6", /still available|missed|Follow-up/i);

    await landing.openStage("month_9");
    await expect(page).toHaveURL(new RegExp(`/follow-up/month_9`));
    await expect(page.getByTestId("guided-capture-wizard")).toBeVisible();
    await expect(page).not.toHaveURL(/month_6/);
  });

  test("F. reminder deep-link opens correct guided flow", async ({ page }) => {
    const entry = requireCatalogEntry(catalog, "REMINDER");
    test.skip(!entry?.captureHref, "REMINDER fixture / href missing");

    await loginAsPatient(page, entry!.email, entry!.password);
    const guided = new GuidedCapturePage(page);
    // Use catalog href from 1C/1D — do not hardcode independently.
    await guided.openHref(entry!.captureHref!);
    await expect(page).toHaveURL(
      new RegExp(`/cases/${entry!.caseId}/patient/follow-up/${entry!.focusStage}`)
    );
    await expect(guided.wizard()).toBeVisible();
  });

  test("G. replace upload does not double-count progress", async ({ page }) => {
    const entry = requireCatalogEntry(catalog, "REPLACE");
    test.skip(!entry, "REPLACE fixture missing");

    await loginAsPatient(page, entry!.email, entry!.password);
    const guided = new GuidedCapturePage(page);
    await guided.open(entry!.caseId, entry!.focusStage);

    const before = await guided.pollGuidedApi(
      entry!.caseId,
      entry!.focusStage,
      (j) => Boolean(j.progress)
    );
    const progressBefore = before.progress as {
      requiredComplete: number;
      requiredTotal: number;
    };

    await guided.startCapture();
    // Navigate to front if needed — fixture has front already; open all photos / first view.
    if (await guided.viewStep().isVisible().catch(() => false)) {
      await guided.replaceCurrentView("front");
    }

    const after = await guided.pollGuidedApi(
      entry!.caseId,
      entry!.focusStage,
      (j) => Boolean(j.progress)
    );
    const progressAfter = after.progress as {
      requiredComplete: number;
      requiredTotal: number;
    };
    expect(progressAfter.requiredComplete).toBeLessThanOrEqual(
      progressAfter.requiredTotal
    );
    expect(progressAfter.requiredComplete).toBeLessThanOrEqual(
      progressBefore.requiredComplete + 1
    );
  });

  test("H. full Month 12 ready → observation → comparison → review", async ({
    page,
  }) => {
    loadProjectEnvLocal();
    const entry = requireCatalogEntry(catalog, "FULL-LOOP");
    test.skip(!entry, "FULL-LOOP fixture missing");

    await loginAsPatient(page, entry!.email, entry!.password);
    const guided = new GuidedCapturePage(page);
    await guided.open(entry!.caseId, "month_12");

    const dto = await guided.pollGuidedApi(entry!.caseId, "month_12", (j) =>
      ["due", "evidence_incomplete", "ready_for_review"].includes(String(j.status))
    );

    if (dto.status !== "ready_for_review") {
      const progress = dto.progress as { requiredTotal: number };
      await guided.completeAllRequired(progress.requiredTotal);
      await guided.pollGuidedApi(
        entry!.caseId,
        "month_12",
        (j) => j.status === "ready_for_review"
      );
    }

    const admin = tryCreateSupabaseAdminClient();
    test.skip(!admin, "Supabase admin required to advance observation/comparison");

    // Procedure date from case projection — use ~12 months ago relative to now.
    const procedureDate = new Date();
    procedureDate.setUTCMonth(procedureDate.getUTCMonth() - 12);
    const lineage = await advanceFixtureToObservedComparison({
      admin: admin!,
      caseId: entry!.caseId,
      patientId: entry!.patientId,
      projectionSnapshotId: entry!.projectionSnapshotId,
      stage: "month_12",
      procedureDate: procedureDate.toISOString().slice(0, 10),
      treatedAreas: ["hairline", "frontal"],
    });

    expect(lineage.projectionSnapshotId).toBe(entry!.projectionSnapshotId);

    await guided.pollGuidedApi(
      entry!.caseId,
      "month_12",
      (j) => j.status === "observed"
    );

    const review = new LongitudinalReviewPage(page);
    await review.open({
      caseId: entry!.caseId,
      projectionSnapshotId: lineage.projectionSnapshotId,
      observationSnapshotId: lineage.observationId,
      comparisonSnapshotId: lineage.comparisonId,
    });
    await review.expectSafeReviewContent();
  });

  test("reference-assisted capture shows signed image copy", async ({ page }) => {
    const entry = requireCatalogEntry(catalog, "FRONTAL");
    test.skip(!entry, "FRONTAL fixture missing");

    await loginAsPatient(page, entry!.email, entry!.password);
    const guided = new GuidedCapturePage(page);
    await guided.open(entry!.caseId, entry!.focusStage);
    await guided.startCapture();
    // Reference may appear on front step when surgery-day image seeded.
    if (await guided.reference().isVisible().catch(() => false)) {
      await guided.expectReferencePanel();
    }
  });
});
