/**
 * HA-PDF-SAFETY-3 — Pre-surgery patient PDF/web quality guards.
 * Run: pnpm exec tsx --test tests/preSurgeryAuditPdf.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPreSurgeryReportHtmlLabelsEn,
  buildPreSurgeryClinicalEvidenceGalleryLabelsEn,
  PRE_SURGERY_OUTCOME_LABELS_EN,
} from "../src/lib/reports/preSurgeryReportLabels";
import { renderPreSurgeryPlanningReportHtml } from "../src/lib/reports/PreSurgeryPlanningReportHtml";
import { generatePreSurgeryPlanningReport } from "../src/lib/reports/preSurgeryPlanningReport";
import { sanitizePatientReportText } from "../src/lib/reports/postSurgeryPatientText";
import type { HairAuditIntelligenceBundle } from "../src/lib/hairaudit-intelligence/types";

const CASE_ID = "00000000-0000-4000-8000-000000000088";

const FORBIDDEN_OUTPUT_STRINGS = [
  "rule-based placeholder",
  "procedural intelligence",
  "clinicianNotes",
  "forensic hair-loss classification",
  "none_suggested",
  "await extraction pattern review",
  "imagingos",
  "Diagnostic Radar",
  "AI Score",
  "Forensic",
  "Graft Integrity Index",
  "Evidence Intelligence",
  "Audit Performance Signature",
];

function htmlVisibleText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ");
}

const sampleForensicSummary = {
  forensic_audit: {
    overall_score: 70,
    summary:
      "Based on the uploaded images, This may suggest visible frontal recession with planning considerations.",
    section_scores: {
      donor_management: 72,
      hairline_design: 68,
      naturalness_and_aesthetics: 74,
    },
    key_findings: [
      {
        title: "Visible frontal recession with early thinning extending into the mid-scalp",
        severity: "medium",
      },
      {
        title: "Future progression should be considered before final hairline design",
        severity: "low",
      },
    ],
    red_flags: [],
    photo_observations: [
      {
        category: "front",
        observation:
          "Based on the uploaded images, This may suggest conservative hairline planning is advisable.",
      },
      {
        category: "top",
        observation: "Crown involvement appears mild based on visible image evidence.",
      },
      {
        category: "donor_rear",
        observation: "Donor region appears moderate based on visible image evidence.",
      },
    ],
  },
};

function intelligenceWithClinicianNotesPlaceholder(): HairAuditIntelligenceBundle {
  return {
    engineVersion: "hairaudit.intelligence.v1",
    hairLossClassification: {
      fields: {
        norwoodStage: "III",
        crownProgression: "early",
        diffuseThinningPattern: "none_suggested",
      },
      clinicianNotes:
        "Forensic hair-loss classification (rule-based placeholder). Norwood III pattern noted.",
      patientSafeSummary:
        "Your images show visible frontal recession that should be planned carefully for long-term progression.",
      severity: "moderate",
      confidence: "moderate",
      suggestedNextStep: "Discuss progression risk before committing to a hairline design.",
    },
    donorIntelligence: {
      fields: {
        donorDensityBand: "appears_adequate",
        donorReserveRisk: "low",
        miniaturisationSuspicion: "none_suggested",
      },
      clinicianNotes: "Donor Intelligence (rule-based placeholder).",
      patientSafeSummary:
        "The donor region appears suitable for planning, although additional close-up review may be useful.",
      severity: "minor",
      confidence: "moderate",
    },
    proceduralIntelligence: {
      fields: {},
      clinicianNotes: "Procedural Intelligence (rule-based placeholder). Await extraction pattern review.",
      patientSafeSummary: "Procedural views were not applicable for pre-surgery planning review.",
      severity: "low",
      confidence: "low",
    },
    overallConfidence: "moderate",
    generatedAt: new Date().toISOString(),
  };
}

function renderHtmlForReport(
  report: ReturnType<typeof generatePreSurgeryPlanningReport>,
  photosByCategory?: Record<string, { signedUrl: string | null; label: string }[]>
): string {
  const outcomeLabel =
    PRE_SURGERY_OUTCOME_LABELS_EN[report.planningOutcomeId] ?? report.planningOutcomeId;
  return renderPreSurgeryPlanningReportHtml({
    report,
    caseId: CASE_ID,
    generatedAtDisplay: "2026-06-25",
    labels: buildPreSurgeryReportHtmlLabelsEn(outcomeLabel),
    photosByCategory,
    clinicalEvidenceLabels: buildPreSurgeryClinicalEvidenceGalleryLabelsEn(),
  });
}

function collectReportVisibleText(report: ReturnType<typeof generatePreSurgeryPlanningReport>): string {
  return JSON.stringify({
    sections: report.sections,
    imageAssessments: report.imageAssessments,
    recommendedNextSteps: report.recommendedNextSteps,
    patientSafeSummary: report.patientSafeSummary,
  }).toLowerCase();
}

describe("HA-PDF-SAFETY-3 pre-surgery audit PDF quality", () => {
  it("sanitizePatientReportText removes awkward phrasing and placeholders", () => {
    const raw =
      "Based on the uploaded images, This may suggest early recession. Forensic hair-loss classification (rule-based placeholder).";
    const cleaned = sanitizePatientReportText(raw);
    assert.match(cleaned, /submitted images suggest/i);
    assert.ok(!cleaned.toLowerCase().includes("rule-based placeholder"));
    assert.ok(!cleaned.toLowerCase().includes("this may suggest"));
    assert.ok(!cleaned.toLowerCase().includes("forensic hair-loss classification"));
  });

  it("report model excludes placeholder and internal strings when intelligence has clinicianNotes", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: {
        ...sampleForensicSummary,
        metadata: { hairAuditIntelligence: intelligenceWithClinicianNotesPlaceholder() },
      },
      caseId: CASE_ID,
      patientReviewPathway: "pre_surgery",
      intelligenceBundle: intelligenceWithClinicianNotesPlaceholder(),
    });

    const visible = collectReportVisibleText(report);
    for (const forbidden of FORBIDDEN_OUTPUT_STRINGS) {
      assert.ok(!visible.includes(forbidden.toLowerCase()), `leaked in report model: ${forbidden}`);
    }
  });

  it("future_progression section never uses clinicianNotes placeholder", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: {
        ...sampleForensicSummary,
        metadata: { hairAuditIntelligence: intelligenceWithClinicianNotesPlaceholder() },
      },
      caseId: CASE_ID,
      patientReviewPathway: "pre_surgery",
      intelligenceBundle: intelligenceWithClinicianNotesPlaceholder(),
    });

    const progression = report.sections.find((s) => s.id === "future_progression");
    assert.ok(progression);
    assert.ok(!progression!.finding.toLowerCase().includes("rule-based placeholder"));
    assert.ok(!progression!.finding.toLowerCase().includes("forensic hair-loss classification"));
    assert.ok(!progression!.finding.toLowerCase().includes("cliniciannotes"));
    assert.match(progression!.finding, /progression|long-term|donor/i);
  });

  it("pre-surgery PDF HTML excludes placeholder and internal strings", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: {
        ...sampleForensicSummary,
        metadata: { hairAuditIntelligence: intelligenceWithClinicianNotesPlaceholder() },
      },
      caseId: CASE_ID,
      patientReviewPathway: "pre_surgery",
      intelligenceBundle: intelligenceWithClinicianNotesPlaceholder(),
    });

    const html = htmlVisibleText(renderHtmlForReport(report)).toLowerCase();
    for (const forbidden of FORBIDDEN_OUTPUT_STRINGS) {
      assert.ok(!html.includes(forbidden.toLowerCase()), `leaked in HTML: ${forbidden}`);
    }
    assert.ok(!html.includes("this may suggest"));
  });

  it("forensic summary awkward phrasing is sanitized in overall planning section", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: sampleForensicSummary,
      caseId: CASE_ID,
      patientReviewPathway: "pre_surgery",
    });

    const overall = report.sections.find((s) => s.id === "overall_planning");
    assert.ok(overall);
    assert.ok(!overall!.finding.toLowerCase().includes("this may suggest"));
    assert.match(overall!.finding, /submitted images suggest|planning/i);
  });

  it("image assessments sanitize photo observation text", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: sampleForensicSummary,
      caseId: CASE_ID,
      patientReviewPathway: "pre_surgery",
    });

    const front = report.imageAssessments.find((a) => a.viewKey === "front");
    assert.ok(front);
    assert.ok(!front!.assessment.toLowerCase().includes("this may suggest"));
    assert.match(front!.assessment, /submitted images suggest|conservative|planning/i);
  });

  it("long-term preservation guidance appears in pre-surgery reports", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: sampleForensicSummary,
      caseId: CASE_ID,
      patientReviewPathway: "pre_surgery",
    });
    const html = renderHtmlForReport(report);
    assert.match(html, /Long-Term Hair Preservation Strategy/);
    assert.match(html, /Planning future long-term preservation/);
    assert.match(html, /does not prescribe treatment/i);
    assert.equal(report.longTermPreservation.subsections.length, 4);
  });

  it("visual summary appears when clean pre-surgery score data exists", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: {
        ...sampleForensicSummary,
        metadata: { hairAuditIntelligence: intelligenceWithClinicianNotesPlaceholder() },
      },
      caseId: CASE_ID,
      patientReviewPathway: "pre_surgery",
      intelligenceBundle: intelligenceWithClinicianNotesPlaceholder(),
    });
    const html = renderHtmlForReport(report);
    assert.match(html, /Review overview by area/i);
    assert.match(html, /data-section="pathwayVisualSummary"/);
    assert.match(html, /<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });
});
