/**
 * HA-FIX-8H — PDF rebuild preflight diagnostics tests.
 * Run: pnpm exec tsx --test tests/reportPdfRebuildPreflight.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  attachPatientSafeSummaryToReport,
  buildReportPdfRebuildDiagnostics,
  hasStoredPatientSafeSummary,
  mergeForensicIntoSummaryShape,
} from "@/lib/reports/reportPdfRebuildPreflight";
import { evaluatePdfReadiness } from "@/lib/reports/pdfReadiness";

const CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const REPORT = "9909c2d5-23dc-4a34-a214-593f7b52838e";

function imageLimitedForensicSummary() {
  return {
    score: 68,
    notes: "Image-limited review based on available clinical materials.",
    forensic_audit: {
      overall_score: 68,
      summary: "Image-limited review based on available clinical materials.",
      key_findings: [{ title: "Donor area appears stable", severity: "low", impact: "Within expected range." }],
      red_flags: [],
      imageLimitedAssessment: true,
      documentAssistedAssessment: true,
      missingRequiredPhotoLabels: ["Top / crown view"],
    },
  };
}

describe("mergeForensicIntoSummaryShape", () => {
  it("maps nested forensic key_findings to top-level summary fields", () => {
    const merged = mergeForensicIntoSummaryShape({
      forensic_audit: {
        overall_score: 72,
        summary: "Clinical narrative from forensic payload.",
        section_scores: { donor_management: 70 },
        key_findings: [{ title: "Stable donor", severity: "low" }],
        red_flags: [{ flag: "Sparse crown documentation" }],
      },
    });
    assert.equal(merged.score, 72);
    assert.equal(merged.notes, "Clinical narrative from forensic payload.");
    assert.deepEqual(merged.section_scores, { donor_management: 70 });
    assert.equal(Array.isArray(merged.key_findings), true);
    assert.equal(Array.isArray(merged.red_flags), true);
  });
});

describe("attachPatientSafeSummaryToReport", () => {
  it("builds patientSafeSummary from forensic audit when initially missing", () => {
    const enriched = attachPatientSafeSummaryToReport(imageLimitedForensicSummary(), {
      caseId: CASE,
      reportVersion: 2,
      patientReviewPathway: "post_surgery",
    });
    assert.equal(hasStoredPatientSafeSummary(enriched), true);
    assert.ok(enriched.patientSafeSummary);
    assert.equal(
      (enriched.post_surgery_audit_report as { patientSafeSummary?: unknown } | undefined)?.patientSafeSummary != null,
      true
    );
  });

  it("does not invent content when forensic audit is absent", () => {
    const enriched = attachPatientSafeSummaryToReport({ findings: ["orphan finding"] });
    assert.equal(hasStoredPatientSafeSummary(enriched), false);
  });
});

describe("buildReportPdfRebuildDiagnostics", () => {
  it("flags missing forensic and patientSafeSummary for empty summary", () => {
    const diagnostics = buildReportPdfRebuildDiagnostics({
      report: {
        id: REPORT,
        case_id: CASE,
        version: 2,
        summary: {},
        pdf_path: null,
        status: "complete",
      },
      caseId: CASE,
      caseStatus: "complete",
    });
    assert.equal(diagnostics.hasReportRow, true);
    assert.equal(diagnostics.hasForensicAudit, false);
    assert.equal(diagnostics.hasPatientSafeSummary, false);
    assert.ok(diagnostics.missingFields.includes("forensic_audit"));
    assert.ok(diagnostics.missingFields.includes("scores"));
    assert.ok(diagnostics.missingFields.includes("narrative"));
  });

  it("reports image-limited forensic payload as rebuild-ready after enrichment", () => {
    const enriched = attachPatientSafeSummaryToReport(imageLimitedForensicSummary(), {
      caseId: CASE,
      reportVersion: 2,
      patientReviewPathway: "post_surgery",
    });
    const diagnostics = buildReportPdfRebuildDiagnostics({
      report: {
        id: REPORT,
        case_id: CASE,
        version: 2,
        summary: imageLimitedForensicSummary(),
        pdf_path: null,
        status: "complete",
      },
      caseId: CASE,
      caseStatus: "complete",
      enrichedSummary: enriched,
    });
    assert.equal(diagnostics.hasForensicAudit, true);
    assert.equal(diagnostics.hasScores, true);
    assert.equal(diagnostics.hasNarrative, true);
    assert.equal(diagnostics.hasPatientSafeSummary, true);
    assert.equal(diagnostics.hasSections, true);
    assert.equal(diagnostics.resolvedPdfPath, `${CASE}/v2.pdf`);
    assert.deepEqual(diagnostics.missingFields, []);
    assert.equal(
      evaluatePdfReadiness({
        caseStatus: "complete",
        reportStatus: "complete",
        summary: enriched,
      }).ready,
      true
    );
  });
});

describe("image-limited live case pattern", () => {
  it("root cause: forensic-only summary missing top-level patientSafeSummary until mapped", () => {
    const raw = imageLimitedForensicSummary();
    assert.equal(hasStoredPatientSafeSummary(raw), false);
    const diagnosticsBefore = buildReportPdfRebuildDiagnostics({
      report: {
        id: REPORT,
        case_id: CASE,
        version: 2,
        summary: raw,
        pdf_path: null,
        status: "processing",
      },
      caseId: CASE,
      caseStatus: "complete",
    });
    assert.ok(diagnosticsBefore.missingFields.includes("patientSafeSummary"));

    const enriched = attachPatientSafeSummaryToReport(raw, {
      caseId: CASE,
      reportVersion: 2,
      patientReviewPathway: "post_surgery",
    });
    const diagnosticsAfter = buildReportPdfRebuildDiagnostics({
      report: {
        id: REPORT,
        case_id: CASE,
        version: 2,
        summary: raw,
        pdf_path: null,
        status: "processing",
      },
      caseId: CASE,
      caseStatus: "complete",
      enrichedSummary: enriched,
    });
    assert.equal(diagnosticsAfter.missingFields.includes("patientSafeSummary"), false);
  });
});
