/**
 * HA-PATIENT-REPORT-UI-1A.2 — write donor PDF HTML + Playwright screenshots.
 *
 * Usage:
 *   pnpm exec tsx scripts/patient-report-ui-1a2-pdf-visual-qa.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { buildAutomatedDonorHealingOrientation } from "../src/lib/patient/donorHealingOrientationReport";
import { generatePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";
import {
  buildPostSurgeryClinicalEvidenceGalleryLabelsEn,
  buildPostSurgeryReportHtmlLabelsEn,
} from "../src/lib/reports/postSurgeryReportLabels";
import { renderPostSurgeryAuditReportHtml } from "../src/lib/reports/PostSurgeryAuditReportHtml";

const OUT = join(process.cwd(), "tmp", "patient-report-ui-1a2-pdf");

async function main() {
  mkdirSync(OUT, { recursive: true });

  const answers = {
    entry_context: "donor_healing",
    months_since: "6_9",
    procedure_date: "2025-01-15",
    appearance_trend: "stable",
    donor_red_flag_symptoms: ["fever", "discharge"],
  };
  const uploadTypes = [
    "patient_photo:preop_donor_rear",
    "patient_photo:preop_donor_left",
    "patient_photo:preop_donor_right",
  ] as const;
  const summary = {
    entry_context: "donor_healing",
    patient_answers: answers,
    forensic_audit: {
      overall_score: 68,
      key_findings: [{ title: "Donor irregularity under review", severity: "medium" }],
    },
  };
  const record = buildAutomatedDonorHealingOrientation({
    answers,
    summary,
    uploadTypes,
  });
  if (!record) throw new Error("Failed to build donor orientation for visual QA");

  const report = generatePostSurgeryAuditReport({
    summary: { ...summary, donor_healing_orientation: record },
    caseId: "00000000-0000-4000-8000-00d0n0rpdf01",
    patientReviewPathway: "post_surgery",
    uploadTypes: [...uploadTypes],
  });

  const html = renderPostSurgeryAuditReportHtml({
    report,
    caseId: "00000000-0000-4000-8000-00d0n0rpdf01",
    generatedAtDisplay: "2026-07-30",
    labels: buildPostSurgeryReportHtmlLabelsEn("Elevated concern", "Structured review"),
    clinicalEvidenceLabels: buildPostSurgeryClinicalEvidenceGalleryLabelsEn(),
    monthsSinceBand: "6_9",
    photosByCategory: {
      "Donor - donor rear": [
        { signedUrl: "https://placehold.co/640x480/png?text=Donor+Rear", label: "donor_rear" },
      ],
      "Donor - donor left": [
        { signedUrl: "https://placehold.co/640x480/png?text=Donor+Left", label: "donor_left" },
      ],
    },
  });

  const htmlPath = join(OUT, "donor-orientation.html");
  writeFileSync(htmlPath, html, "utf8");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
  await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`);
  await page.screenshot({ path: join(OUT, "donor-orientation-page1.png"), fullPage: false });
  await page.screenshot({ path: join(OUT, "donor-orientation-full.png"), fullPage: true });
  await browser.close();

  console.log(`Wrote ${htmlPath}`);
  console.log(`Wrote ${join(OUT, "donor-orientation-page1.png")}`);
  console.log(`Wrote ${join(OUT, "donor-orientation-full.png")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
