import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderEliteReportHtml, type EliteReportViewModel } from "../src/lib/reports/EliteReportHtml";
import type { AuditMode, ReportViewModel } from "../src/lib/pdf/reportBuilder";
import { buildPatientSafeReportSummary } from "../src/lib/reports/patientSafeSummary";
import { buildPatientWhatHappensNext } from "../src/lib/reports/patientWhatHappensNext";
import { getPatientDomainAssessment } from "../src/lib/reports/patientDomainAssessment";

function makeEliteVm(auditMode: AuditMode, opts?: { risks?: string[]; highlights?: string[] }): EliteReportViewModel {
  const viewModel = {
    ...({
      caseId: "case-xyz",
      version: 3,
      generatedAt: "2026-06-19",
      auditMode,
      score: 72,
      donorQuality: "Good",
      graftSurvival: "Favorable",
      findings: [],
      areaScores: {},
      images: [],
    } satisfies ReportViewModel),
    forensic: {
      key_findings: [
        { title: "Donor healing appears within expected range", severity: "low" },
        { title: "Crown density may need follow-up review", severity: "high", impact: "May affect long-term appearance" },
      ],
      red_flags: [] as unknown[],
    },
  } as ReportViewModel & {
    forensic?: { key_findings: unknown[]; red_flags: unknown[] };
  };

  return {
    viewModel,
    caseId: "case-xyz",
    generatedAt: "2026-06-19",
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
    highlights: opts?.highlights ?? ["Donor healing appears within expected range"],
    risks: opts?.risks ?? [],
    radar: {
      labels: ["Donor", "Recipient", "Grafts"],
      values: [72, 70, 68],
      overall: 72,
      confidence: 0.8,
    },
    photosByCategory: {},
  };
}

describe("patient report experience (HA-REPORT-1)", () => {
  it("does not lead patient PDF with numeric score architecture", () => {
    const html = renderEliteReportHtml(makeEliteVm("patient"));
    assert.doesNotMatch(html, /Overall Surgical Quality Score/);
    assert.doesNotMatch(html, /class="scoreBadge"/);
    assert.doesNotMatch(html, /class="scoreBubble"/);
    assert.doesNotMatch(html, /Diagnostic Radar Signature/);
    assert.doesNotMatch(html, /Graft Integrity Index/);
    assert.match(html, /clinicalOverview/);
  });

  it("orders patient findings as reassurance before concerns and adds what happens next", () => {
    const concern =
      "This may indicate: Crown density may need follow-up review. This should be reviewed by a qualified clinician.";
    const html = renderEliteReportHtml(makeEliteVm("patient", { risks: [concern] }));
    const reassuringIdx = html.indexOf("What looks reassuring");
    const concernIdx = html.indexOf("Areas to discuss with your clinician");
    const nextIdx = html.indexOf("What happens next");
    assert.ok(reassuringIdx >= 0);
    assert.ok(concernIdx > reassuringIdx);
    assert.ok(nextIdx > concernIdx);
    assert.match(html, /Contact your treating clinic|Book a review with your treating clinician/i);
  });

  it("uses qualitative domain labels instead of numeric scores for patients", () => {
    const html = renderEliteReportHtml(makeEliteVm("patient"));
    assert.match(html, /domainAssessment/);
    assert.match(html, /Within expected range|Generally acceptable|Worth discussing with your clinician|Limited photo coverage/);
    assert.doesNotMatch(html, /72 \/ 100/);
  });

  it("builds patient summary without audit score language", () => {
    const report = buildPatientSafeReportSummary({
      key_findings: [{ title: "Donor healing appears within expected range", severity: "low" }],
    });
    assert.doesNotMatch(report.plainEnglishSummary, /score|out of 100/i);
    assert.ok(report.whatHappensNext.steps.length >= 2);
    assert.match(report.whatHappensNext.sectionTitle, /What happens next/i);
  });

  it("escalates what happens next copy for higher concern bands", () => {
    const urgent = buildPatientWhatHappensNext("urgent");
    const none = buildPatientWhatHappensNext("none");
    assert.match(urgent.steps.join(" "), /promptly|urgent/i);
    assert.match(none.reassurance, /No urgent action/i);
  });

  it("maps domain scores to calm qualitative assessments", () => {
    assert.equal(getPatientDomainAssessment(85).label, "Within expected range");
    assert.equal(getPatientDomainAssessment(null).label, "Limited photo coverage");
  });
});
