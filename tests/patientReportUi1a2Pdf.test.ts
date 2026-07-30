/**
 * HA-PATIENT-REPORT-UI-1A.2 — Donor orientation parity in Post-Surgery PDF HTML.
 * Run: pnpm exec tsx --test tests/patientReportUi1a2Pdf.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  DONOR_RED_FLAG_WARNING_COPY,
} from "../src/lib/patient/donorHealingEntry";
import {
  buildAutomatedDonorHealingOrientation,
  toPatientSafeDonorOrientationSlice,
} from "../src/lib/patient/donorHealingOrientationReport";
import { generatePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";
import {
  buildPostSurgeryClinicalEvidenceGalleryLabelsEn,
  buildPostSurgeryReportHtmlLabelsEn,
} from "../src/lib/reports/postSurgeryReportLabels";
import { renderPostSurgeryAuditReportHtml } from "../src/lib/reports/PostSurgeryAuditReportHtml";
import {
  DONOR_EVIDENCE_LIMITATIONS,
  DONOR_PDF_HERO_SUBTITLE,
  DONOR_PDF_LIMITATIONS_TITLE,
  DONOR_PDF_ORIENTATION_SECTION_TITLE,
} from "../src/lib/patientReport/donorPatientCopy";

const CASE_ID = "00000000-0000-4000-8000-00d0n0rpdf01";

const FORBIDDEN_DONOR_PDF_STRINGS = [
  "actorUserId",
  "00000000-0000-4000-8000-00d0n0rcl1n1",
  "AuditOS",
  "Forensic",
  "Precision Score",
  "Intelligence Engine",
  "clinicianNotes",
  "provenance.history",
  "Diagnostic Radar",
  "AI Score",
  "Prepared automatically for clinician review",
];

function htmlVisibleText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ");
}

function donorSummary(extra: Record<string, unknown> = {}) {
  return {
    entry_context: "donor_healing",
    primary_donor_concern: "donor_patchiness",
    patient_answers: {
      entry_context: "donor_healing",
      months_since: "6_9",
      procedure_date: "2025-01-15",
      appearance_trend: "stable",
      ...((extra.patient_answers as Record<string, unknown>) ?? {}),
    },
    forensic_audit: {
      overall_score: 72,
      key_findings: [{ title: "Donor appearance broadly compatible", severity: "low" }],
    },
    ...extra,
  };
}

function buildDonorPdfReport(opts?: {
  redFlags?: string[];
  appearanceTrend?: string;
}) {
  const answers = {
    entry_context: "donor_healing",
    months_since: "6_9",
    procedure_date: "2025-01-15",
    appearance_trend: opts?.appearanceTrend ?? "stable",
    ...(opts?.redFlags ? { donor_red_flag_symptoms: opts.redFlags } : {}),
  };
  const uploadTypes = [
    "patient_photo:preop_donor_rear",
    "patient_photo:preop_donor_left",
    "patient_photo:preop_donor_right",
  ] as const;
  let summary = donorSummary({ patient_answers: answers });
  const record = buildAutomatedDonorHealingOrientation({
    answers,
    summary,
    uploadTypes,
  });
  assert.ok(record);
  summary = {
    ...summary,
    donor_healing_orientation: record,
  };
  return generatePostSurgeryAuditReport({
    summary,
    caseId: CASE_ID,
    patientReviewPathway: "post_surgery",
    uploadTypes: [...uploadTypes],
  });
}

function renderDonorPdf(
  report: ReturnType<typeof generatePostSurgeryAuditReport>,
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>
) {
  return renderPostSurgeryAuditReportHtml({
    report,
    caseId: CASE_ID,
    generatedAtDisplay: "2026-07-30",
    labels: buildPostSurgeryReportHtmlLabelsEn("Moderate concerns", "Minor observation"),
    photosByCategory,
    clinicalEvidenceLabels: buildPostSurgeryClinicalEvidenceGalleryLabelsEn(),
    monthsSinceBand: "6_9",
  });
}

describe("HA-PATIENT-REPORT-UI-1A.2 donor PDF parity", () => {
  it("renders patient-safe orientation title, narrative, stage, and evidence", () => {
    const report = buildDonorPdfReport();
    assert.ok(report.donorHealingOrientation);
    const slice = report.donorHealingOrientation!;
    const html = renderDonorPdf(report);
    const text = htmlVisibleText(html);

    assert.match(text, new RegExp(DONOR_PDF_ORIENTATION_SECTION_TITLE));
    assert.match(text, new RegExp(slice.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(
      text,
      new RegExp(slice.stageAwareNarrative.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
    assert.match(text, /Healing stage/i);
    assert.match(text, /3–6 months|6–9 months|3 months or more/i);
    assert.match(text, /Evidence/i);
    assert.match(text, /Suitable for structured review|Limited/i);
    assert.match(text, new RegExp(DONOR_PDF_HERO_SUBTITLE.slice(0, 20)));
    assert.match(html, /data-testid="pdf-donor-orientation"/);
    assert.match(html, /data-testid="pdf-donor-status-strip"/);
  });

  it("includes evidence limitations and recommended next steps", () => {
    const report = buildDonorPdfReport();
    const html = htmlVisibleText(renderDonorPdf(report));
    assert.match(html, new RegExp(DONOR_PDF_LIMITATIONS_TITLE));
    for (const line of DONOR_EVIDENCE_LIMITATIONS) {
      assert.ok(html.includes(line), `missing limitation: ${line}`);
    }
    assert.match(html, /Recommended Next Steps/i);
    assert.ok(report.recommendedNextSteps.length > 0);
    assert.ok(
      report.recommendedNextSteps.some((s) => html.includes(s.slice(0, Math.min(32, s.length))))
    );
  });

  it("surfaces direct-care warning when active", () => {
    const report = buildDonorPdfReport({
      redFlags: ["fever", "discharge"],
    });
    assert.ok(report.donorHealingOrientation?.escalationCopy);
    const html = htmlVisibleText(renderDonorPdf(report));
    assert.match(html, new RegExp(DONOR_RED_FLAG_WARNING_COPY.slice(0, 24)));
    assert.match(html, /data-testid="pdf-donor-escalation"|Seek direct/i);
  });

  it("includes donor findings and photographs when gallery URLs exist", () => {
    const report = buildDonorPdfReport();
    const photosByCategory = {
      "Donor - donor rear": [
        { signedUrl: "https://example.com/donor-rear.jpg", label: "donor_rear" },
      ],
      "Donor - donor left": [
        { signedUrl: "https://example.com/donor-left.jpg", label: "donor_left" },
      ],
    };
    const html = renderDonorPdf(report, photosByCategory);
    assert.match(html, /Donor Area Review/i);
    assert.match(html, /Clinical Evidence Reviewed/);
    assert.match(html, /https:\/\/example\.com\/donor-rear\.jpg/);
    assert.match(html, /https:\/\/example\.com\/donor-left\.jpg/);
  });

  it("excludes auditor controls, internal ids, and diagnostic wording", () => {
    const report = buildDonorPdfReport();
    const clinicianRecord = buildAutomatedDonorHealingOrientation({
      answers: {
        entry_context: "donor_healing",
        months_since: "6_9",
        appearance_trend: "stable",
      },
      summary: { entry_context: "donor_healing" },
      uploadTypes: [
        "patient_photo:preop_donor_rear",
        "patient_photo:preop_donor_left",
        "patient_photo:preop_donor_right",
      ],
    });
    assert.ok(clinicianRecord);
    // Ensure full record with actor id never leaks even if present on summary input
    const poisoned = {
      ...clinicianRecord!,
      provenance: {
        ...clinicianRecord!.provenance,
        confirmedByUserId: "00000000-0000-4000-8000-00d0n0rcl1n1",
        history: [
          {
            at: "2026-07-30T00:00:00.000Z",
            action: "confirm" as const,
            actorUserId: "00000000-0000-4000-8000-00d0n0rcl1n1",
            previousState: clinicianRecord!.state,
            nextState: clinicianRecord!.state,
          },
        ],
      },
    };
    const withSlice = {
      ...report,
      donorHealingOrientation: toPatientSafeDonorOrientationSlice(poisoned),
    };
    const htmlRaw = renderDonorPdf(withSlice);
    const html = htmlVisibleText(htmlRaw).toLowerCase();
    for (const forbidden of FORBIDDEN_DONOR_PDF_STRINGS) {
      assert.ok(!html.includes(forbidden.toLowerCase()), `leaked: ${forbidden}`);
    }
    assert.ok(!/>\s*prepare\s*</i.test(htmlRaw));
    assert.ok(!/>\s*confirm\s*</i.test(htmlRaw));
    assert.ok(!/>\s*correct\s*</i.test(htmlRaw));
    // Case UUID must not appear in donor PDF document title / body chrome
    assert.ok(!html.includes(CASE_ID.toLowerCase()));
    assert.ok(!html.includes("report id"));
  });

  it("non-donor post-surgery PDF remains unchanged structurally", () => {
    const report = generatePostSurgeryAuditReport({
      summary: {
        forensic_audit: {
          overall_score: 72,
          summary: "Independent review of submitted images.",
          key_findings: [],
        },
      },
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });
    assert.equal(report.donorHealingOrientation ?? null, null);
    const html = renderDonorPdf(report);
    assert.ok(!html.includes('data-testid="pdf-donor-orientation"'));
    assert.ok(!html.includes(DONOR_PDF_ORIENTATION_SECTION_TITLE));
    assert.match(html, /Your Post-Surgery Audit is Complete/);
    assert.match(html, /Report ID/);
  });

  it("writes regression HTML fixture for screenshot smoke", () => {
    const report = buildDonorPdfReport({ redFlags: ["infection_signs"] });
    const html = renderDonorPdf(report, {
      "Donor - donor rear": [
        { signedUrl: "https://example.com/donor-rear.jpg", label: "donor_rear" },
      ],
    });
    const outDir = join(process.cwd(), "tmp", "patient-report-ui-1a2-pdf");
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "donor-orientation.html");
    writeFileSync(outPath, html, "utf8");
    assert.ok(html.includes("pdf-donor-orientation"));
  });
});
