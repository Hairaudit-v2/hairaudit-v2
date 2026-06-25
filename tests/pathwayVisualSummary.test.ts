/**
 * HA-PDF-VISUAL-2 — Patient-safe pathway visual summary tests.
 * Run: pnpm exec tsx --test tests/pathwayVisualSummary.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPostSurgeryVisualSummary,
  buildPreSurgeryVisualSummary,
  renderPathwayVisualSummaryHtml,
} from "../src/lib/reports/pathwayVisualSummary";
import { generatePostSurgeryAuditReport } from "../src/lib/reports/postSurgeryAuditReport";
import { generatePreSurgeryPlanningReport } from "../src/lib/reports/preSurgeryPlanningReport";
import { renderPostSurgeryAuditReportHtml } from "../src/lib/reports/PostSurgeryAuditReportHtml";
import { renderPreSurgeryPlanningReportHtml } from "../src/lib/reports/PreSurgeryPlanningReportHtml";
import { buildPostSurgeryReportHtmlLabelsEn } from "../src/lib/reports/postSurgeryReportLabels";
import {
  buildPreSurgeryReportHtmlLabelsEn,
  PRE_SURGERY_OUTCOME_LABELS_EN,
} from "../src/lib/reports/preSurgeryReportLabels";

const CASE_ID = "00000000-0000-4000-8000-000000000099";

const FORBIDDEN_VISUAL_TERMS = [
  "Diagnostic Radar",
  "AI Score",
  "Forensic",
  "Platinum",
  "Gold Tier",
  "Silver Tier",
  "Bronze Tier",
  "Poor",
  "Graft Integrity Index",
  "Evidence Intelligence",
  "clinicianNotes",
  "rule-based placeholder",
  "Audit Performance Signature",
];

function htmlVisibleText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ");
}

const postSurgerySummary = {
  forensic_audit: {
    overall_score: 72,
    section_scores: {
      donor_management: 68,
      extraction_quality: 74,
      density_distribution: 81,
      recipient_placement: 76,
      post_op_course_and_aftercare: 78,
    },
    key_findings: [],
    red_flags: [],
  },
};

const preSurgerySummary = {
  forensic_audit: {
    overall_score: 70,
    section_scores: {
      donor_management: 72,
      hairline_design: 68,
    },
    key_findings: [],
    red_flags: [],
  },
  metadata: {
    hairAuditIntelligence: {
      engineVersion: "hairaudit.intelligence.v1",
      hairLossClassification: {
        fields: { norwoodStage: "III", crownProgression: "early" },
        patientSafeSummary: "Visible frontal recession pattern noted.",
        severity: "moderate",
        confidence: "moderate",
      },
      donorIntelligence: {
        fields: { donorDensityBand: "appears_adequate", donorReserveRisk: "low" },
        patientSafeSummary: "Donor region appears suitable for planning.",
        severity: "minor",
        confidence: "moderate",
      },
      overallConfidence: "moderate",
      generatedAt: new Date().toISOString(),
    },
  },
};

describe("HA-PDF-VISUAL-2 pathway visual summary", () => {
  it("builds post-surgery visual summary when at least three domains are available", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSurgerySummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });
    const summary = buildPostSurgeryVisualSummary(report);
    assert.equal(summary.status, "ready");
    assert.ok(summary.domains.length >= 3);
    assert.ok(summary.radarSvg);
    assert.match(summary.title, /Review overview by area/i);
    assert.match(summary.subtitle, /Based on submitted images and information/i);
  });

  it("returns insufficient state when fewer than three domains are available", () => {
    const summary = buildPostSurgeryVisualSummary({
      scorecards: [
        { id: "donor_preservation", percentScore: 70, displayValue: "70%" },
        { id: "extraction_pattern", displayValue: "Under review" },
      ],
    } as ReturnType<typeof generatePostSurgeryAuditReport>);
    assert.equal(summary.status, "insufficient");
    assert.equal(summary.radarSvg, null);
    assert.match(summary.emptyMessage, /visual overview/i);
  });

  it("builds pre-surgery visual summary when clean score data exists", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: preSurgerySummary,
      caseId: CASE_ID,
      patientReviewPathway: "pre_surgery",
    });
    const summary = buildPreSurgeryVisualSummary(report);
    assert.equal(summary.status, "ready");
    assert.ok(summary.domains.length >= 3);
    assert.ok(summary.radarSvg);
  });

  it("rendered HTML excludes forbidden legacy wording", () => {
    const postReport = generatePostSurgeryAuditReport({
      summary: postSurgerySummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });
    const preReport = generatePreSurgeryPlanningReport({
      summary: preSurgerySummary,
      caseId: CASE_ID,
      patientReviewPathway: "pre_surgery",
    });

    const fragments = [
      renderPathwayVisualSummaryHtml(buildPostSurgeryVisualSummary(postReport)),
      renderPathwayVisualSummaryHtml(buildPreSurgeryVisualSummary(preReport)),
      renderPostSurgeryAuditReportHtml({
        report: postReport,
        caseId: CASE_ID,
        generatedAtDisplay: "2026-06-25",
        labels: buildPostSurgeryReportHtmlLabelsEn("Moderate concerns", "Minor observation"),
        clinicalEvidenceLabels: { title: "Clinical Evidence Reviewed", subtitle: "", noPhoto: "", completeness: "" },
      }),
      renderPreSurgeryPlanningReportHtml({
        report: preReport,
        caseId: CASE_ID,
        generatedAtDisplay: "2026-06-25",
        labels: buildPreSurgeryReportHtmlLabelsEn(
          PRE_SURGERY_OUTCOME_LABELS_EN[preReport.planningOutcomeId]
        ),
        clinicalEvidenceLabels: { title: "Clinical Evidence Reviewed", subtitle: "", noPhoto: "", completeness: "" },
      }),
    ];

    for (const html of fragments) {
      const lower = htmlVisibleText(html).toLowerCase();
      for (const forbidden of FORBIDDEN_VISUAL_TERMS) {
        assert.ok(!lower.includes(forbidden.toLowerCase()), `leaked forbidden term: ${forbidden}`);
      }
      assert.match(html, /Review overview by area/i);
      assert.match(html, /Based on submitted images and information/i);
    }
  });

  it("post-surgery PDF HTML includes visual summary section when score data exists", () => {
    const report = generatePostSurgeryAuditReport({
      summary: postSurgerySummary,
      caseId: CASE_ID,
      patientReviewPathway: "post_surgery",
    });
    const html = renderPostSurgeryAuditReportHtml({
      report,
      caseId: CASE_ID,
      generatedAtDisplay: "2026-06-25",
      labels: buildPostSurgeryReportHtmlLabelsEn("Moderate concerns", "Minor observation"),
      clinicalEvidenceLabels: { title: "Clinical Evidence Reviewed", subtitle: "", noPhoto: "", completeness: "" },
    });
    assert.match(html, /data-section="pathwayVisualSummary"/);
    assert.match(html, /<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });
});
