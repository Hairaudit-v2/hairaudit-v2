/**
 * Run: npx tsx --test tests/patientPhotoReadinessPolicy.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePatientPhotoSubmitGate,
  patientRowsSatisfyAlternateMilestoneOutcome,
  patientRowsSatisfyExactKeys,
  readMonthsSinceFromPatientAnswers,
} from "@/lib/patientPhoto/patientPhotoReadinessPolicy";

const baselineRows = [
  { type: "patient_photo:patient_current_front" },
  { type: "patient_photo:patient_current_top" },
  { type: "patient_photo:patient_current_donor_rear" },
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

const month9OutcomeCrownRows = [
  { type: "patient_photo:postop_month9_front" },
  { type: "patient_photo:postop_month9_top" },
  { type: "patient_photo:postop_month9_crown" },
];

test("evaluatePatientPhotoSubmitGate: flag off uses baseline only (alternate set alone blocks)", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: month3OutcomeDonorRows,
    patientAnswers: { months_since: "3_6" },
    stageAwareSubmitEnabled: false,
  });
  assert.equal(r.allowed, false);
  assert.equal(r.viaBaseline, false);
  assert.equal(r.viaAlternateOutcome, false);
  assert.equal(r.stageAwareEvaluated, false);
});

test("evaluatePatientPhotoSubmitGate: baseline satisfied when flag off", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: baselineRows,
    patientAnswers: null,
    stageAwareSubmitEnabled: false,
  });
  assert.equal(r.allowed, true);
  assert.equal(r.viaBaseline, true);
  assert.equal(r.viaAlternateOutcome, false);
});

test("evaluatePatientPhotoSubmitGate: under_3 never opens alternate path", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: month3OutcomeDonorRows,
    patientAnswers: { months_since: "under_3" },
    stageAwareSubmitEnabled: true,
  });
  assert.equal(r.allowed, false);
  assert.equal(r.alternateKeysRequired, null);
  assert.equal(r.alternateSupportingOneOf, null);
  assert.equal(r.stageAwareEvaluated, false);
});

test("evaluatePatientPhotoSubmitGate: flag on + 3_6 + donor third slot allows without baseline", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: month3OutcomeDonorRows,
    patientAnswers: { months_since: "3_6" },
    stageAwareSubmitEnabled: true,
  });
  assert.equal(r.allowed, true);
  assert.equal(r.viaBaseline, false);
  assert.equal(r.viaAlternateOutcome, true);
  assert.ok(r.alternateKeysRequired?.includes("postop_month3_front"));
  assert.ok(r.alternateSupportingOneOf?.includes("postop_month3_donor"));
  assert.ok(r.alternateSupportingOneOf?.includes("postop_month3_crown"));
});

test("evaluatePatientPhotoSubmitGate: flag on + 3_6 + crown third slot allows without baseline", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: month3OutcomeCrownRows,
    patientAnswers: { months_since: "3_6" },
    stageAwareSubmitEnabled: true,
  });
  assert.equal(r.allowed, true);
  assert.equal(r.viaAlternateOutcome, true);
});

test("evaluatePatientPhotoSubmitGate: flag on + 9_12 + crown third slot allows (UI-aligned)", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: month9OutcomeCrownRows,
    patientAnswers: { months_since: "9_12" },
    stageAwareSubmitEnabled: true,
  });
  assert.equal(r.allowed, true);
  assert.equal(r.viaAlternateOutcome, true);
});

test("evaluatePatientPhotoSubmitGate: alternate path still needs front and top", () => {
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: [{ type: "patient_photo:postop_month9_crown" }],
    patientAnswers: { months_since: "9_12" },
    stageAwareSubmitEnabled: true,
  });
  assert.equal(r.allowed, false);
  assert.equal(r.viaAlternateOutcome, false);
});

test("evaluatePatientPhotoSubmitGate: audit_excluded patient rows ignored for gate", () => {
  const rows = [
    ...baselineRows.map((u) => ({ ...u, metadata: { audit_excluded: true } })),
  ];
  const r = evaluatePatientPhotoSubmitGate({
    uploadRows: rows,
    patientAnswers: null,
    stageAwareSubmitEnabled: false,
  });
  assert.equal(r.allowed, false);
  assert.equal(r.viaBaseline, false);
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
  assert.equal(
    patientRowsSatisfyAlternateMilestoneOutcome(month3OutcomeDonorRows, "3_6"),
    true
  );
  assert.equal(
    patientRowsSatisfyAlternateMilestoneOutcome(month3OutcomeCrownRows, "3_6"),
    true
  );
  assert.equal(
    patientRowsSatisfyAlternateMilestoneOutcome(
      [
        ...month3OutcomeCrownRows,
        { type: "patient_photo:postop_month3_donor" },
      ],
      "3_6"
    ),
    true
  );
});

test("readMonthsSinceFromPatientAnswers accepts known band", () => {
  assert.equal(readMonthsSinceFromPatientAnswers({ months_since: "6_9" }), "6_9");
  assert.equal(readMonthsSinceFromPatientAnswers({ months_since: "nope" }), null);
});
