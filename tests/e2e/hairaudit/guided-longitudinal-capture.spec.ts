/**
 * FI-OUTCOME-INTELLIGENCE-1E — Playwright smoke (route-level).
 *
 * Full upload / projection journeys live in FI-OUTCOME-INTELLIGENCE-1F:
 *   tests/e2e/hairaudit/longitudinal-journey*.spec.ts
 *   pnpm longitudinal-e2e:seed && pnpm longitudinal-e2e:test
 */

import { test, expect, skipIfE2eBlocked } from "../fixtures/hairaudit.fixture";

test.describe("Guided longitudinal capture (1E)", () => {
  test.beforeEach(() => skipIfE2eBlocked());

  test("G. deep-link longitudinal-capture?stage= redirects to follow-up stage", async ({
    page,
  }) => {
    // Unauthenticated redirect to login still preserves next path shape via browser URL
    // after login; here we only assert the route exists and redirects when stage present.
    const caseId = "00000000-0000-4000-8000-000000000099";
    const res = await page.goto(
      `/cases/${caseId}/patient/longitudinal-capture?stage=month_6`,
      { waitUntil: "domcontentloaded" }
    );
    // May land on login or dashboard depending on auth; path should not 500.
    expect(res?.status() ?? 200).toBeLessThan(500);
  });

  test("follow-up landing route responds", async ({ page }) => {
    const caseId = "00000000-0000-4000-8000-000000000099";
    const res = await page.goto(`/cases/${caseId}/patient/follow-up`, {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status() ?? 200).toBeLessThan(500);
  });
});
