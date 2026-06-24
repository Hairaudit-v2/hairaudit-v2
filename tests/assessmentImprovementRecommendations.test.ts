/**
 * HA-REPORT-5D.1 — Assessment Improvement Recommendations tests.
 * Run: pnpm exec tsx --test tests/assessmentImprovementRecommendations.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAssessmentConfidence } from "../src/lib/reports/assessmentConfidence";
import {
  buildAssessmentImprovementLabelsEn,
  buildAssessmentImprovementRecommendations,
  renderAssessmentImprovementHtml,
} from "../src/lib/reports/assessmentImprovementRecommendations";
import { generatePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";
import { renderPostSurgeryAuditReportHtml } from "../src/lib/reports/PostSurgeryAuditReportHtml";
import {
  buildPostSurgeryReportHtmlLabelsEn,
  buildPostSurgeryClinicalEvidenceGalleryLabelsEn,
} from "../src/lib/reports/postSurgeryReportLabels";

import type { ClinicalHistorySnapshot } from "../src/lib/hairaudit/clinical-history/clinicalHistoryTypes";

const CASE_ID = "00000000-0000-4000-8000-000000000088";

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

const sparseSummary = {
  forensic_audit: {
    overall_score: 60,
    section_scores: { donor_management: 60, extraction_quality: 58 },
    key_findings: [{ title: "Visible thinning in frontal region", severity: "low" }],
    red_flags: [],
    photo_observations: [{ category: "front", observation: "Front reviewed." }],
  },
};

describe("assessmentImprovementRecommendations", () => {
  it("returns no recommendations for high confidence band", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sparseSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
      clinicalHistory: fullClinicalHistory,
    });

    const confidence = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      uploads: Array.from({ length: 9 }, (_, i) => ({
        id: `img-${i}`,
        type: "patient_photo:preop_front",
        storage_path: `cases/a/${i}.jpg`,
      })),
      photosByCategory: buildHighEvidencePhotosByCategory(),
      clinicalHistory: fullClinicalHistory,
      documentAssistedAssessment: true,
    });

    assert.equal(confidence.band, "high");

    const result = buildAssessmentImprovementRecommendations({
      pathway: "post_surgery",
      postReport: report,
      confidence,
    });

    assert.equal(result.itemIds.length, 0);
    assert.equal(result.recommendations.length, 0);
  });

  it("generates prioritized recommendations for moderate confidence", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sparseSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });

    const confidence = buildAssessmentConfidence({
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

    assert.equal(confidence.band, "moderate");

    const result = buildAssessmentImprovementRecommendations({
      pathway: "post_surgery",
      postReport: report,
      confidence,
    });

    assert.ok(result.itemIds.length > 0);
    assert.ok(result.itemIds.length <= 4);
    assert.ok(result.itemIds.includes("additionalPhotos"));
  });

  it("generates recommendations for limited confidence with missing images", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sparseSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });

    const confidence = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      imageLimitedAssessment: true,
    });

    assert.equal(confidence.band, "limited");

    const result = buildAssessmentImprovementRecommendations({
      pathway: "post_surgery",
      postReport: report,
      confidence,
      imageLimitedAssessment: true,
    });

    assert.ok(result.itemIds.includes("additionalPhotos"));
    assert.ok(result.itemIds.includes("donorPhotos"));
    assert.ok(result.recommendations.length <= 4);
  });

  it("does not exceed four recommendations", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sparseSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });

    const confidence = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      imageLimitedAssessment: true,
    });

    const result = buildAssessmentImprovementRecommendations({
      pathway: "post_surgery",
      postReport: report,
      confidence,
      imageLimitedAssessment: true,
    });

    assert.ok(result.recommendations.length <= 4);
  });

  it("prioritizes photo view gaps before procedural details", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sparseSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });

    const confidence = buildAssessmentConfidence({
      pathway: "post_surgery",
      postReport: report,
      uploads: [{ id: "1", type: "patient_photo:preop_front", storage_path: "a/1.jpg" }],
      imageLimitedAssessment: true,
    });

    const result = buildAssessmentImprovementRecommendations({
      pathway: "post_surgery",
      postReport: report,
      uploads: [{ id: "1", type: "patient_photo:preop_front", storage_path: "a/1.jpg" }],
      confidence,
      imageLimitedAssessment: true,
    });

    assert.equal(result.itemIds[0], "additionalPhotos");
    assert.equal(result.itemIds[1], "donorPhotos");
  });

  it("renders high-coverage message instead of recommendation list for high band", () => {
    const labels = buildAssessmentImprovementLabelsEn();
    const html = renderAssessmentImprovementHtml({
      band: "high",
      recommendations: { itemIds: [], recommendations: [] },
      labels,
    });

    assert.match(html, /How To Improve Assessment Accuracy/);
    assert.match(html, /strong assessment coverage/);
    assert.ok(!html.includes("assessmentImprovementList"));
  });

  it("renders recommendation list and footer for moderate band", () => {
    const labels = buildAssessmentImprovementLabelsEn();
    const html = renderAssessmentImprovementHtml({
      band: "moderate",
      recommendations: {
        itemIds: ["additionalPhotos", "donorPhotos"],
        recommendations: [
          labels.items.additionalPhotos,
          labels.items.donorPhotos,
        ],
      },
      labels,
    });

    assert.match(html, /How To Improve Assessment Accuracy/);
    assert.match(html, /multiple scalp angles/);
    assert.match(html, /donor area photographs/);
    assert.match(html, /Improved evidence may allow more detailed procedural analysis/);
    assert.ok(!html.toLowerCase().includes("insufficient metadata"));
    assert.ok(!html.toLowerCase().includes("classifier inputs"));
  });

  it("PDF template includes improvement section after assessment confidence", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sparseSummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });

    const html = renderPostSurgeryAuditReportHtml({
      report,
      caseId: CASE_ID,
      generatedAtDisplay: "2026-06-24",
      labels: buildPostSurgeryReportHtmlLabelsEn("Moderate concerns", "Minor observation"),
      clinicalEvidenceLabels: buildPostSurgeryClinicalEvidenceGalleryLabelsEn(),
      imageLimitedAssessment: true,
    });

    const confidenceIdx = html.indexOf("Assessment Confidence");
    const improvementIdx = html.indexOf("How To Improve Assessment Accuracy");
    assert.ok(confidenceIdx >= 0);
    assert.ok(improvementIdx > confidenceIdx);
    assert.match(html, /assessmentImprovementSection/);
  });
});
