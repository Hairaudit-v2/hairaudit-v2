import { test, expect, loginAsPatient, skipIfE2eBlocked } from "../fixtures/hairaudit.fixture";
import { buildPrintReportUrl } from "../helpers/renderToken";
import { resolveE2eBaseUrl } from "../helpers/env";

test.describe("PDF and print route smoke tests", () => {
  test.beforeEach(() => skipIfE2eBlocked());

  test("pre-surgery PDF download returns 200", async ({ page, catalog, demoPassword }) => {
    const entry = catalog.preSurgery[0];
    test.skip(!entry?.reportId, "Missing pre-surgery demo report");

    await loginAsPatient(page, entry.email, demoPassword);

    const downloadResponse = await page.request.get(`/api/reports/${entry.reportId}/download`);
    expect(downloadResponse.status()).toBe(200);
    expect(downloadResponse.headers()["content-type"]).toContain("application/pdf");
    expect(Number(downloadResponse.headers()["content-length"] ?? "0")).toBeGreaterThan(100);
  });

  test("post-surgery PDF download returns 200", async ({ page, catalog, demoPassword }) => {
    const entry = catalog.postSurgery[0];
    test.skip(!entry?.reportId, "Missing post-surgery demo report");

    await loginAsPatient(page, entry.email, demoPassword);

    const downloadResponse = await page.request.get(`/api/reports/${entry.reportId}/download`);
    expect(downloadResponse.status()).toBe(200);
    expect(downloadResponse.headers()["content-type"]).toContain("application/pdf");
  });

  test("print route exposes correct X-Report-Template headers", async ({ page, catalog }) => {
    const baseURL = resolveE2eBaseUrl();

    for (const [label, entry, expectedTemplate] of [
      ["pre-surgery", catalog.preSurgery[0], "pre-surgery-planning"],
      ["post-surgery", catalog.postSurgery[0], "post-surgery-audit"],
    ] as const) {
      test.skip(!entry?.caseId, `Missing ${label} demo case`);

      const printUrl = buildPrintReportUrl(entry!.caseId, baseURL);
      test.skip(!printUrl, "REPORT_RENDER_TOKEN / INTERNAL_API_KEY not configured for print route");

      const response = await page.request.get(printUrl);
      expect(response.status(), `${label} print route status`).toBe(200);
      expect(response.headers()["x-report-template"], `${label} template header`).toBe(expectedTemplate);

      const html = await response.text();
      if (label === "pre-surgery") {
        expect(html).toContain("Independent Pre-Surgery Planning Report");
      } else {
        expect(html).toMatch(/post-surgery audit/i);
      }
    }
  });
});
