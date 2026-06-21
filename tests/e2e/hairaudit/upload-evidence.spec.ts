import { test, expect, skipIfE2eBlocked } from "../fixtures/hairaudit.fixture";

test.describe("Upload pathway evidence UI", () => {
  test.beforeEach(() => skipIfE2eBlocked());

  test("pre-surgery draft case shows pre-surgery evidence pack only", async ({ page }) => {
    const response = await page.request.post("/api/audit/start", {
      data: { pathway: "pre_surgery" },
    });
    test.skip(!response.ok(), "Could not start pre-surgery audit (anonymous sign-in may be disabled)");

    const json = (await response.json()) as { caseId?: string; next?: string };
    test.skip(!json.caseId, "audit/start did not return caseId");

    await page.goto(json.next ?? `/cases/${json.caseId}/patient/photos`);

    await expect(page.getByTestId("upload-evidence-pack")).toBeVisible();
    await expect(page.getByTestId("upload-required-section")).toBeVisible();
    await expect(page.getByTestId("upload-recommended-section")).toBeVisible();
    await expect(page.getByTestId("upload-optional-section")).toBeVisible();

    await expect(page.getByText("Pre-Surgery Planning Photos")).toBeVisible();
    await expect(page.getByText("Post-Surgery Result Photos")).toHaveCount(0);
    await expect(page.getByText("Current recipient area close-up")).toHaveCount(0);

    const continueLink = page.getByRole("link", { name: /continue to pre-surgery questions/i });
    await expect(continueLink).toBeVisible();
    await expect(continueLink).not.toHaveAttribute("aria-disabled", "true");
  });

  test("post-surgery draft case shows post-surgery evidence pack only", async ({ page }) => {
    const response = await page.request.post("/api/audit/start", {
      data: { pathway: "post_surgery" },
    });
    test.skip(!response.ok(), "Could not start post-surgery audit (anonymous sign-in may be disabled)");

    const json = (await response.json()) as { caseId?: string; next?: string };
    test.skip(!json.caseId, "audit/start did not return caseId");

    await page.goto(json.next ?? `/cases/${json.caseId}/patient/photos`);

    await expect(page.getByTestId("upload-evidence-pack")).toBeVisible();
    await expect(page.getByTestId("upload-required-section")).toBeVisible();
    await expect(page.getByTestId("upload-recommended-section")).toBeVisible();
    await expect(page.getByTestId("upload-optional-section")).toBeVisible();

    await expect(page.getByText("Post-Surgery Result Photos")).toBeVisible();
    await expect(page.getByText("Pre-Surgery Planning Photos")).toHaveCount(0);
    await expect(page.getByText("Current recipient area close-up")).toBeVisible();

    const continueLink = page.getByRole("link", { name: /continue to/i });
    await expect(continueLink.first()).toBeVisible();
  });

  test("recommended and optional tiers do not block continuation on empty draft case", async ({ page }) => {
    const response = await page.request.post("/api/audit/start", {
      data: { pathway: "pre_surgery" },
    });
    test.skip(!response.ok(), "Could not start audit");

    const json = (await response.json()) as { caseId?: string; next?: string };
    test.skip(!json.caseId, "audit/start did not return caseId");

    await page.goto(json.next ?? `/cases/${json.caseId}/patient/photos`);

    const continueLink = page.getByRole("link", { name: /continue to pre-surgery questions/i });
    await expect(continueLink).toBeVisible();

    const href = await continueLink.getAttribute("href");
    expect(href).toContain("/patient/questions");
  });
});
