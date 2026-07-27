/**
 * HA-PROJECTION-1C — Local synthetic HTML + PDF smoke (no PHI).
 *
 * Run: pnpm exec tsx scripts/smokeSurgeryDayProjectionReport.ts
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { buildSurgeryDayProjectionReport } from "../src/lib/reports/surgeryDayProjectionReport";
import { renderSurgeryDayProjectionReportHtml } from "../src/lib/reports/SurgeryDayProjectionReportHtml";
import {
  fixtureA_baselinePlusSurgeryDay,
  fixtureB_surgeryDayOnly,
  SYNTHETIC_PHOTOS_BY_CATEGORY,
} from "../tests/fixtures/surgeryDayProjection/fixtures";

const OUT = join(process.cwd(), "tmp", "projection-1c-smoke");

async function main() {
  mkdirSync(OUT, { recursive: true });

  const pair = fixtureA_baselinePlusSurgeryDay();
  const built = buildSurgeryDayProjectionReport({
    reconstruction: pair.reconstruction,
    projectedOutcome: pair.projectedOutcome,
    caseId: "00000000-0000-4000-8000-0000000001c1",
    reportVersion: 1,
    generatedAt: "2026-07-27T00:00:00.000Z",
    photosByCategory: SYNTHETIC_PHOTOS_BY_CATEGORY,
  });
  if (!built.ok) {
    throw new Error(`Report build failed: ${built.reason}`);
  }

  const html = renderSurgeryDayProjectionReportHtml({
    report: built.report,
    caseId: "00000000-0000-4000-8000-0000000001c1",
    generatedAtDisplay: "27 Jul 2026",
  });

  const htmlPath = join(OUT, "fixture-A-projection.html");
  writeFileSync(htmlPath, html, "utf8");

  const pairB = fixtureB_surgeryDayOnly();
  const builtB = buildSurgeryDayProjectionReport({
    reconstruction: pairB.reconstruction,
    projectedOutcome: pairB.projectedOutcome,
    caseId: "00000000-0000-4000-8000-0000000001c2",
    reportVersion: 1,
    generatedAt: "2026-07-27T00:00:00.000Z",
  });
  if (!builtB.ok) throw new Error(builtB.reason);
  writeFileSync(
    join(OUT, "fixture-B-projection.html"),
    renderSurgeryDayProjectionReportHtml({
      report: builtB.report,
      caseId: "00000000-0000-4000-8000-0000000001c2",
      generatedAtDisplay: "27 Jul 2026",
    }),
    "utf8"
  );

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const pdfPath = join(OUT, "fixture-A-projection.pdf");
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "12mm", right: "10mm", bottom: "12mm", left: "10mm" },
  });

  const pngPath = join(OUT, "fixture-A-page1.png");
  await page.setViewportSize({ width: 900, height: 1400 });
  await page.screenshot({ path: pngPath, fullPage: false });

  // Lightweight layout checks via DOM metrics
  const checks = await page.evaluate(() => {
    const banner = document.querySelector(".projectionBanner");
    const disclaimer = document.querySelector(".disclaimer");
    const overflow = Array.from(document.querySelectorAll("body *")).some((el) => {
      const htmlEl = el as HTMLElement;
      return htmlEl.scrollWidth > htmlEl.clientWidth + 2;
    });
    return {
      bannerText: banner?.textContent?.trim() ?? "",
      disclaimerPresent: Boolean(disclaimer),
      title: document.querySelector("h1")?.textContent?.trim() ?? "",
      hasCannot: Boolean(document.querySelector(".cannotBox")),
      overflowSuspected: overflow,
    };
  });

  await browser.close();

  const pdfBytes = readFileSync(pdfPath);
  const inspection = {
    htmlPath,
    pdfPath,
    pngPath,
    pdfBytes: pdfBytes.length,
    ...checks,
  };

  writeFileSync(join(OUT, "inspection.json"), JSON.stringify(inspection, null, 2), "utf8");
  console.log(JSON.stringify(inspection, null, 2));

  if (!/Projected analysis based on surgery-day evidence/i.test(checks.bannerText)) {
    throw new Error("Projection banner missing on page 1");
  }
  if (!checks.disclaimerPresent) {
    throw new Error("Clinical disclaimer missing");
  }
  if (!checks.hasCannot) {
    throw new Error("What Cannot Yet Be Determined missing");
  }
  if (pdfBytes.length < 1000) {
    throw new Error("PDF unexpectedly small");
  }

  console.log("HA-PROJECTION-1C smoke PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
