/**
 * HA-PATIENT-REPORT-UI-1B — Seeded Playwright validation for standard Post-Surgery Audit shell.
 *
 * Requires:
 *   pnpm run seed:demo-qa
 *   E2E_HAS_DEMO_CATALOG=true (+ E2E_HAS_DONOR_REPORT_CATALOG for Journey G)
 */
import {
  test,
  expect,
  loginAsPatient,
  skipIfE2eBlocked,
  skipIfDemoCatalogMissing,
  skipIfDonorReportCatalogMissing,
} from "../fixtures/hairaudit.fixture";
import { loginAsAuditor } from "../helpers/auth";
import {
  DEMO_QA_AUDITOR_EMAIL,
  DEMO_QA_SEED_USER_PASSWORD,
  findDonorFixture,
  findPostSurgeryFixture,
} from "../helpers/demoQaCatalog";

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

test.describe("HA-PATIENT-REPORT-UI-1B seeded standard post-surgery journeys", () => {
  test.beforeEach(() => {
    skipIfE2eBlocked();
  });

  test("Journey A — mature standard report hierarchy", async ({ page, catalog, demoPassword }) => {
    skipIfDemoCatalogMissing();
    const entry = findPostSurgeryFixture(catalog, 1);
    test.skip(!entry?.caseId, "Missing post_01 fixture");

    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);

    const shell = page.getByTestId("patient-report-shell");
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(shell).toHaveAttribute("data-report-type", "post_surgery");
    await expect(page.getByTestId("post-surgery-report-shell")).toHaveCount(0);

    const summary = page.getByTestId("patient-report-summary");
    await expect(summary).toBeVisible({ timeout: 30_000 });
    await expect(summary.getByText(/post-surgery audit summary/i)).toBeVisible();
    await expect(page.getByTestId("patient-report-status-strip")).toBeVisible();
    await expect(page.getByTestId("patient-report-findings")).toBeVisible();
    await expect(page.getByTestId("patient-report-next-steps")).toBeVisible();

    const photos = page.getByTestId("patient-report-photo-gallery");
    const supporting = page.getByTestId("patient-report-disclosure-supporting_detail");
    if (await photos.count()) {
      await expect(photos).toBeVisible();
      if (await supporting.count()) {
        const photoBox = await photos.boundingBox();
        const supportBox = await supporting.boundingBox();
        expect((photoBox?.y ?? 0)).toBeLessThan(supportBox?.y ?? 0);
      }
    }

    await expect(page.getByTestId("professional-donor-orientation-workspace")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^prepare$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^confirm$/i })).toHaveCount(0);

    if (await supporting.count()) {
      const trigger = supporting.getByRole("button").first();
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
    }
  });

  test("Journey B — early-stage report timing", async ({ page, catalog, demoPassword }) => {
    skipIfDemoCatalogMissing();
    // post_05 healing_concern uses under_3 months
    const entry = findPostSurgeryFixture(catalog, 5);
    test.skip(!entry?.caseId, "Missing post_05 early-stage fixture");

    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);

    const shell = page.getByTestId("patient-report-shell");
    await expect(shell).toBeVisible({ timeout: 30_000 });
    const timeline = page.getByTestId("patient-report-timeline");
    await expect(timeline).toBeVisible();
    await expect(timeline.getByText(/under 3 months|early|preliminary|temporary/i).first()).toBeVisible();
  });

  test("Journey C — partial evidence renders without empty cards", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    skipIfDemoCatalogMissing();
    const entry = findPostSurgeryFixture(catalog, 8) ?? findPostSurgeryFixture(catalog, 1);
    test.skip(!entry?.caseId, "Missing partial/low-concern fixture");

    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);

    const shell = page.getByTestId("patient-report-shell");
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("patient-report-summary")).toBeVisible();
    await expect(page.getByTestId("patient-report-next-steps")).toBeVisible();
    await expect(page.getByTestId("patient-report-limitations")).toBeVisible();
  });

  test("Journey D — legacy / mature snapshot loads on shell", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    skipIfDemoCatalogMissing();
    const entry = findPostSurgeryFixture(catalog, 2) ?? catalog.postSurgery[0];
    test.skip(!entry?.caseId, "Missing post-surgery fixture");

    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);

    await expect(page.getByTestId("patient-report-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("post-surgery-report-shell")).toHaveCount(0);
  });

  test("Journey E — mobile no horizontal overflow", async ({ page, catalog, demoPassword }) => {
    skipIfDemoCatalogMissing();
    const entry = findPostSurgeryFixture(catalog, 1);
    test.skip(!entry?.caseId, "Missing post_01 fixture");

    await page.setViewportSize({ width: 375, height: 812 });
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
      nav.getByRole("button", { name: /summary|findings|next steps|limitations/i }).first()
    ).toBeVisible();
  });

  test("Journey F — professional separation", async ({ page, catalog, demoPassword }) => {
    skipIfDonorReportCatalogMissing();
    const donor = findDonorFixture(catalog, "orientation_confirmed");
    test.skip(!donor?.caseId, "Missing donor fixture for auditor workspace");

    await loginAsAuditor(
      page,
      catalog.auditorEmail || DEMO_QA_AUDITOR_EMAIL,
      demoPassword || DEMO_QA_SEED_USER_PASSWORD
    );
    await page.goto(`/cases/${donor!.caseId}`);
    await expect(page.getByTestId("professional-donor-orientation-workspace")).toBeVisible({
      timeout: 30_000,
    });

    const standard = findPostSurgeryFixture(catalog, 1);
    if (standard?.caseId) {
      await page.goto(`/cases/${standard.caseId}`);
      // Auditor viewing standard post case still must not embed Prepare/Confirm in patient shell
      const shell = page.getByTestId("patient-report-shell");
      if (await shell.count()) {
        await expect(shell.getByRole("button", { name: /^prepare$/i })).toHaveCount(0);
        await expect(shell.getByRole("button", { name: /^confirm$/i })).toHaveCount(0);
      }
    }
  });

  test("Journey G — donor regression remains donor_healing", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    skipIfDonorReportCatalogMissing();
    const entry = findDonorFixture(catalog, "orientation_confirmed");
    test.skip(!entry?.caseId, "Missing orientation_confirmed fixture");

    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);

    const shell = page.getByTestId("patient-report-shell");
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(shell).toHaveAttribute("data-report-type", "donor_healing");
    await expect(page.getByTestId("patient-report-summary").getByText(/donor healing orientation/i)).toBeVisible();
  });

  test("Journey H — access control denies other patient", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    skipIfDemoCatalogMissing();
    const owner = findPostSurgeryFixture(catalog, 1);
    const other = findPostSurgeryFixture(catalog, 2);
    test.skip(!owner?.caseId || !other?.caseId, "Need two post-surgery fixtures");

    await loginAsPatient(page, other!.email, demoPassword);
    await page.goto(`/cases/${owner!.caseId}`);
    await expect(page).not.toHaveURL(new RegExp(`/cases/${owner!.caseId}$`));
  });

  test("Journey I — analytics privacy on photo expand", async ({
    page,
    catalog,
    demoPassword,
  }) => {
    skipIfDemoCatalogMissing();
    const entry = findPostSurgeryFixture(catalog, 1);
    test.skip(!entry?.caseId, "Missing post_01 fixture");

    await installCtaCapture(page);
    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);

    const shell = page.getByTestId("patient-report-shell");
    await expect(shell).toBeVisible({ timeout: 30_000 });

    const expand = page.getByTestId("patient-report-photo-expand").first();
    if (await expand.count()) {
      await expand.click();
      const events = await page.evaluate(() => {
        const w = window as unknown as { __haCtaEvents?: Array<Record<string, unknown>> };
        return w.__haCtaEvents ?? [];
      });
      const photoEvents = events.filter((e) =>
        String(e.event ?? e.name ?? "").includes("photo")
      );
      for (const ev of photoEvents) {
        const json = JSON.stringify(ev);
        expect(json).not.toMatch(/case_id|report_id|patient_id|image_id/i);
        expect(json).not.toContain(entry!.caseId);
      }
    }
  });

  test("Journey J — print mode hides navigation", async ({ page, catalog, demoPassword }) => {
    skipIfDemoCatalogMissing();
    const entry = findPostSurgeryFixture(catalog, 1);
    test.skip(!entry?.caseId, "Missing post_01 fixture");

    await loginAsPatient(page, entry!.email, demoPassword);
    await page.goto(`/cases/${entry!.caseId}`);
    await expect(page.getByTestId("patient-report-shell")).toBeVisible({ timeout: 30_000 });

    await page.emulateMedia({ media: "print" });
    const navHidden = await page.evaluate(() => {
      const nav = document.querySelector('[data-testid="patient-report-navigation"]');
      if (!nav) return true;
      const style = window.getComputedStyle(nav);
      return style.display === "none" || style.visibility === "hidden";
    });
    expect(navHidden).toBeTruthy();
  });
});
