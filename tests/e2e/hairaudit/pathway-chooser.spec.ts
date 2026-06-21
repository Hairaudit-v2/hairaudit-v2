import { test, expect, skipIfE2eBlocked } from "../fixtures/hairaudit.fixture";

test.describe("Homepage pathway chooser", () => {
  test.beforeEach(() => skipIfE2eBlocked());

  test("shows both pathway CTAs and passes pathway to /api/audit/start", async ({ page }) => {
    await page.goto("/");

    const chooser = page.getByTestId("pathway-chooser");
    await expect(chooser).toBeVisible();

    const preCta = page.getByTestId("start-pre-surgery-review").first();
    const postCta = page.getByTestId("start-post-surgery-audit").first();

    await expect(preCta).toBeVisible();
    await expect(postCta).toBeVisible();
    await expect(preCta).toContainText(/pre-surgery review/i);
    await expect(postCta).toContainText(/post-surgery audit/i);

    for (const [testId, pathway] of [
      ["start-pre-surgery-review", "pre_surgery"],
      ["start-post-surgery-audit", "post_surgery"],
    ] as const) {
      const auditStart = page.waitForResponse(
        (res) => res.url().includes("/api/audit/start") && res.request().method() === "POST"
      );

      await page.goto("/");
      await page.getByTestId(testId).first().click();

      const response = await auditStart;
      expect(response.ok()).toBeTruthy();

      const requestBody = response.request().postDataJSON() as { pathway?: string };
      expect(requestBody.pathway).toBe(pathway);

      const json = (await response.json()) as { ok?: boolean; caseId?: string; next?: string };
      expect(json.ok).toBe(true);
      expect(json.caseId).toBeTruthy();
      expect(json.next).toMatch(new RegExp(`/cases/${json.caseId}/patient/photos`));

      await page.waitForURL(new RegExp(`/cases/${json.caseId}/patient/photos`));
    }
  });
});
