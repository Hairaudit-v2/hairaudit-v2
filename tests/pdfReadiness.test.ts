import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertPdfReady,
  deriveDomainScoresFromSections,
  evaluatePdfReadiness,
  evaluateStoredPdfReadiness,
  isImageLimitedAuditSummary,
  resolveReportPdfStoragePath,
} from "@/lib/reports/pdfReadiness";

const DOMAIN_FIXTURE = [
  {
    domain_id: "donor_management",
    sections: [{ section_id: "donor_distribution" }, { section_id: "donor_trauma" }],
  },
  {
    domain_id: "recipient_implantation",
    sections: [{ section_id: "recipient_spacing" }, { section_id: "recipient_angles" }],
  },
];

test("isAuditSummaryReady: false when report status is processing and summary incomplete", () => {
  const result = evaluatePdfReadiness({
    caseStatus: "complete",
    reportStatus: "processing",
    summary: {
      findings: ["x"],
    },
  });
  assert.equal(result.ready, false);
  assert.match(String(result.reason ?? ""), /processing|incomplete/i);
});

test("isAuditSummaryReady: true when report status is processing but audit summary is complete", () => {
  const result = evaluatePdfReadiness({
    caseStatus: "pdf_pending",
    reportStatus: "processing",
    summary: {
      score: 84,
      section_scores: { donor_distribution: 78, recipient_spacing: 88 },
      forensic_audit: { summary: "Narrative is available and grounded." },
    },
  });
  assert.equal(result.ready, true);
});

test("isAuditSummaryReady: false when required fields are missing", () => {
  const result = evaluatePdfReadiness({
    caseStatus: "complete",
    reportStatus: "complete",
    summary: {
      // no overall score + no section scores + no narrative
      findings: ["x"],
    },
  });
  assert.equal(result.ready, false);
});

test("isAuditSummaryReady: true when summary is complete enough", () => {
  const result = evaluatePdfReadiness({
    caseStatus: "complete",
    reportStatus: "complete",
    summary: {
      score: 84,
      section_scores: { donor_distribution: 78, recipient_spacing: 88 },
      forensic_audit: { summary: "Narrative is available and grounded." },
    },
  });
  assert.equal(result.ready, true);
});

test("deriveDomainScoresFromSections: derives domains from rubric grouping", () => {
  const sections = {
    donor_distribution: 70,
    donor_trauma: 90,
    recipient_spacing: 80,
    recipient_angles: 60,
  };
  const domains = deriveDomainScoresFromSections(sections, DOMAIN_FIXTURE);
  assert.equal(domains.donor_management, 80);
  assert.equal(domains.recipient_implantation, 70);
});

test("deriveDomainScoresFromSections: returns empty when no section scores", () => {
  const domains = deriveDomainScoresFromSections({}, DOMAIN_FIXTURE);
  assert.deepEqual(domains, {});
});

test("deriveDomainScoresFromSections: derives only available domains when partial sections exist", () => {
  const sections = {
    donor_distribution: 72,
    // donor_trauma missing
    recipient_spacing: 88,
    // recipient_angles missing
  };
  const domains = deriveDomainScoresFromSections(sections, DOMAIN_FIXTURE);
  assert.equal(domains.donor_management, 72);
  assert.equal(domains.recipient_implantation, 88);
});

test("PDF gating: throws AUDIT_NOT_READY when audit still running", () => {
  assert.throws(
    () =>
      assertPdfReady({
        caseStatus: "audit_running",
        reportStatus: "processing",
        summary: {
          score: 90,
          section_scores: { donor_distribution: 90 },
          forensic_audit: { summary: "Would otherwise be complete." },
        },
      }),
    (err: unknown) => {
      const e = err as { code?: string; message?: string };
      return e.code === "AUDIT_NOT_READY" && /AUDIT_NOT_READY/.test(String(e.message ?? ""));
    }
  );
});

test("PDF gating: proceeds when readiness is true", () => {
  assert.doesNotThrow(() =>
    assertPdfReady({
      caseStatus: "complete",
      reportStatus: "complete",
      summary: {
        overall_score: 86,
        section_scores: { donor_distribution: 80, recipient_spacing: 92 },
        forensic_audit: { summary: "Enough data for PDF generation." },
      },
    })
  );
});

test("image-limited summary is PDF-ready with score and narrative only", () => {
  const summary = {
    score: 62,
    section_scores: {},
    forensic_audit: {
      summary: "Document-assisted review with limited photo views.",
      imageLimitedAssessment: true,
      documentAssistedAssessment: true,
    },
  };
  assert.equal(isImageLimitedAuditSummary(summary), true);
  const result = evaluatePdfReadiness({
    caseStatus: "processing",
    reportStatus: "processing",
    summary,
  });
  assert.equal(result.ready, true);
});

test("resolveReportPdfStoragePath prefers persisted pdf_path", () => {
  const caseId = "22222222-2222-4222-8222-222222222222";
  assert.equal(
    resolveReportPdfStoragePath({ caseId, version: 3, pdfPath: `${caseId}/v3.pdf` }),
    `${caseId}/v3.pdf`
  );
  assert.equal(resolveReportPdfStoragePath({ caseId, version: 3 }), `${caseId}/v3.pdf`);
});

test("evaluateStoredPdfReadiness matches persisted path and file presence", () => {
  const path = "case-1/v2.pdf";
  assert.equal(
    evaluateStoredPdfReadiness({ expectedPdfPath: path, storedPdfPath: path, fileExists: true }).ready,
    true
  );
  assert.equal(
    evaluateStoredPdfReadiness({ expectedPdfPath: path, storedPdfPath: path, fileExists: false }).ready,
    false
  );
  assert.match(
    String(
      evaluateStoredPdfReadiness({
        expectedPdfPath: path,
        storedPdfPath: "case-1/v3.pdf",
        fileExists: true,
      }).reason ?? ""
    ),
    /mismatch/i
  );
});

test("runAudit pipeline wires explicit render-pdf step after insert (HA-FIX-8G)", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/inngest/functions.ts"), "utf8");
  assert.match(src, /insertResult = await step\.run\("insert-report-row"/);
  assert.match(src, /return \{ reportId: String\(insertedReport\.id\), version: nextVersion \}/);
  assert.match(src, /render-pdf-\$\{attempt\}/);
  assert.match(src, /persistReportPdfPath/);
  assert.match(src, /fetchReportPdfFromStorage/);
  assert.match(src, /PDF already present in storage; skipping render/);
  assert.doesNotMatch(src, /build-and-upload-pdf/);
});
