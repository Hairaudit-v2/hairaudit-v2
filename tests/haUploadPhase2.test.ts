import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderEliteReportHtml, type EliteReportViewModel } from "../src/lib/reports/EliteReportHtml";
import {
  buildLegacyReportFindingsLayoutHtml,
  buildPatientPdfReviewAreas,
  getPdfReviewSectionMeta,
  resolvePdfReviewRisks,
} from "../src/lib/reports/patientPdfReviewAreas";
import { computePatientRequiredPhotoProgress } from "../src/lib/patient/patientRequiredPhotoProgress";
import type { AuditMode, ReportViewModel } from "../src/lib/pdf/reportBuilder";

function makeEliteVm(auditMode: AuditMode, risks: string[] = []): EliteReportViewModel {
  const viewModel: ReportViewModel = {
    caseId: "case-xyz",
    version: 3,
    generatedAt: "2026-03-30",
    auditMode,
    score: 72,
    donorQuality: "Good",
    graftSurvival: "Favorable",
    findings: [],
    areaScores: {},
    images: [],
  };
  return {
    viewModel,
    caseId: "case-xyz",
    generatedAt: "2026-03-30",
    version: 3,
    metrics: {
      donorQuality: "Good",
      graftSurvival: "Favorable",
      transectionRisk: "Low",
      implantationDensity: "Consistent",
      hairlineNaturalness: "Natural",
      donorScarVisibility: "Low",
    },
    areaDomains: [{ title: "Donor Management", score: 72, outOf5: 4, level: "Medium" }],
    sectionScores: [],
    highlights: ["Hairline appears natural"],
    risks,
    radar: {
      labels: ["Donor", "Recipient", "Grafts"],
      values: [72, 70, 68],
      overall: 72,
      confidence: 0.8,
    },
    photosByCategory: {},
  };
}

describe("resolvePdfReviewRisks", () => {
  const summary = {
    key_findings: [{ title: "Crown density concern", severity: "high" }],
    risks: ["Legacy risk string should not appear for patient"],
  };

  it("uses findings for patient mode and ignores legacy summary.risks", () => {
    const risks = resolvePdfReviewRisks(summary, "patient");
    assert.ok(risks.length >= 1);
    assert.doesNotMatch(risks.join(" "), /Legacy risk string/);
    assert.match(risks[0], /This may indicate/i);
  });

  it("falls back to legacy summary.risks for doctor mode when no findings", () => {
    const risks = resolvePdfReviewRisks({ risks: ["Donor scar visibility elevated"] }, "doctor");
    assert.deepEqual(risks, ["Donor scar visibility elevated"]);
  });

  it("reads key_findings from forensic_audit when top-level missing", () => {
    const risks = resolvePdfReviewRisks(
      {
        forensic_audit: {
          key_findings: [{ title: "Forensic-only finding", severity: "medium" }],
        },
      },
      "patient"
    );
    assert.ok(risks.length >= 1);
    assert.match(risks[0], /Forensic-only finding/i);
  });
});

describe("legacy report findings layout HTML", () => {
  const esc = (s: string) =>
    s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  it("omits review section for patient when no risks", () => {
    const html = buildLegacyReportFindingsLayoutHtml({
      auditMode: "patient",
      highlights: ["Hairline looks natural"],
      risks: [],
      esc,
    });
    assert.doesNotMatch(html, /Areas to discuss with your clinician/);
    assert.match(html, /What looks reassuring/);
  });

  it("shows patient positives before review with disclaimer", () => {
    const html = buildLegacyReportFindingsLayoutHtml({
      auditMode: "patient",
      highlights: ["Hairline looks natural"],
      risks: ["This may indicate: Uneven density. This should be reviewed by a qualified clinician."],
      esc,
    });
    const reviewIdx = html.indexOf("Areas to discuss with your clinician");
    const positiveIdx = html.indexOf("What looks reassuring");
    assert.ok(reviewIdx >= 0);
    assert.ok(positiveIdx >= 0);
    assert.ok(positiveIdx < reviewIdx);
    assert.match(html, /not a medical diagnosis/i);
  });

  it("keeps doctor two-column layout with empty risks placeholder", () => {
    const html = buildLegacyReportFindingsLayoutHtml({
      auditMode: "doctor",
      highlights: [],
      risks: [],
      esc,
    });
    assert.match(html, /twoCol/);
    assert.match(html, /No risks flagged yet/);
  });
});

describe("buildPatientPdfReviewAreas", () => {
  const summary = {
    key_findings: [
      {
        title: "Uneven density in crown zone",
        severity: "high",
        impact: "May affect visual balance",
        recommended_next_step: "Review with your clinic at next visit",
      },
    ],
    red_flags: [],
  };

  it("builds patient-safe review lines from key_findings", () => {
    const lines = buildPatientPdfReviewAreas(summary, { patientSafe: true });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /This may indicate/i);
    assert.match(lines[0], /Why it matters/i);
    assert.match(lines[0], /Suggested next step/i);
  });

  it("returns empty when no review-worthy findings", () => {
    assert.deepEqual(buildPatientPdfReviewAreas({ key_findings: [] }), []);
  });

  it("includes red flags in review areas", () => {
    const lines = buildPatientPdfReviewAreas({
      key_findings: [],
      red_flags: ["Possible over-harvesting pattern"],
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /This may indicate/i);
  });
});

describe("Elite PDF Areas Requiring Review", () => {
  it("omits review section for patient when no concerns", () => {
    const html = renderEliteReportHtml(makeEliteVm("patient", []));
    assert.doesNotMatch(html, /Areas to discuss with your clinician/);
    assert.match(html, /What looks reassuring/);
  });

  it("shows patient-safe review section after reassuring indicators when concerns exist", () => {
    const concern =
      "This may indicate: Uneven density in crown zone. This should be reviewed by a qualified clinician.";
    const html = renderEliteReportHtml(makeEliteVm("patient", [concern]));
    const reviewIdx = html.indexOf("Areas to discuss with your clinician");
    const positiveIdx = html.indexOf("What looks reassuring");
    assert.ok(reviewIdx >= 0);
    assert.ok(positiveIdx >= 0);
    assert.ok(positiveIdx < reviewIdx);
    assert.match(html, /What happens next/);
    assert.match(html, /not a medical diagnosis/i);
    assert.match(html, /Image quality may limit interpretation/i);
    assert.match(html, new RegExp(concern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("keeps empty review placeholder for doctor mode", () => {
    const html = renderEliteReportHtml(makeEliteVm("doctor", []));
    assert.match(html, /Areas Requiring Review/);
    assert.match(html, /No major concerns flagged/);
  });
});

describe("dashboard required photo progress", () => {
  it("counts required categories not raw uploads", () => {
    const progress = computePatientRequiredPhotoProgress([
      { type: "patient_photo:patient_current_front" },
      { type: "patient_photo:patient_current_front" },
      { type: "patient_photo:patient_current_left" },
      { type: "patient_photo:patient_current_left" },
    ]);
    assert.equal(progress.completedCount, 1);
    assert.equal(progress.totalRequired, 3);
    assert.equal(progress.percent, 33);
    assert.equal(progress.isComplete, false);
    assert.ok(progress.missingLabels.some((l) => /Top/i.test(l)));
    assert.ok(progress.missingLabels.some((l) => /Back/i.test(l)));
  });

  it("marks complete only when all three required views satisfied", () => {
    const progress = computePatientRequiredPhotoProgress([
      { type: "patient_photo:patient_current_front" },
      { type: "patient_photo:patient_current_top" },
      { type: "patient_photo:patient_current_donor_rear" },
      { type: "patient_photo:patient_current_left" },
    ]);
    assert.equal(progress.completedCount, 3);
    assert.equal(progress.percent, 100);
    assert.equal(progress.isComplete, true);
  });

  it("does not reach 100% from optional-only uploads", () => {
    const progress = computePatientRequiredPhotoProgress([
      { type: "patient_photo:patient_current_left" },
      { type: "patient_photo:patient_current_right" },
      { type: "patient_photo:patient_current_crown" },
      { type: "patient_photo:any_preop" },
    ]);
    assert.equal(progress.percent, 0);
    assert.equal(progress.isComplete, false);
  });
});

describe("getPdfReviewSectionMeta", () => {
  it("returns disclaimer and band label", () => {
    const meta = getPdfReviewSectionMeta({
      key_findings: [{ title: "Concern item", severity: "high" }],
    });
    assert.ok(meta.lines.length >= 1);
    assert.match(meta.bandLabel, /concern|review/i);
    assert.match(meta.disclaimer, /not a medical diagnosis/i);
  });
});
