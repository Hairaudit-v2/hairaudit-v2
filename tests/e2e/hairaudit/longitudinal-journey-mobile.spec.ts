/**
 * FI-OUTCOME-INTELLIGENCE-1F — Mobile viewport capture smoke (375×812).
 */

import {
  test,
  expect,
  loginAsPatient,
  skipIfE2eBlocked,
} from "../fixtures/hairaudit.fixture";
import { GuidedCapturePage } from "../helpers/longitudinal/GuidedCapturePage";
import {
  loadLongitudinalE2eCatalog,
  requireCatalogEntry,
  skipIfLongitudinalCatalogMissing,
} from "../helpers/longitudinal/catalog";
import * as fs from "node:fs";
import { syntheticImagePath } from "../../fixtures/longitudinalE2e/syntheticImagePaths";

const catalog = loadLongitudinalE2eCatalog();

test.describe("Longitudinal E2E mobile @longitudinal @patient @smoke", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async () => {
    skipIfE2eBlocked();
    skipIfLongitudinalCatalogMissing(test, catalog);
    test.skip(
      !fs.existsSync(syntheticImagePath("front")),
      "Synthetic images missing — run longitudinal-e2e:seed"
    );
  });

  test("mobile Month 6 capture CTA and progress usable", async ({ page }) => {
    const entry = requireCatalogEntry(catalog, "FRONTAL");
    test.skip(!entry, "FRONTAL fixture missing");

    await loginAsPatient(page, entry!.email, entry!.password);
    const guided = new GuidedCapturePage(page);
    await guided.open(entry!.caseId, entry!.focusStage);

    await expect(guided.wizard()).toBeVisible();
    await expect(guided.progress()).toBeVisible();

    const progressBox = await guided.progress().boundingBox();
    expect(progressBox).toBeTruthy();
    expect(progressBox!.width).toBeLessThanOrEqual(375);

    await guided.startCapture();
    if (await guided.viewStep().isVisible().catch(() => false)) {
      await expect(guided.choosePhoto()).toBeVisible();
      const ctaBox = await guided.choosePhoto().boundingBox();
      expect(ctaBox).toBeTruthy();
      expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(812 + 80);
    }
  });
});
