import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generatePreSurgeryPlanningReport,
  isPreSurgeryPlanningReport,
  resolvePatientReportTemplateName,
  resolvePreSurgeryPlanningReport,
  shouldUsePreSurgeryReportTemplate,
} from "../src/lib/reports/preSurgeryPlanningReport";
import { shouldUsePostSurgeryReportTemplate } from "../src/lib/reports/postSurgeryAuditReport";
import { renderPreSurgeryPlanningReportHtml } from "../src/lib/reports/PreSurgeryPlanningReportHtml";
import {
  buildPreSurgeryReportHtmlLabelsEn,
  buildPreSurgeryClinicalEvidenceGalleryLabelsEn,
  PRE_SURGERY_OUTCOME_LABELS_EN,
} from "../src/lib/reports/preSurgeryReportLabels";

describe("preSurgeryPlanningReport", () => {
  const caseId = "00000000-0000-4000-8000-000000000088";

  const sampleForensicSummary = {
    forensic_audit: {
      overall_score: 70,
      summary:
        "Visible pattern suggests planning may be suitable with conservative hairline design and long-term progression in mind.",
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
          title: "Donor region appears suitable for planning with close-up review recommended",
          severity: "low",
        },
      ],
      red_flags: [],
      photo_observations: [
        {
          category: "front",
          observation:
            "Visible frontal recession pattern appears suitable for conservative planning.",
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
    metadata: {
      hairAuditIntelligence: {
        engineVersion: "hairaudit.intelligence.v1",
        hairLossClassification: {
          fields: {
            norwoodStage: "III",
            crownProgression: "early",
            diffuseThinningPattern: "none_suggested",
          },
          patientSafeSummary:
            "Your images show visible frontal recession with early thinning that should be planned carefully.",
          severity: "moderate",
          confidence: "moderate",
        },
        donorIntelligence: {
          fields: {
            donorDensityBand: "appears_adequate",
            donorReserveRisk: "low",
            miniaturisationSuspicion: "none_suggested",
          },
          patientSafeSummary:
            "The donor region appears suitable for planning, although additional close-up review may be useful.",
          severity: "minor",
          confidence: "moderate",
        },
        overallConfidence: "moderate",
        generatedAt: new Date().toISOString(),
      },
    },
  };

  it("generates structured pre-surgery report with scorecards and seven sections", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: sampleForensicSummary,
      caseId,
      reportVersion: 2,
      patientReviewPathway: "pre_surgery",
    });

    assert.equal(report.pathway, "pre_surgery");
    assert.equal(report.scorecards.length, 6);
    assert.equal(report.sections.length, 7);
    assert.ok(
      report.scorecards.some((c) => c.id === "estimated_graft_requirement" && c.displayValue.includes("–"))
    );
    assert.ok(report.recommendedNextSteps.length >= 1);
    assert.equal(report.patientSafeSummary.patientReviewPathway, "pre_surgery");
  });

  it("graft estimate uses a range and caveat", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: sampleForensicSummary,
      caseId,
      patientReviewPathway: "pre_surgery",
    });

    const graftCard = report.scorecards.find((c) => c.id === "estimated_graft_requirement");
    assert.ok(graftCard);
    assert.match(graftCard!.displayValue, /\d.*–.*\d/);
    assert.ok(report.graftEstimateRange);
    assert.match(report.graftEstimateCaveat, /preliminary/i);
    assert.match(report.graftEstimateCaveat, /in-person/i);

    const graftSection = report.sections.find((s) => s.id === "estimated_graft_requirement");
    assert.ok(graftSection);
    assert.match(graftSection!.finding, /preliminary/i);
  });

  it("does not use forbidden patient-facing terminology or overclaiming language", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: sampleForensicSummary,
      caseId,
      patientReviewPathway: "pre_surgery",
    });
    const blob = JSON.stringify(report).toLowerCase();
    assert.ok(!blob.includes("forensic"));
    assert.ok(!blob.includes("auditos"));
    assert.ok(!blob.includes("precision score"));
    assert.ok(!blob.includes("you need surgery"));
    assert.ok(!blob.includes("you are not suitable"));
    assert.ok(!blob.includes("guaranteed"));
  });

  it("stores and resolves pre_surgery_planning_report from summary", () => {
    const generated = generatePreSurgeryPlanningReport({
      summary: sampleForensicSummary,
      caseId,
      patientReviewPathway: "pre_surgery",
    });
    const summary = { pre_surgery_planning_report: generated };
    const resolved = resolvePreSurgeryPlanningReport(summary, {
      caseId,
      patientReviewPathway: "pre_surgery",
    });
    assert.ok(resolved);
    assert.equal(resolved?.reportId, generated.reportId);
    assert.ok(isPreSurgeryPlanningReport(generated));
  });

  it("legacy pre_surgery cases generate on demand when stored report missing", () => {
    const resolved = resolvePreSurgeryPlanningReport(sampleForensicSummary, {
      caseId,
      patientReviewPathway: "pre_surgery",
    });
    assert.ok(resolved);
    assert.equal(resolved?.sections.length, 7);
  });

  it("returns null for post_surgery pathway", () => {
    const resolved = resolvePreSurgeryPlanningReport(sampleForensicSummary, {
      caseId,
      patientReviewPathway: "post_surgery",
    });
    assert.equal(resolved, null);
  });

  it("routes patient pre_surgery to pre-surgery template and post_surgery unchanged", () => {
    assert.equal(shouldUsePreSurgeryReportTemplate("pre_surgery", "patient"), true);
    assert.equal(shouldUsePreSurgeryReportTemplate("post_surgery", "patient"), false);
    assert.equal(shouldUsePostSurgeryReportTemplate("post_surgery", "patient"), true);
    assert.equal(shouldUsePostSurgeryReportTemplate("pre_surgery", "patient"), false);
    assert.equal(resolvePatientReportTemplateName("pre_surgery", "patient"), "pre-surgery-planning");
    assert.equal(resolvePatientReportTemplateName("post_surgery", "patient"), "post-surgery-audit");
    assert.equal(resolvePatientReportTemplateName("post_surgery", "auditor"), "elite");
  });

  it("trust block and recommended next steps render in PDF template", () => {
    const report = generatePreSurgeryPlanningReport({
      summary: sampleForensicSummary,
      caseId,
      patientReviewPathway: "pre_surgery",
    });
    const outcomeLabel =
      PRE_SURGERY_OUTCOME_LABELS_EN[report.planningOutcomeId] ?? report.planningOutcomeId;
    const html = renderPreSurgeryPlanningReportHtml({
      report,
      caseId,
      generatedAtDisplay: "2026-06-21",
      labels: buildPreSurgeryReportHtmlLabelsEn(outcomeLabel),
      photosByCategory: {
        "Pre-op - preop front": [{ signedUrl: "https://example.com/front.jpg", label: "preop_front" }],
      },
      clinicalEvidenceLabels: buildPreSurgeryClinicalEvidenceGalleryLabelsEn(),
    });

    assert.match(html, /Independent Review Completed/);
    assert.match(html, /not a clinic sales recommendation/i);
    assert.match(html, /Recommended Next Steps/);
    assert.match(html, /Long-Term Hair Preservation Strategy/);
    assert.match(html, /Planning future long-term preservation/);
    assert.match(html, /does not prescribe treatment/i);
    assert.match(html, /Independent Pre-Surgery Planning Report/);
    for (const step of report.recommendedNextSteps.slice(0, 2)) {
      assert.match(html, new RegExp(step.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });
});
