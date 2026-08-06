/**
 * Run: npx tsx --test tests/patientPhotoReadinessPolicy.test.ts
 *
 * HA-PHOTO-TIMELINE-2A: `allowed` is driven by evidence timeline readiness.
 * Legacy viaBaseline / viaAlternateOutcome remain telemetry only.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePatientPhotoSubmitGate,
  patientRowsSatisfyAlternateMilestoneOutcome,
  patientRowsSatisfyExactKeys,
  readMonthsSinceFromPatientAnswers,
} from "@/lib/patientPhoto/patientPhotoReadinessPolicy";

const legacyCurrentRows = [
  { type: "patient_photo:patient_current_front" },
  { type: "patient_photo:patient_current_top" },
  { type: "patient_photo:patient_current_donor_rear" },
];

const baselinePreopRows = [
  { type: "patient_photo:preop_front" },
  { type: "patient_photo:preop_top" },
  { type: "patient_photo:preop_donor_rear" },
];

const month3OutcomeDonorRows = [
  { type: "patient_photo:postop_month3_front" },
  { type: "patient_photo:postop_month3_top" },
  { type: "patient_photo:postop_month3_donor" },
];

const month3OutcomeCrownRows = [
  { type: "patient_photo:postop_month3_front" },
  { type: "patient_photo:postop_month3_top" },
  { type: "patient_photo:postop_month3_crown" },
];

const month6OutcomeDonorRows = [
  { type: "patient_photo:postop_month6_front" },
  { type: "patient_photo:postop_month6_top" },
  { type: "patient_photo:postop_month6_donor" },
];

const month9OutcomeCrownRows = [
  { type: "patient_photo:postop_month9_front" },
  { type: "patient_photo:postop_month9_top" },
  { type: "patient_photo:postop_month9_crown" },
];

test("evaluatePatientPhotoSubmitGate: outcome-only without baseline is not_ready", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: month3OutcomeDonorRows,
    patientAnswers: { months_since: "3_6" },
    stageAwareSubmitEnabled: false,
    patientReviewPathway: "post_surgery",
  });
  assert.equal(r.allowed, false);
  assert.equal(r.viaEvidenceTimeline, false);
  assert.equal(r.viaBaseline, false);
  assert.equal(r.viaAlternateOutcome, false);
});

test("evaluatePatientPhotoSubmitGate: legacy patient_current set allows with limitations", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: legacyCurrentRows,
    patientAnswers: { months_since: "6_9" },
    stageAwareSubmitEnabled: false,
    patientReviewPathway: "post_surgery",
  });
  assert.equal(r.allowed, true);
  assert.equal(r.viaEvidenceTimeline, true);
  assert.equal(r.evidenceTimeline?.readiness, "ready_with_limitations");
});

test("evaluatePatientPhotoSubmitGate: under_3 telemetry does not open alternate keys", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: month3OutcomeDonorRows,
    patientAnswers: { months_since: "under_3" },
    stageAwareSubmitEnabled: true,
    patientReviewPathway: "post_surgery",
  });
  assert.equal(r.allowed, false);
  assert.equal(r.alternateKeysRequired, null);
  assert.equal(r.alternateSupportingOneOf, null);
  assert.equal(r.stageAwareEvaluated, false);
});

test("evaluatePatientPhotoSubmitGate: baseline + month_6 ready without patient_current", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: [...baselinePreopRows, ...month6OutcomeDonorRows],
    patientAnswers: { months_since: "6_9", procedure_date: "2024-01-01" },
    stageAwareSubmitEnabled: false,
    patientReviewPathway: "post_surgery",
  });
  assert.equal(r.allowed, true);
  assert.equal(r.viaEvidenceTimeline, true);
  assert.equal(r.evidenceTimeline?.readiness, "ready");
  assert.equal(r.evidenceTimeline?.latestFollowUpSession?.milestone, "month_6");
});

test("evaluatePatientPhotoSubmitGate: baseline + month_3 ready_with_limitations", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: [...baselinePreopRows, ...month3OutcomeDonorRows],
    patientAnswers: { months_since: "3_6", procedure_date: "2024-01-01" },
    stageAwareSubmitEnabled: true,
    patientReviewPathway: "post_surgery",
  });
  assert.equal(r.allowed, true);
  assert.equal(r.evidenceTimeline?.readiness, "ready_with_limitations");
  assert.ok(r.limitations.some((l) => l.code === "early_outcome_follow_up"));
});

test("evaluatePatientPhotoSubmitGate: alternate telemetry still tracks milestone keys", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: month3OutcomeDonorRows,
    patientAnswers: { months_since: "3_6" },
    stageAwareSubmitEnabled: true,
    patientReviewPathway: "post_surgery",
  });
  assert.equal(r.viaAlternateOutcome, true);
  assert.equal(r.allowed, false); // missing baseline session
  assert.ok(r.alternateKeysRequired?.includes("postop_month3_front"));
  assert.ok(r.alternateSupportingOneOf?.includes("postop_month3_donor"));
});

test("evaluatePatientPhotoSubmitGate: crown third slot telemetry", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: month3OutcomeCrownRows,
    patientAnswers: { months_since: "3_6" },
    stageAwareSubmitEnabled: true,
    patientReviewPathway: "post_surgery",
  });
  assert.equal(r.viaAlternateOutcome, true);
  assert.equal(r.allowed, false);
});

test("evaluatePatientPhotoSubmitGate: flag on + 9_12 crown telemetry", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: month9OutcomeCrownRows,
    patientAnswers: { months_since: "9_12" },
    stageAwareSubmitEnabled: true,
    patientReviewPathway: "post_surgery",
  });
  assert.equal(r.viaAlternateOutcome, true);
  assert.equal(r.allowed, false);
});

test("evaluatePatientPhotoSubmitGate: incomplete alternate still blocks", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: [{ type: "patient_photo:postop_month9_crown" }],
    patientAnswers: { months_since: "9_12" },
    stageAwareSubmitEnabled: true,
    patientReviewPathway: "post_surgery",
  });
  assert.equal(r.allowed, false);
  assert.equal(r.viaAlternateOutcome, false);
});

test("evaluatePatientPhotoSubmitGate: audit_excluded patient rows ignored for gate", () => {
  const rows = [...legacyCurrentRows.map((u) => ({ ...u, metadata: { audit_excluded: true } }))];
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: rows,
    patientAnswers: null,
    stageAwareSubmitEnabled: false,
    patientReviewPathway: "post_surgery",
  });
  assert.equal(r.allowed, false);
  assert.equal(r.viaEvidenceTimeline, false);
});

test("evaluatePatientPhotoSubmitGate: pre_surgery baseline core allows", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: [
      ...baselinePreopRows,
      { type: "patient_photo:preop_left" },
      { type: "patient_photo:preop_right" },
    ],
    patientAnswers: null,
    stageAwareSubmitEnabled: false,
    patientReviewPathway: "pre_surgery",
  });
  assert.equal(r.allowed, true);
  assert.equal(r.evidenceTimeline?.readiness, "ready");
});

test("patientRowsSatisfyExactKeys is case-insensitive on type suffix", () => {
  assert.equal(
    patientRowsSatisfyExactKeys(
      [{ type: "patient_photo:POSTOP_MONTH3_FRONT" }, ...month3OutcomeDonorRows.slice(1)],
      ["postop_month3_front", "postop_month3_top", "postop_month3_donor"]
    ),
    true
  );
});

test("patientRowsSatisfyAlternateMilestoneOutcome: donor or crown, not both required", () => {
  assert.equal(patientRowsSatisfyAlternateMilestoneOutcome(month3OutcomeDonorRows, "3_6"), true);
  assert.equal(patientRowsSatisfyAlternateMilestoneOutcome(month3OutcomeCrownRows, "3_6"), true);
  assert.equal(
    patientRowsSatisfyAlternateMilestoneOutcome(
      [...month3OutcomeCrownRows, { type: "patient_photo:postop_month3_donor" }],
      "3_6"
    ),
    true
  );
});

test("readMonthsSinceFromPatientAnswers accepts known band", () => {
  assert.equal(readMonthsSinceFromPatientAnswers({ months_since: "6_9" }), "6_9");
  assert.equal(readMonthsSinceFromPatientAnswers({ months_since: "nope" }), null);
});
