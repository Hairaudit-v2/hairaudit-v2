/**
 * HA-DONOR-HEALING-1E — measurement gate, patient qualitative-only output,
 * forbidden language, and snapshot immutability.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES } from "../src/lib/patient/donorHealingEntry";
import {
  DONOR_CAPACITY_PLAN_LABELS,
  DONOR_CAPACITY_PLAN_STATES,
  buildAutomatedDonorCapacityPlan,
  collectDonorCapacityMeasurements,
  confirmDonorCapacityPlan,
  correctDonorCapacityPlan,
  evaluateDonorCapacitySufficiency,
  mapDonorCapacityPlanState,
  patientFacingDonorCapacityContainsForbiddenLanguage,
  patientFacingDonorCapacityContainsGraftNumbers,
  resolveDonorCapacityPlanForReport,
  toPatientSafeDonorCapacityPlanSlice,
  upsertDonorCapacityMeasurements,
  type DonorCapacityPlanRecord,
} from "../src/lib/patient/donorCapacityPlan";

const ENTRY = {
  answers: {
    entry_context: "donor_healing",
    primary_donor_concern: "future_donor_capacity",
  },
  summary: { entry_context: "donor_healing" },
};

describe("HA-DONOR-HEALING-1E — enums", () => {
  it("exposes five qualitative planning states", () => {
    assert.strictEqual(DONOR_CAPACITY_PLAN_STATES.length, 5);
    for (const s of DONOR_CAPACITY_PLAN_STATES) {
      assert.ok(DONOR_CAPACITY_PLAN_LABELS[s].length > 0);
    }
  });
});

describe("HA-DONOR-HEALING-1E — measurement gate", () => {
  it("treats patient self-report alone as insufficient", () => {
    const { measurements, patientHints } = collectDonorCapacityMeasurements({
      ...ENTRY,
      answers: {
        ...ENTRY.answers,
        donor_graft_number_reported: "3500",
        donor_punch_size_known: "0.9 mm",
      },
    });
    assert.ok(patientHints.graftNumberReported);
    assert.ok(patientHints.punchSizeKnown);
    const sufficiency = evaluateDonorCapacitySufficiency(measurements);
    assert.strictEqual(sufficiency.sufficient, false);
    assert.strictEqual(
      mapDonorCapacityPlanState({ sufficiency, measurements, patientHints }),
      "insufficient_clinical_measurements"
    );
  });

  it("requires at least two qualifying clinical measurements", () => {
    const record = buildAutomatedDonorCapacityPlan({
      ...ENTRY,
      doctorAnswers: {
        donor_density_per_cm2: 70,
        actual_graft_count: 3200,
        punch_size_mm: 0.9,
      },
    });
    assert.ok(record);
    assert.ok(record!.sufficiency.sufficient);
    assert.ok(record!.sufficiency.qualifyingCount >= 2);
    assert.notStrictEqual(
      record!.overallState,
      "insufficient_clinical_measurements"
    );
  });

  it("does not count a single clinical field as sufficient", () => {
    const record = buildAutomatedDonorCapacityPlan({
      ...ENTRY,
      doctorAnswers: { donor_density_per_cm2: 70 },
    });
    assert.ok(record);
    assert.strictEqual(record!.sufficiency.sufficient, false);
    assert.strictEqual(record!.overallState, "insufficient_clinical_measurements");
  });
});

describe("HA-DONOR-HEALING-1E — clinician gate & snapshots", () => {
  function draftSufficient(): DonorCapacityPlanRecord {
    const record = buildAutomatedDonorCapacityPlan({
      ...ENTRY,
      clinicAnswers: {
        donor_density_per_cm2: 60,
        actual_graft_count: 2800,
        estimated_donor_capacity: "moderate",
      },
    });
    assert.ok(record);
    return record!;
  }

  it("hides patient slice until clinician confirmation", () => {
    const draft = draftSufficient();
    assert.strictEqual(toPatientSafeDonorCapacityPlanSlice(draft), null);

    const confirmed = confirmDonorCapacityPlan(draft, {
      actorUserId: "auditor-1",
      at: "2026-07-30T00:00:00.000Z",
    });
    const slice = toPatientSafeDonorCapacityPlanSlice(confirmed);
    assert.ok(slice);
    assert.strictEqual(slice!.provenanceSource, "clinician_confirmation");
    assert.ok(!("measurements" in slice!));
    assert.ok(!("clinicianInternalNote" in slice!));
    assert.ok(!patientFacingDonorCapacityContainsForbiddenLanguage(slice!));
    assert.ok(!patientFacingDonorCapacityContainsGraftNumbers(slice!));
  });

  it("appends immutable snapshots on confirm and correct", () => {
    const draft = draftSufficient();
    const confirmed = confirmDonorCapacityPlan(draft, {
      actorUserId: "auditor-1",
      at: "2026-07-30T00:00:00.000Z",
    });
    assert.strictEqual(confirmed.snapshots.length, 1);
    const first = confirmed.snapshots[0]!;

    const corrected = correctDonorCapacityPlan(confirmed, {
      nextState: "further_measurement_recommended",
      actorUserId: "auditor-1",
      at: "2026-07-30T01:00:00.000Z",
    });
    assert.strictEqual(corrected.snapshots.length, 2);
    assert.deepStrictEqual(corrected.snapshots[0], first);
    assert.strictEqual(corrected.overallState, "further_measurement_recommended");
  });

  it("keeps clinician-reviewed records immutable on resolve", () => {
    const confirmed = confirmDonorCapacityPlan(draftSufficient(), {
      actorUserId: "auditor-1",
      at: "2026-07-30T00:00:00.000Z",
    });
    const resolved = resolveDonorCapacityPlanForReport({
      ...ENTRY,
      doctorAnswers: {},
      stored: confirmed,
    });
    assert.strictEqual(resolved?.overallState, confirmed.overallState);
    assert.strictEqual(resolved?.snapshots.length, confirmed.snapshots.length);
  });

  it("marks auditor-entered fields as auditor_entry source", () => {
    const draft = buildAutomatedDonorCapacityPlan(ENTRY)!;
    const updated = upsertDonorCapacityMeasurements(draft, {
      densityCm2: 55,
      graftsRemoved: 3000,
    });
    assert.strictEqual(updated.measurements.densityCm2?.source, "auditor_entry");
    assert.strictEqual(updated.measurements.graftsRemoved?.source, "auditor_entry");
    assert.ok(updated.sufficiency.sufficient);
  });
});

describe("HA-DONOR-HEALING-1E — forbidden language & no graft numbers", () => {
  it("patient labels never contain forbidden diagnostic phrases", () => {
    for (const state of DONOR_CAPACITY_PLAN_STATES) {
      const label = DONOR_CAPACITY_PLAN_LABELS[state].toLowerCase();
      for (const phrase of FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES) {
        assert.ok(!label.includes(phrase), `${state} contains "${phrase}"`);
      }
      assert.ok(!/\b\d{3,5}\s*grafts?\b/i.test(label));
    }
  });
});
