import test from "node:test";
import assert from "node:assert/strict";
import { renderEliteReportHtml, type EliteReportViewModel } from "@/lib/reports/EliteReportHtml";
import type { AuditMode, ReportViewModel } from "@/lib/pdf/reportBuilder";

function makeReportViewModel(auditMode: AuditMode): ReportViewModel {
  return {
    caseId: "case-xyz",
    version: 3,
    generatedAt: "2026-03-30",
    auditMode,
    score: 84,
    donorQuality: "Good",
    graftSurvival: "Favorable",
    findings: [],
    areaScores: {},
    images: [],
  };
}

function makeEliteVm(auditMode: AuditMode): EliteReportViewModel {
  return {
    viewModel: makeReportViewModel(auditMode),
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
    areaDomains: [
      { title: "Donor Management", score: 88, outOf5: 4, level: "High" },
      { title: "Recipient Site Design", score: 72, outOf5: 4, level: "Medium" },
      { title: "Graft Handling", score: 66, outOf5: 3, level: "Medium" },
    ],
    sectionScores: [],
    highlights: [],
    risks: [],
    radar: {
      labels: ["Donor", "Recipient", "Grafts"],
      values: [88, 72, 66],
      overall: 84,
      confidence: 0.9,
    },
    photosByCategory: {},
  };
}

test("patient mode uses patient narrative template language", () => {
  const html = renderEliteReportHtml(makeEliteVm("patient"));
  assert.match(html, /Plain-English meaning/);
  assert.match(html, /Why this matters for your result/);
  assert.match(html, /Protecting Native Hair and Future Donor Options/);
  assert.match(html, /outcomes are often strongest when paired with long-term preservation\./i);
  assert.match(html, /redistributes available hair but does not usually stop ongoing hair loss/i);
  assert.match(html, /DHT inhibitors \/ DHT management/);
  assert.match(html, /LED light therapy/);
  assert.match(html, /PRP with microneedling/);
  assert.match(html, /Exosomes with microneedling/);
  assert.match(html, /Donor protection strategy/);
  assert.match(html, /What it is:/);
  assert.match(html, /Why it may matter:/);
  assert.match(html, /Long-term preservation goal:/);
  assert.match(html, /Donor ageing and hair-to-graft ratio/);
  assert.match(html, /donor hairs become finer.*donor density.*reduce/i);
  assert.match(html, /hair-to-graft ratio/);
  assert.match(html, /5000 grafts or more/);
  assert.match(html, /limited long-term reserve/);
  assert.match(html, /Saving hair today may protect your donor tomorrow\./);
  assert.match(html, /qualified clinician/);
  assert.match(html, /What to Monitor Over Time/);
  assert.match(html, /0–3 months/);
});

test("non-patient mode does not use patient narrative template headings", () => {
  const html = renderEliteReportHtml(makeEliteVm("doctor"));
  assert.doesNotMatch(html, /Plain-English meaning/);
  assert.doesNotMatch(html, /Why this matters for your result/);
  assert.doesNotMatch(html, /Protecting Native Hair and Future Donor Options/);
  assert.doesNotMatch(html, /DHT inhibitors \/ DHT management/);
  assert.doesNotMatch(html, /Donor ageing and hair-to-graft ratio/);
  assert.doesNotMatch(html, /What to Monitor Over Time/);
  assert.match(html, /Why It Matters/);
  assert.match(html, /Donor management patterns may influence long-term donor preservation and visual uniformity\./);
});

test("patient rendering includes calm limited-evidence wording", () => {
  const vm = makeEliteVm("patient");
  vm.areaDomains = [{ title: "Direction and Angle Coherence", score: 20, outOf5: 1, level: "Low" }];
  vm.metrics.implantationDensity = "Insufficient evidence";
  const html = renderEliteReportHtml(vm);
  assert.match(html, /Limited evidence: this section cannot be interpreted reliably yet\. Limited evidence is not the same as a poor result\./);
});
