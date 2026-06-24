/**
 * HA-FIX-8I — Post-surgery patient PDF quality guards.
 * Run: pnpm exec tsx --test tests/postSurgeryAuditPdf.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPostSurgeryReportHtmlLabelsEn, buildPostSurgeryClinicalEvidenceGalleryLabelsEn } from "../src/lib/reports/postSurgeryReportLabels";
import { renderPostSurgeryAuditReportHtml } from "../src/lib/reports/PostSurgeryAuditReportHtml";
import {
  generatePostSurgeryAuditReport,
  mergePostSurgeryImageAssessmentsWithPhotos,
} from "../src/lib/reports/postSurgeryAuditReport";
import {
  POST_SURGERY_IMAGE_LIMITED_NOTICE,
  sanitizePatientReportText,
} from "../src/lib/reports/postSurgeryPatientText";
import { buildPatientSafeClinicalHistoryLines } from "../src/lib/hairaudit/clinical-history/clinicalHistoryUtils";
import type { ClinicalHistorySnapshot } from "../src/lib/hairaudit/clinical-history/clinicalHistoryTypes";

const CASE_ID = "00000000-0000-4000-8000-000000000088";

const FORBIDDEN_PDF_STRINGS = [
  "rule-based placeholder",
  "none_suggested",
  "Await extraction pattern review",
  "ImagingOS",
  "Photo not available in this export",
];

const sampleForensicSummary = {
  forensic_audit: {
    overall_score: 72,
    summary:
      "Based on the uploaded images, This may suggest moderate donor preservation concerns requiring observation.",
    imageLimitedAssessment: true,
    documentAssistedAssessment: true,
    section_scores: {
      donor_management: 68,
      extraction_quality: 74,
      density_distribution: 81,
      recipient_placement: 76,
      post_op_course_and_aftercare: 78,
    },
    key_findings: [{ title: "Donor region shows moderate extraction irregularity", severity: "medium" }],
    red_flags: [],
    photo_observations: [
      { category: "front", observation: "Visible frontal density appears lower than expected." },
      { category: "donor_rear", observation: "Donor region shows moderate extraction irregularity." },
    ],
  },
};

const clinicalHistory: ClinicalHistorySnapshot = {
  priorSurgeryCount: 1,
  priorProcedureType: "fue",
  priorSurgeryDate: "2024-03-15",
  priorSurgeryTimingNote: "approximately 14 months ago",
  priorClinicName: null,
  priorSurgeonName: null,
  priorGraftCount: 3120,
  estimatedHairCount: 7040,
  averageHairsPerGraft: 2.26,
  singleHairGrafts: null,
  doubleHairGrafts: null,
  tripleHairGrafts: null,
  quadrupleHairGrafts: null,
  donorGraftsRemoved: null,
  punchSizeMm: 0.9,
  extractionMethod: "fue",
  implantationMethod: "unknown",
  transectionRatePercent: null,
  survivalEstimatePercent: null,
  recipientZones: [],
  donorDepletionLevel: "moderate",
  donorReserveAssessment: "Donor reserve appears moderately constrained.",
  visibleScarringLevel: "mild",
  surgicalTechniqueNotes: null,
  medicationHistory: { finasteride: true },
  supportingDocumentNotes: "Clinic invoice confirms graft count.",
  clinicianSummary: null,
};

function renderHtmlForReport(
  report: ReturnType<typeof generatePostSurgeryAuditReport>,
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>
): string {
  return renderPostSurgeryAuditReportHtml({
    report,
    caseId: CASE_ID,
    generatedAtDisplay: "2026-06-24",
    labels: buildPostSurgeryReportHtmlLabelsEn("Moderate concerns", "Minor observation"),
    photosByCategory,
    clinicalEvidenceLabels: buildPostSurgeryClinicalEvidenceGalleryLabelsEn(),
  });
}

describe("HA-FIX-8I post-surgery audit PDF quality", () => {
  it("sanitizePatientReportText removes awkward phrasing and placeholders", () => {
    const raw =
      "Based on the uploaded images, This may suggest uneven extraction. Procedural Intelligence (rule-based placeholder).";
    const cleaned = sanitizePatientReportText(raw);
    assert.match(cleaned, /submitted images suggest/i);
    assert.ok(!cleaned.toLowerCase().includes("rule-based placeholder"));
    assert.ok(!cleaned.toLowerCase().includes("this may suggest"));
  });

  it("patient PDF HTML excludes placeholder and internal strings", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sampleForensicSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
      clinicalHistory,
    });
    const html = renderHtmlForReport(report).toLowerCase();
    for (const forbidden of FORBIDDEN_PDF_STRINGS) {
      assert.ok(!html.includes(forbidden.toLowerCase()), `leaked: ${forbidden}`);
    }
  });

  it("image-limited notice appears on page 1 when imageLimitedAssessment is true", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sampleForensicSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });
    const html = renderHtmlForReport(report);
    assert.match(html, /Enhanced image-limited review/);
    assert.match(html, new RegExp(POST_SURGERY_IMAGE_LIMITED_NOTICE.slice(0, 40)));
  });

  it("known clinical context appears when graft data exists", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sampleForensicSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
      clinicalHistory,
    });
    const html = renderHtmlForReport(report);
    assert.match(html, /Known Clinical Context Provided/);
    assert.match(html, /3,120 grafts/);
    assert.match(html, /2\.26 hairs per graft/);
    const lines = buildPatientSafeClinicalHistoryLines(clinicalHistory);
    assert.ok(lines.some((l) => l.includes("3,120")));
  });

  it("long-term preservation guidance appears in post-surgery reports", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sampleForensicSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });
    const html = renderHtmlForReport(report);
    assert.match(html, /Long-Term Hair Preservation Strategy/);
    assert.match(html, /Protecting your post-transplant result/);
    assert.match(html, /Medical Hair Loss Prevention Options/);
    assert.match(html, /does not prescribe treatment/i);
    assert.equal(report.longTermPreservation.subsections.length, 4);
  });

  it("repair guidance appears in post-surgery reports", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sampleForensicSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });
    const html = renderHtmlForReport(report);
    assert.match(html, /Repair \/ Refinement Considerations/);
    assert.match(html, /donor mapping/i);
    assert.ok(report.repairPlanningGuidance.length >= 3);
  });

  it("clinical evidence gallery renders all provided photos with completeness statement", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sampleForensicSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });
    const photosByCategory = {
      "Pre-op - preop front": [{ signedUrl: "https://example.com/front.jpg", label: "preop_front" }],
      "Pre-op - preop left": [{ signedUrl: "https://example.com/left.jpg", label: "preop_left" }],
      "Pre-op - preop donor rear": [{ signedUrl: "https://example.com/donor.jpg", label: "preop_donor_rear" }],
    };
    const html = renderHtmlForReport(report, photosByCategory);
    assert.match(html, /Clinical Evidence Reviewed/);
    assert.match(html, /https:\/\/example\.com\/front\.jpg/);
    assert.match(html, /https:\/\/example\.com\/left\.jpg/);
    assert.match(html, /https:\/\/example\.com\/donor\.jpg/);
    assert.match(html, /3 clinical images reviewed during analysis/);
    assert.match(html, /incorporates all submitted visual evidence/i);
    assert.ok(!html.includes("could not be embedded in this PDF export"));
  });

  it("mergePostSurgeryImageAssessmentsWithPhotos resolves pipeline category keys", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sampleForensicSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });
    const merged = mergePostSurgeryImageAssessmentsWithPhotos(report.imageAssessments, {
      "Pre-op - preop front": [{ signedUrl: "https://cdn.example/preop-front", label: "Pre-op front" }],
      "Current - current donor rear": [{ signedUrl: "https://cdn.example/donor", label: "Donor rear" }],
    });
    assert.equal(merged[0]?.imageUrl, "https://cdn.example/preop-front");
    assert.equal(merged[1]?.imageUrl, "https://cdn.example/donor");
  });

  it("procedural integrity section never uses clinicianNotes placeholder", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sampleForensicSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
      intelligenceBundle: {
        proceduralIntelligence: {
          clinicianNotes: "Procedural Intelligence (rule-based placeholder). Await extraction pattern review.",
          patientSafeSummary: "Procedural handling appears generally consistent in available views.",
          severity: "low",
          fields: {},
        },
      } as never,
    });
    const integrity = report.sections.find((s) => s.id === "procedural_integrity");
    assert.ok(integrity);
    assert.ok(!integrity!.finding.toLowerCase().includes("rule-based placeholder"));
    assert.ok(!integrity!.finding.toLowerCase().includes("await extraction"));
  });
});
