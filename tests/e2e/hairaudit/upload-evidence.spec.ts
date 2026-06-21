import { test, expect, skipIfE2eBlocked } from "../fixtures/hairaudit.fixture";

test.describe("Upload pathway evidence UI", () => {
  test.beforeEach(() => skipIfE2eBlocked());

  test("pre-surgery draft case shows guided wizard with one required card", async ({ page }) => {
    const response = await page.request.post("/api/audit/start", {
      data: { pathway: "pre_surgery" },
    });
    test.skip(!response.ok(), "Could not start pre-surgery audit (anonymous sign-in may be disabled)");

    const json = (await response.json()) as { caseId?: string; next?: string };
    test.skip(!json.caseId, "audit/start did not return caseId");

    await page.goto(json.next ?? `/cases/${json.caseId}/patient/photos`);

    await expect(page.getByTestId("guided-upload-wizard")).toBeVisible();
    await expect(page.getByTestId("guided-upload-step")).toHaveCount(1);
    await expect(page.getByTestId("guided-upload-pathway-label")).toHaveText("Pre-Surgery Review");
    await expect(page.getByText("Your Independent Review Has Started")).toBeVisible();
    await expect(page.getByTestId("upload-required-section")).toHaveCount(0);
    await expect(page.getByTestId("upload-recommended-section")).toHaveCount(0);
    await expect(page.getByTestId("upload-optional-section")).toHaveCount(0);
    await expect(page.getByText("Current recipient area close-up")).toHaveCount(0);

    await expect(page.getByTestId("guided-upload-continue")).toHaveCount(0);
    await expect(page.getByTestId("guided-upload-completion")).toHaveCount(0);
  });

  test("post-surgery draft case shows guided wizard with one required card", async ({ page }) => {
    const response = await page.request.post("/api/audit/start", {
      data: { pathway: "post_surgery" },
    });
    test.skip(!response.ok(), "Could not start post-surgery audit (anonymous sign-in may be disabled)");

    const json = (await response.json()) as { caseId?: string; next?: string };
    test.skip(!json.caseId, "audit/start did not return caseId");

    await page.goto(json.next ?? `/cases/${json.caseId}/patient/photos`);

    await expect(page.getByTestId("guided-upload-wizard")).toBeVisible();
    await expect(page.getByTestId("guided-upload-step")).toHaveCount(1);
    await expect(page.getByTestId("guided-upload-pathway-label")).toHaveText("Post-Surgery Audit");
    await expect(page.getByTestId("upload-required-section")).toHaveCount(0);
    await expect(page.getByTestId("upload-recommended-section")).toHaveCount(0);
    await expect(page.getByTestId("upload-optional-section")).toHaveCount(0);
    await expect(page.getByText("Current recipient area close-up")).toBeVisible();

    await expect(page.getByTestId("guided-upload-continue")).toHaveCount(0);
  });

  test("continue is hidden until all required uploads complete", async ({ page }) => {
    const response = await page.request.post("/api/audit/start", {
      data: { pathway: "pre_surgery" },
    });
    test.skip(!response.ok(), "Could not start audit");

    const json = (await response.json()) as { caseId?: string; next?: string };
    test.skip(!json.caseId, "audit/start did not return caseId");

    await page.goto(json.next ?? `/cases/${json.caseId}/patient/photos`);

    await expect(page.getByTestId("guided-upload-completion")).toHaveCount(0);
    await expect(page.getByTestId("guided-upload-continue")).toHaveCount(0);
    await expect(page.getByTestId("guided-upload-continue-disabled")).toHaveCount(0);
  });
});
