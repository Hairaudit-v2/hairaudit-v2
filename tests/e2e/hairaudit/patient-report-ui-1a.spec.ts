/**
 * HA-PATIENT-REPORT-UI-1A.1 — Seeded Playwright validation for donor patient report shell.
 *
 * Requires:
 *   pnpm run seed:demo-qa
 *   E2E_HAS_DEMO_CATALOG=true + E2E_HAS_DONOR_REPORT_CATALOG=true (via globalSetup)
 */
import {
  test,
  expect,
  loginAsPatient,
  skipIfE2eBlocked,
  skipIfDemoCatalogMissing,
  skipIfDonorReportCatalogMissing,
} from "../fixtures/hairaudit.fixture";
import { clearAuthState, loginAsAuditor } from "../helpers/auth";
import { findDonorFixture } from "../helpers/demoQaCatalog";
import { DEMO_QA_AUDITOR_EMAIL, DEMO_QA_SEED_USER_PASSWORD } from "../helpers/demoQaCatalog";

async function installCtaCapture(page: import("playwright/test").Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __haCtaEvents?: Array<Record<string, unknown>>;
      dataLayer?: Array<Record<string, unknown>>;
    };
    w.__haCtaEvents = [];
    w.dataLayer = w.dataLayer ?? [];
    window.addEventListener("hairaudit:cta", ((e: CustomEvent) => {
      w.__haCtaEvents?.push(e.detail as Record<string, unknown>);
    }) as EventListener);
  });
}

test.describe("HA-PATIENT-REPORT-UI-1A.1 seeded donor report journeys", () => {
  test.beforeEach(() => {
    skipIfE2eBlocked();
  });

  test("Journey A — patient donor report hierarchy and no professional controls", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    skipIfDonorReportCatalogMissing();
    const entry = findDonorFixture(catalog, "orientation_confirmed");
    test.skip(!entry?.caseId, "Missing orientation_confirmed fixture");

    await installCtaCapture(page);
    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);

    const shell = page.getByTestId("patient-report-shell");
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("post-surgery-report-shell")).toHaveCount(0);

    const summary = page.getByTestId("patient-report-summary");
    await expect(summary).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("patient-report-status-strip")).toBeVisible();

    // Orientation is the primary result inside the shell
    await expect(summary.getByText(/donor healing orientation/i)).toBeVisible();
    await expect(summary.locator("h2")).toBeVisible();

    const photos = page.getByTestId("patient-report-photo-gallery");
    await expect(photos).toBeVisible();
    const findings = page.getByTestId("patient-report-findings");
    await expect(findings).toBeVisible();
    const supporting = page.getByTestId("patient-report-disclosure-supporting_detail");
    await expect(supporting).toBeVisible();

    const photoBox = await photos.boundingBox();
    const supportBox = await supporting.boundingBox();
    expect((photoBox?.y ?? 0)).toBeLessThan(supportBox?.y ?? 0);

    await expect(page.getByTestId("patient-report-next-steps")).toBeVisible();

    await expect(page.getByTestId("professional-donor-orientation-workspace")).toHaveCount(0);
    await expect(page.getByTestId("donor-healing-orientation-review")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^prepare$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^confirm$/i })).toHaveCount(0);

    const supportingTrigger = supporting.getByRole("button").first();
    await supportingTrigger.click();
    await expect(supportingTrigger).toHaveAttribute("aria-expanded", "true");

    // Reviewed and confirmed label for clinician-confirmed fixture
    await expect(summary.getByText(/reviewed and confirmed/i)).toBeVisible();
  });

  test("Journey B — mobile stacking and no horizontal overflow", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    skipIfDonorReportCatalogMissing();
    const entry = findDonorFixture(catalog, "orientation_confirmed");
    test.skip(!entry?.caseId, "Missing orientation_confirmed fixture");

    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);

    const shell = page.getByTestId("patient-report-shell");
    await expect(shell).toBeVisible({ timeout: 30_000 });

    const overflow = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="patient-report-shell"]');
      if (!el) return true;
      return el.scrollWidth > el.clientWidth + 1;
    });
    expect(overflow).toBeFalsy();

    const nav = page.getByTestId("patient-report-navigation");
    await expect(nav).toBeVisible();
    await nav.getByRole("button", { name: /jump to section/i }).click();
    await expect(
      nav.getByRole("button", { name: /photographs|findings|next steps|summary/i }).first()
    ).toBeVisible();

    const gallery = page.getByTestId("patient-report-photo-gallery");
    await expect(gallery).toBeVisible();
    const photoBtn = gallery.getByRole("button").first();
    await expect(photoBtn).toBeVisible();
    const box = await photoBtn.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);

    const disclosure = page
      .getByTestId("patient-report-disclosure-supporting_detail")
      .getByRole("button")
      .first();
    await disclosure.click();
    await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  });

  test("Journey C — print excludes nav/professional controls; orientation on page one", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    skipIfDonorReportCatalogMissing();
    const entry = findDonorFixture(catalog, "orientation_confirmed");
    test.skip(!entry?.caseId, "Missing orientation_confirmed fixture");

    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);
    await expect(page.getByTestId("patient-report-summary")).toBeVisible({ timeout: 30_000 });

    await page.emulateMedia({ media: "print" });

    const navHidden = await page.evaluate(() => {
      const nav = document.querySelector('[data-testid="patient-report-navigation"]');
      if (!nav) return true;
      return getComputedStyle(nav).display === "none";
    });
    expect(navHidden).toBeTruthy();

    const actionsHidden = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="patient-report-print-actions"]');
      if (!el) return true;
      return getComputedStyle(el).display === "none";
    });
    expect(actionsHidden).toBeTruthy();

    const proHidden = await page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="professional-donor-orientation-workspace"]'
      );
      if (!el) return true;
      return getComputedStyle(el).display === "none";
    });
    expect(proHidden).toBeTruthy();

    await expect(page.getByTestId("patient-report-summary")).toBeVisible();
    // Print must not expose internal provenance / actor ids
    await expect(page.getByText(/actorUserId|00000000-0000-4000-8000-00d0n0rcl1n1/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^prepare$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^confirm$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^correct$/i })).toHaveCount(0);
    await expect(page.getByTestId("professional-donor-orientation-workspace")).toHaveCount(0);

    // Images should not be clipped by overflow hidden in print shell
    const clipped = await page.evaluate(() => {
      const imgs = Array.from(
        document.querySelectorAll('[data-testid="patient-report-photo-gallery"] img')
      ) as HTMLImageElement[];
      return imgs.some((img) => {
        const style = getComputedStyle(img);
        return style.display === "none" || Number.parseFloat(style.maxHeight) === 0;
      });
    });
    expect(clipped).toBeFalsy();
  });

  test("Journey D — legacy non-donor post-surgery + missing-orientation fallback", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    skipIfDemoCatalogMissing();

    const legacy = catalog.postSurgery.find((c) => c.reportId) ?? catalog.postSurgery[0];
    test.skip(!legacy?.caseId, "No legacy post-surgery demo case");

    await loginAsPatient(page, legacy!.email, demoPassword);
    await page.goto(`/cases/${legacy!.caseId}`);

    const legacyShell = page.getByTestId("post-surgery-report-shell");
    await expect(legacyShell).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("patient-report-shell")).toHaveCount(0);
    await expect(legacyShell.getByText(/recommended next steps/i)).toBeVisible();

    // Fallback fixture: own patient session (cross-case access is denied)
    if (process.env.E2E_HAS_DONOR_REPORT_CATALOG === "true") {
      const fallback = findDonorFixture(catalog, "missing_orientation_fallback");
      test.skip(!fallback?.caseId, "Missing fallback fixture");
      await clearAuthState(page);
      await loginAsPatient(page, fallback!.email, demoPassword);
      await page.goto(`/cases/${fallback!.caseId}`);
      const shell = page.getByTestId("patient-report-shell");
      await expect(shell).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("patient-report-summary")).toBeVisible();
      await expect(page.getByTestId("patient-report-next-steps")).toBeVisible();
      await expect(page.getByTestId("professional-donor-orientation-workspace")).toHaveCount(0);
    }
  });

  test("Journey E — professional separation (auditor workspace vs patient)", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    skipIfDonorReportCatalogMissing();
    const entry = findDonorFixture(catalog, "orientation_confirmed");
    test.skip(!entry?.caseId, "Missing orientation_confirmed fixture");

    // Patient cannot see or invoke controls
    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);
    await expect(page.getByTestId("patient-report-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("professional-donor-orientation-workspace")).toHaveCount(0);
    await expect(page.getByTestId("donor-healing-orientation-review")).toHaveCount(0);

    const patientApi = await page.request.post("/api/auditor/donor-healing-orientation", {
      data: {
        reportId: entry!.reportId,
        action: "confirm",
      },
    });
    expect(patientApi.status()).toBeGreaterThanOrEqual(400);

    // Auditor can open professional workspace on the same case
    await clearAuthState(page);
    await loginAsAuditor(
      page,
      catalog.auditorEmail || DEMO_QA_AUDITOR_EMAIL,
      demoPassword || DEMO_QA_SEED_USER_PASSWORD
    );
    await page.goto(`/cases/${entry!.caseId}`);
    await expect(page.getByRole("link", { name: /back to dashboard/i })).toHaveAttribute(
      "href",
      /\/dashboard\/auditor/
    );

    // Professional workspace mounts on the auditor branch (not patient chrome)
    const pro = page.getByTestId("professional-donor-orientation-workspace");
    await expect(pro).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("donor-healing-orientation-review")).toBeVisible();
    await expect(page.getByRole("button", { name: /^prepare$/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^confirm$/i }).first()).toBeVisible();

    // Auditor API can invoke orientation actions (patient cannot — asserted above)
    expect(entry!.reportId).toBeTruthy();
    const auditorApi = await page.request.post("/api/auditor/donor-healing-orientation", {
      data: {
        reportId: entry!.reportId,
        action: "prepare",
        uploadTypes: [
          "patient_photo:preop_donor_rear",
          "patient_photo:preop_donor_left",
          "patient_photo:preop_donor_right",
        ],
      },
    });
    if (!auditorApi.ok()) {
      const body = await auditorApi.text();
      throw new Error(`Auditor prepare failed (${auditorApi.status()}): ${body}`);
    }
  });
});

test.describe("HA-PATIENT-REPORT-UI-1A.1 additional seeded checks", () => {
  test.beforeEach(() => {
    skipIfE2eBlocked();
    skipIfDonorReportCatalogMissing();
  });

  test("live signed photo URLs render; expired URLs fail gracefully", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    const entry = findDonorFixture(catalog, "orientation_confirmed");
    test.skip(!entry?.caseId, "Missing orientation_confirmed fixture");

    await loginAsPatient(page, entry!.email, demoPassword);

    // Live signed URLs (mocked stable signed response for deterministic proof)
    await page.route("**/api/uploads/signed-url**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        }),
      });
    });
    await page.goto(`/cases/${entry!.caseId}`);
    await expect(page.getByTestId("patient-report-photo-gallery")).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const imgs = Array.from(
            document.querySelectorAll('[data-testid="patient-report-photo-gallery"] img')
          ) as HTMLImageElement[];
          return imgs.some((img) => Boolean(img.src) && img.src.startsWith("data:image"));
        });
      }, { timeout: 20_000 })
      .toBeTruthy();

    // Graceful failure when signed URL endpoint fails
    await page.unroute("**/api/uploads/signed-url**");
    await page.route("**/api/uploads/signed-url**", async (route) => {
      await route.fulfill({ status: 403, contentType: "application/json", body: "{}" });
    });
    await page.reload();
    await expect(page.getByTestId("patient-report-photo-gallery")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/photo unavailable/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId("patient-report-photo-gallery").getByRole("button").first()
    ).toBeVisible();
  });

  test("donor_report_viewed fires once per session", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    const entry = findDonorFixture(catalog, "orientation_confirmed");
    test.skip(!entry?.caseId, "Missing orientation_confirmed fixture");

    await installCtaCapture(page);
    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);
    await expect(page.getByTestId("patient-report-shell")).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const w = window as unknown as { __haCtaEvents?: Array<{ event?: string }> };
          return (w.__haCtaEvents ?? []).filter((e) => e.event === "donor_report_viewed").length;
        });
      }, { timeout: 10_000 })
      .toBe(1);

    await page.reload();
    await expect(page.getByTestId("patient-report-shell")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1000);

    const countAfterReload = await page.evaluate(() => {
      const w = window as unknown as { __haCtaEvents?: Array<{ event?: string }> };
      return (w.__haCtaEvents ?? []).filter((e) => e.event === "donor_report_viewed").length;
    });
    // sessionStorage dedupe — should not fire again in same session
    expect(countAfterReload).toBe(0);
  });

  test("direct-clinical-assessment warning is visible (not disclosure-only)", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    const entry = findDonorFixture(catalog, "direct_clinical_assessment");
    test.skip(!entry?.caseId, "Missing direct_clinical_assessment fixture");

    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);
    await expect(page.getByTestId("patient-report-summary")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("patient-report-escalation")).toBeVisible();
    await expect(
      page.getByText(/direct clinical assessment is recommended/i).first()
    ).toBeVisible();
  });

  test("partial donor evidence still renders shell", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    const entry = findDonorFixture(catalog, "partial_donor_evidence");
    test.skip(!entry?.caseId, "Missing partial_donor_evidence fixture");

    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);
    await expect(page.getByTestId("patient-report-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("patient-report-summary")).toBeVisible();
    await expect(page.getByTestId("patient-report-status-strip")).toBeVisible();
  });

  test("patient access control blocks another patient’s report", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    const owner = findDonorFixture(catalog, "orientation_confirmed");
    const other = findDonorFixture(catalog, "orientation_corrected");
    test.skip(!owner?.caseId || !other?.caseId, "Need two donor fixtures");

    await loginAsPatient(page, owner!.email, demoPassword);
    await page.goto(`/cases/${other!.caseId}`);
    await page.waitForTimeout(2000);

    // Should not render the other patient's donor shell
    const shellCount = await page.getByTestId("patient-report-shell").count();
    const bodyText = await page.locator("body").innerText();
    const denied =
      shellCount === 0 ||
      /forbidden|not found|access|sign in|unauthorized|permission/i.test(bodyText) ||
      !page.url().includes(other!.caseId);

    expect(denied).toBeTruthy();

    if (other!.reportId) {
      const res = await page.request.get(`/api/reports/${other!.reportId}/download`);
      expect(res.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test("unauthenticated access returns to report after sign-in", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    const entry = findDonorFixture(catalog, "orientation_confirmed");
    test.skip(!entry?.caseId, "Missing orientation_confirmed fixture");

    await clearAuthState(page);
    await page.goto(`/cases/${entry!.caseId}`);
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith("/login") &&
        url.searchParams.get("next") === `/cases/${entry!.caseId}`,
      { timeout: 20_000 }
    );

    await page.locator("#email").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("#email").fill(entry!.email);
    await page.locator("#password").fill(demoPassword);
    await page.getByRole("button", { name: /sign in with email \+ password/i }).click();
    await page.waitForURL(new RegExp(`/cases/${entry!.caseId}`), { timeout: 45_000 });
    await expect(page.getByTestId("patient-report-shell")).toBeVisible({ timeout: 30_000 });
  });
});
