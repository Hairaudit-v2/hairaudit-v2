import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPdfReady,
  deriveDomainScoresFromSections,
  evaluatePdfReadiness,
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

test("isAuditSummaryReady: false when report status is processing", () => {
  const result = evaluatePdfReadiness({
    caseStatus: "complete",
    reportStatus: "processing",
    summary: {
      score: 80,
      section_scores: { donor_distribution: 70 },
      forensic_audit: { summary: "Complete enough summary." },
    },
  });
  assert.equal(result.ready, false);
  assert.match(String(result.reason ?? ""), /processing/i);
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

test("PDF gating: throws AUDIT_NOT_READY when readiness is false", () => {
  assert.throws(
    () =>
      assertPdfReady({
        caseStatus: "processing",
        reportStatus: "complete",
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
