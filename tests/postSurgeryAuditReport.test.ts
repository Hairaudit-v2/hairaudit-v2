import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generatePostSurgeryAuditReport,
  isPostSurgeryAuditReport,
  resolvePostSurgeryAuditReport,
  shouldUsePostSurgeryReportTemplate,
} from "../src/lib/reports/postSurgeryAuditReport";

describe("postSurgeryAuditReport", () => {
  const caseId = "00000000-0000-4000-8000-000000000099";

  const sampleForensicSummary = {
    forensic_audit: {
      overall_score: 72,
      summary:
        "Independent review indicates generally acceptable procedural quality with some moderate donor preservation concerns requiring observation.",
      section_scores: {
        donor_management: 68,
        extraction_quality: 74,
        density_distribution: 81,
        recipient_placement: 76,
        hairline_design: 72,
        post_op_course_and_aftercare: 78,
      },
      key_findings: [
        {
          title: "Donor region shows moderate extraction irregularity in the left temporal zone",
          severity: "medium",
        },
        {
          title: "Recipient density distribution appears generally consistent",
          severity: "low",
        },
      ],
      red_flags: [],
      photo_observations: [
        { category: "front", observation: "Visible frontal density appears lower than expected relative to stated graft count." },
        { category: "donor_rear", observation: "Donor region shows moderate extraction irregularity requiring further monitoring." },
      ],
    },
  };

  it("generates structured post-surgery report with scorecards and eight sections", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sampleForensicSummary,
      caseId,
      reportVersion: 2,
      patientReviewPathway: "post_surgery",
    });

    assert.equal(report.pathway, "post_surgery");
    assert.equal(report.scorecards.length, 6);
    assert.equal(report.sections.length, 8);
    assert.ok(report.scorecards.some((c) => c.id === "donor_preservation" && c.displayValue === "68%"));
    assert.ok(report.recommendedNextSteps.length >= 1);
    assert.ok(report.longTermPreservation.subsections.length === 4);
    assert.ok(report.repairPlanningGuidance.length >= 3);
    assert.equal(report.patientSafeSummary.patientReviewPathway, "post_surgery");
  });

  it("does not use forbidden patient-facing terminology in generated findings", () => {
    const report = generatePostSurgeryAuditReport({
      summary: sampleForensicSummary,
      caseId,
      patientReviewPathway: "post_surgery",
    });
    const blob = JSON.stringify(report).toLowerCase();
    assert.ok(!blob.includes("forensic"));
    assert.ok(!blob.includes("auditos"));
    assert.ok(!blob.includes("precision score"));
  });

  it("stores and resolves post_surgery_audit_report from summary", () => {
    const generated = generatePostSurgeryAuditReport({
      summary: sampleForensicSummary,
      caseId,
      patientReviewPathway: "post_surgery",
    });
    const summary = { post_surgery_audit_report: generated };
    const resolved = resolvePostSurgeryAuditReport(summary, {
      caseId,
      patientReviewPathway: "post_surgery",
    });
    assert.ok(resolved);
    assert.equal(resolved?.reportId, generated.reportId);
    assert.ok(isPostSurgeryAuditReport(generated));
  });

  it("legacy post_surgery cases generate on demand when stored report missing", () => {
    const resolved = resolvePostSurgeryAuditReport(sampleForensicSummary, {
      caseId,
      patientReviewPathway: "post_surgery",
    });
    assert.ok(resolved);
    assert.equal(resolved?.sections.length, 8);
  });

  it("returns null for pre_surgery pathway", () => {
    const resolved = resolvePostSurgeryAuditReport(sampleForensicSummary, {
      caseId,
      patientReviewPathway: "pre_surgery",
    });
    assert.equal(resolved, null);
  });

  it("routes patient post_surgery to post-surgery template", () => {
    assert.equal(shouldUsePostSurgeryReportTemplate("post_surgery", "patient"), true);
    assert.equal(shouldUsePostSurgeryReportTemplate("pre_surgery", "patient"), false);
    assert.equal(shouldUsePostSurgeryReportTemplate("post_surgery", "auditor"), false);
  });

  it("flags concerns when red flags present", () => {
    const report = generatePostSurgeryAuditReport({
      summary: {
        forensic_audit: {
          section_scores: { donor_management: 45, extraction_quality: 50 },
          key_findings: [],
          red_flags: [{ flag: "Moderate irregular extraction patterns detected", severity: "high" }],
        },
      },
      caseId,
      patientReviewPathway: "post_surgery",
    });
    assert.ok(report.concernFlags.length >= 1);
    assert.ok(
      report.proceduralOutcomeId === "donor_preservation_concerns" ||
        report.proceduralOutcomeId === "moderate_concerns"
    );
  });
});
