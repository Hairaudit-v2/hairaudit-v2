/**
 * HA-REPORT-5D — Assessment Confidence Score Engine tests.
 * Run: pnpm exec tsx --test tests/assessmentConfidence.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAssessmentConfidence,
  buildAssessmentConfidenceLabelsEn,
  renderAssessmentConfidenceHtml,
} from "../src/lib/reports/assessmentConfidence";
import { generatePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";
import { generatePreSurgeryPlanningReport } from "../src/lib/reports/preSurgeryPlanningReport";
import { renderPostSurgeryAuditReportHtml } from "../src/lib/reports/PostSurgeryAuditReportHtml";
import {
  buildPostSurgeryReportHtmlLabelsEn,
  buildPostSurgeryClinicalEvidenceGalleryLabelsEn,
} from "../src/lib/reports/postSurgeryReportLabels";
import type { ClinicalHistorySnapshot } from "../src/lib/hairaudit/clinical-history/clinicalHistoryTypes";

const CASE_ID = "00000000-0000-4000-8000-000000000099";

const postSummary = {
  forensic_audit: {
    overall_score: 72,
    section_scores: {
      donor_management: 68,
      extraction_quality: 74,
      density_distribution: 81,
      recipient_placement: 76,
      hairline_design: 72,
      post_op_course_and_aftercare: 78,
    },
    key_findings: [{ title: "Recipient density relative to stated graft count", severity: "low" }],
    red_flags: [],
    photo_observations: [
      { category: "front", observation: "Frontal density reviewed." },
      { category: "donor_rear", observation: "Donor patterns reviewed." },
    ],
  },
};

const preSummary = {
  forensic_audit: {
    overall_score: 70,
    section_scores: { donor_management: 75, hair_loss_pattern: 68 },
    key_findings: [],
    red_flags: [],
    photo_observations: [
      { category: "front", observation: "Front reviewed." },
      { category: "top", observation: "Crown reviewed." },
      { category: "donor_rear", observation: "Donor reviewed." },
    ],
  },
};

const fullClinicalHistory: ClinicalHistorySnapshot = {
  priorSurgeryCount: 1,
  priorProcedureType: "fue",
  priorSurgeryDate: "2024-03-15",
  priorSurgeryTimingNote: "14 months ago",
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
  donorReserveAssessment: null,
  visibleScarringLevel: "mild",
  surgicalTechniqueNotes: null,
  medicationHistory: { finasteride: true },
  supportingDocumentNotes: "Patient provided clinic invoice.",
  clinicianSummary: "Clinician notes on file.",
};

function buildHighEvidenceUploads(count: number) {
  const categories = [
    "patient_photo:preop_front",
    "patient_photo:preop_left",
    "patient_photo:preop_right",
    "patient_photo:preop_top",
    "patient_photo:preop_donor_rear",
    "patient_photo:preop_donor_closeup",
    "patient_photo:day0_recipient",
    "patient_photo:current_front",
    "patient_photo:current_donor_rear",
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `img-${i}`,
    type: categories[i % categories.length] ?? "patient_photo:preop_front",
    storage_path: `cases/a/img-${i}.jpg`,
  }));
}

function buildHighEvidencePhotosByCategory() {
  return {
    "Pre-op - preop front": [{ signedUrl: "https://example.com/front.jpg", label: "preop_front" }],
    "Pre-op - preop left": [{ signedUrl: "https://example.com/left.jpg", label: "preop_left" }],
    "Pre-op - preop right": [{ signedUrl: "https://example.com/right.jpg", label: "preop_right" }],
    "Pre-op - preop top": [{ signedUrl: "https://example.com/top.jpg", label: "preop_top" }],
    "Pre-op - preop donor rear": [{ signedUrl: "https://example.com/donor.jpg", label: "preop_donor_rear" }],
    "Pre-op - preop donor closeup": [
      { signedUrl: "https://example.com/donor-close.jpg", label: "preop_donor_closeup" },
    ],
    "Day-of - day0 recipient": [
      { signedUrl: "https://example.com/recipient.jpg", label: "day0_recipient" },
    ],
    "Current - current front": [{ signedUrl: "https://example.com/cfront.jpg", label: "current_front" }],
    "Current - current donor rear": [
      { signedUrl: "https://example.com/cdonor.jpg", label: "current_donor_rear" },
    ],
  };
}

describe("assessmentConfidence", () => {
  it("returns high confidence for strong evidence coverage", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
      clinicalHistory: fullClinicalHistory,
    });

    const result = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      uploads: buildHighEvidenceUploads(9),
      photosByCategory: buildHighEvidencePhotosByCategory(),
      clinicalHistory: fullClinicalHistory,
    });

    assert.equal(result.band, "high");
    assert.ok(result.score >= 80);
    assert.match(result.title, /Assessment Confidence: High/);
    assert.ok(result.strengths.length >= 2);
    assert.ok(!result.title.toLowerCase().includes("low"));
  });

  it("returns moderate confidence for partial evidence", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });

    const result = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      uploads: [
        { id: "1", type: "patient_photo:preop_front", storage_path: "a/1.jpg" },
        { id: "2", type: "patient_photo:day0_recipient", storage_path: "a/2.jpg" },
        { id: "3", type: "patient_photo:preop_top", storage_path: "a/3.jpg" },
        { id: "4", type: "patient_photo:preop_donor_rear", storage_path: "a/4.jpg" },
        { id: "5", type: "patient_photo:preop_donor_closeup", storage_path: "a/5.jpg" },
      ],
    });

    assert.equal(result.band, "moderate");
    assert.ok(result.score >= 55 && result.score <= 79);
  });

  it("returns limited confidence for minimal evidence", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });

    const result = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      imageLimitedAssessment: true,
    });

    assert.equal(result.band, "limited");
    assert.ok(result.score <= 54);
    assert.match(result.title, /Limited/);
    assert.ok(!result.title.toLowerCase().includes("low confidence"));
  });

  it("handles 0-image fallback", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });

    const result = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
    });

    assert.equal(result.score, clampExpect(result));
    assert.ok(result.limitations.some((l) => l.includes("photo views")));
    assert.ok(result.limitations.some((l) => l.includes("clinical context")));
  });

  it("applies image-limited adjustment without document assistance", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });

    const limited = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      uploads: [
        { id: "1", type: "patient_photo:preop_front", storage_path: "a/1.jpg" },
      ],
      imageLimitedAssessment: true,
      documentAssistedAssessment: false,
    });

    const assisted = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      uploads: [
        { id: "1", type: "patient_photo:preop_front", storage_path: "a/1.jpg" },
        { id: "doc", type: "support_document", storage_path: "a/doc.pdf" },
      ],
      imageLimitedAssessment: true,
      documentAssistedAssessment: true,
    });

    assert.ok(assisted.score > limited.score);
    assert.ok(limited.limitations.some((l) => l.includes("Image-based interpretation")));
  });

  it("uses pre-surgery pathway copy", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: preSummary,
      caseId: CASE_ID,
      patientReviewPathway: "pre_surgery",
    });

    const result = buildAssessmentConfidence({
      pathway: "pre_surgery",
      preReport: report,
      uploads: buildHighEvidenceUploads(6),
      clinicalHistory: fullClinicalHistory,
    });

    assert.match(result.summary, /pre-surgery planning assessment/i);
    assert.match(result.title, /Assessment Confidence:/);
  });

  it("uses post-surgery pathway copy", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
      clinicalHistory: fullClinicalHistory,
    });

    const result = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      uploads: buildHighEvidenceUploads(6),
      clinicalHistory: fullClinicalHistory,
    });

    assert.match(result.summary, /post-surgery assessment/i);
  });

  it("includes strengths only when supported by input", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
      clinicalHistory: fullClinicalHistory,
    });

    const strong = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      uploads: buildHighEvidenceUploads(9),
      photosByCategory: buildHighEvidencePhotosByCategory(),
      clinicalHistory: fullClinicalHistory,
    });

    assert.ok(strong.strengths.some((s) => s.includes("clinical images")));
    assert.ok(strong.strengths.some((s) => s.includes("Procedure details")));

    const sparse = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
    });

    assert.ok(!sparse.strengths.some((s) => s.includes("clinical images")));
    assert.ok(!sparse.strengths.some((s) => s.includes("Procedure details")));
  });

  it("includes limitations only when applicable", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
      clinicalHistory: fullClinicalHistory,
    });

    const complete = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      uploads: buildHighEvidenceUploads(9),
      photosByCategory: buildHighEvidencePhotosByCategory(),
      clinicalHistory: fullClinicalHistory,
    });

    assert.ok(!complete.limitations.some((l) => l.includes("clinical context was not provided")));

    const sparse = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: generatePostSurgeryAuditReport({
        summary: postSummary,
        caseId: CASE_ID,
        patientReviewPathway: "post_surgery",
      }),
    });

    assert.ok(sparse.limitations.some((l) => l.includes("clinical context was not provided")));
  });

  it("clamps score between 0 and 100", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
      clinicalHistory: fullClinicalHistory,
    });

    const result = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      uploads: buildHighEvidenceUploads(20),
      photosByCategory: buildHighEvidencePhotosByCategory(),
      clinicalHistory: fullClinicalHistory,
    });

    assert.ok(result.score >= 0 && result.score <= 100);
  });

  it("PDF renderer includes mandatory helper disclaimer", () => {
    const labels = buildAssessmentConfidenceLabelsEn();
    const result = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: generatePostSurgeryAuditReport({
        summary: postSummary,
        caseId: CASE_ID,
        patientReviewPathway: "post_surgery",
      }),
    });

    const html = renderAssessmentConfidenceHtml(result, labels);
    assert.match(html, /Assessment Confidence/);
    assert.match(html, /does not represent a diagnosis, treatment recommendation, or guarantee of surgical outcome/);
    assert.match(html, /assessmentConfidenceHelper/);
    assert.ok(!html.toLowerCase().includes("diagnostic confidence"));
    assert.ok(!html.toLowerCase().includes("ai confidence"));
  });

  it("post-surgery PDF template includes assessment confidence section", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
      clinicalHistory: fullClinicalHistory,
    });

    const html = renderPostSurgeryAuditReportHtml({
      report,
      caseId: CASE_ID,
      generatedAtDisplay: "2026-06-24",
      labels: buildPostSurgeryReportHtmlLabelsEn("Moderate concerns", "Minor observation"),
      photosByCategory: buildHighEvidencePhotosByCategory(),
      clinicalEvidenceLabels: buildPostSurgeryClinicalEvidenceGalleryLabelsEn(),
      clinicalHistory: fullClinicalHistory,
    });

    const reviewIdx = html.indexOf("What We Reviewed");
    const confidenceIdx = html.indexOf("Assessment Confidence");
    const concernsIdx = html.indexOf("Potential Concerns");

    assert.ok(reviewIdx >= 0);
    assert.ok(confidenceIdx > reviewIdx);
    if (concernsIdx >= 0) {
      assert.ok(confidenceIdx < concernsIdx);
    }
    assert.match(html, /does not represent a diagnosis, treatment recommendation, or guarantee of surgical outcome/);
  });
});

function clampExpect(result: { score: number }): number {
  return Math.max(0, Math.min(100, result.score));
}
