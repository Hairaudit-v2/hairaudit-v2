/**
 * Stage 5 patient image evidence sufficiency (prompt annotations only).
 * Run: npx tsx --test tests/patientImageEvidenceConfidence.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { buildPatientImageEvidenceGroups } from "@/lib/audit/patientAiImageEvidence";
import {
  buildPatientImageEvidenceConfidence,
  formatPatientImageEvidenceConfidenceForPrompt,
} from "@/lib/audit/patientImageEvidenceConfidence";
import { canSubmit } from "@/lib/auditPhotoSchemas";

function groupsFor(uploads: { id: string; type: string }[]) {
  return buildPatientImageEvidenceGroups({ enabled: true, uploads });
}

test("disabled grouping → safe stub; overall limited", () => {
  const g = buildPatientImageEvidenceGroups({ enabled: false, uploads: [] });
  const c = buildPatientImageEvidenceConfidence(g);
  assert.equal(c.overall.summaryLevel, "limited");
  assert.equal(c.overall.hasExtendedEvidence, false);
  assert.equal(c.groups.baseline_evidence.level, "none");
});

test("no patient_photo uploads → all none, overall limited", () => {
  const g = groupsFor([]);
  const c = buildPatientImageEvidenceConfidence(g);
  assert.equal(c.overall.hasExtendedEvidence, false);
  assert.equal(c.overall.summaryLevel, "limited");
  for (const id of [
    "baseline_evidence",
    "donor_monitoring_evidence",
    "surgical_evidence",
    "graft_handling_evidence",
    "followup_outcome_evidence",
  ] as const) {
    assert.equal(c.groups[id].level, "none");
  }
});

test("baseline only: preop views → moderate/strong baseline; no extended flag", () => {
  const g = groupsFor([
    { id: "1", type: "patient_photo:preop_front" },
    { id: "2", type: "patient_photo:preop_top" },
    { id: "3", type: "patient_photo:preop_crown" },
  ]);
  const c = buildPatientImageEvidenceConfidence(g);
  assert.equal(c.groups.baseline_evidence.level, "moderate");
  assert.equal(c.overall.hasExtendedEvidence, false);
  assert.ok(["limited", "moderate"].includes(c.overall.summaryLevel));
});

test("donor monitoring: single phase vs multiple phases", () => {
  const onePhase = groupsFor([
    { id: "a", type: "patient_photo:postop_day1_donor" },
    { id: "b", type: "patient_photo:postop_week1_donor" },
  ]);
  const c1 = buildPatientImageEvidenceConfidence(onePhase);
  assert.equal(c1.groups.donor_monitoring_evidence.level, "limited");

  const multi = groupsFor([
    { id: "1", type: "patient_photo:preop_donor_rear" },
    { id: "2", type: "patient_photo:day0_donor" },
    { id: "3", type: "patient_photo:postop_month3_donor" },
  ]);
  const c2 = buildPatientImageEvidenceConfidence(multi);
  assert.equal(c2.groups.donor_monitoring_evidence.level, "strong");
});

test("graft: single category vs multiple handling categories", () => {
  const oneCat = groupsFor([
    { id: "g1", type: "patient_photo:graft_tray_closeup" },
    { id: "g2", type: "patient_photo:graft_tray_closeup" },
  ]);
  const c1 = buildPatientImageEvidenceConfidence(oneCat);
  assert.equal(c1.groups.graft_handling_evidence.level, "limited");

  const multi = groupsFor([
    { id: "a", type: "patient_photo:graft_tray_overview" },
    { id: "b", type: "patient_photo:graft_tray_closeup" },
    { id: "c", type: "patient_photo:graft_sorting" },
  ]);
  const c2 = buildPatientImageEvidenceConfidence(multi);
  assert.equal(c2.groups.graft_handling_evidence.level, "strong");
});

test("follow-up: one month marker vs longitudinal", () => {
  const oneMonth = groupsFor([
    { id: "1", type: "patient_photo:postop_month6_front" },
    { id: "2", type: "patient_photo:postop_month6_top" },
    { id: "3", type: "patient_photo:postop_month6_crown" },
  ]);
  const c1 = buildPatientImageEvidenceConfidence(oneMonth);
  assert.equal(c1.groups.followup_outcome_evidence.level, "limited");

  const longitudinal = groupsFor([
    { id: "1", type: "patient_photo:postop_month3_front" },
    { id: "2", type: "patient_photo:postop_month6_front" },
    { id: "3", type: "patient_photo:postop_month12_front" },
  ]);
  const c2 = buildPatientImageEvidenceConfidence(longitudinal);
  assert.equal(c2.groups.followup_outcome_evidence.level, "strong");
});

test("mixed rich evidence lifts overall summary", () => {
  const g = groupsFor([
    { id: "p1", type: "patient_photo:preop_front" },
    { id: "p2", type: "patient_photo:preop_left" },
    { id: "p3", type: "patient_photo:preop_right" },
    { id: "p4", type: "patient_photo:preop_top" },
    { id: "p5", type: "patient_photo:preop_crown" },
    { id: "p6", type: "patient_photo:preop_donor_rear" },
    { id: "d1", type: "patient_photo:day0_donor" },
    { id: "d2", type: "patient_photo:postop_month6_donor" },
    { id: "d3", type: "patient_photo:postop_month12_donor" },
    { id: "s1", type: "patient_photo:day0_recipient" },
    { id: "s2", type: "patient_photo:intraop_extraction" },
    { id: "s3", type: "patient_photo:intraop_recipient_sites" },
    { id: "s4", type: "patient_photo:intraop_implantation" },
    { id: "gr1", type: "patient_photo:graft_tray_overview" },
    { id: "gr2", type: "patient_photo:graft_tray_closeup" },
    { id: "gr3", type: "patient_photo:graft_hydration_solution" },
    { id: "f1", type: "patient_photo:postop_month3_front" },
    { id: "f2", type: "patient_photo:postop_month6_top" },
    { id: "f3", type: "patient_photo:postop_month12_crown" },
  ]);
  const c = buildPatientImageEvidenceConfidence(g);
  assert.equal(c.overall.summaryLevel, "strong");
  assert.equal(c.overall.hasExtendedEvidence, true);
});

test("canSubmit unchanged when confidence fixtures include extended uploads", () => {
  const base = [
    { type: "patient_photo:preop_front" },
    { type: "patient_photo:preop_top" },
    { type: "patient_photo:preop_donor_rear" },
  ];
  assert.equal(canSubmit("patient", base), true);
  const withExtended = [
    ...base,
    { type: "patient_photo:graft_tray_closeup" },
    { type: "patient_photo:postop_month6_front" },
  ];
  assert.equal(canSubmit("patient", withExtended), true);
});

test("formatPatientImageEvidenceConfidenceForPrompt mentions overall and omits none groups", () => {
  const g = groupsFor([{ id: "1", type: "patient_photo:preop_front" }]);
  const c = buildPatientImageEvidenceConfidence(g);
  const t = formatPatientImageEvidenceConfidenceForPrompt(c);
  assert.ok(t.includes("Overall evidence depth"));
  assert.ok(t.includes("Baseline evidence"));
  assert.ok(!t.includes("Graft handling evidence"));
});
