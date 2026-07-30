/**
 * HA-DONOR-HEALING-1C — longitudinal comparison eligibility, pairing,
 * clinician gate, forbidden language, and snapshot immutability.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES } from "../src/lib/patient/donorHealingEntry";
import {
  DONOR_LONGITUDINAL_COMPARISON_LABELS,
  DONOR_LONGITUDINAL_COMPARISON_STATES,
  buildAutomatedDonorLongitudinalComparison,
  classifyDonorComparisonView,
  clusterDonorPhotoSets,
  confirmDonorLongitudinalComparison,
  correctDonorLongitudinalComparison,
  evaluateDonorComparability,
  mapDonorLongitudinalComparisonState,
  pairDonorViewsAcrossSets,
  patientFacingDonorComparisonContainsForbiddenLanguage,
  resolveDonorCategoryBand,
  resolveDonorLongitudinalComparisonForReport,
  toPatientSafeDonorLongitudinalSlice,
  type DonorLongitudinalComparisonRecord,
} from "../src/lib/patient/donorLongitudinalComparison";

const ENTRY = {
  answers: {
    entry_context: "donor_healing",
    primary_donor_concern: "donor_healing",
    donor_appearance_trend: "stable",
  },
  summary: { entry_context: "donor_healing" },
};

describe("HA-DONOR-HEALING-1C — view classification & banding", () => {
  it("classifies rear/left/right from category keys", () => {
    assert.strictEqual(classifyDonorComparisonView("preop_donor_rear"), "rear");
    assert.strictEqual(classifyDonorComparisonView("preop_donor_left"), "left");
    assert.strictEqual(classifyDonorComparisonView("preop_donor_right"), "right");
    assert.strictEqual(classifyDonorComparisonView("postop_month6_donor"), "rear");
    assert.strictEqual(classifyDonorComparisonView("patient_current_front"), null);
  });

  it("resolves chronological category bands", () => {
    assert.strictEqual(resolveDonorCategoryBand("preop_donor_rear"), "preop");
    assert.strictEqual(resolveDonorCategoryBand("postop_month3_donor"), "month3");
    assert.strictEqual(resolveDonorCategoryBand("postop_month12_donor"), "month12");
  });
});

describe("HA-DONOR-HEALING-1C — clustering & pairing", () => {
  it("clusters uploads into dated sets and pairs matching views", () => {
    const sets = clusterDonorPhotoSets([
      { id: "a", type: "patient_photo:preop_donor_rear" },
      { id: "b", type: "patient_photo:preop_donor_left" },
      { id: "c", type: "patient_photo:postop_month6_donor" },
      { id: "d", type: "patient_photo:day0_donor_left" },
    ]);
    assert.ok(sets.length >= 2);
    const pairs = pairDonorViewsAcrossSets(sets);
    assert.ok(pairs.some((p) => p.view === "rear") || pairs.some((p) => p.view === "left"));
    const rear = pairs.find((p) => p.view === "rear");
    if (rear) {
      assert.strictEqual(rear.baseline.uploadId, "a");
      assert.strictEqual(rear.compare.uploadId, "c");
    }
  });

  it("returns no pairs for a single dated set", () => {
    const sets = clusterDonorPhotoSets([
      { id: "a", type: "patient_photo:preop_donor_rear" },
      { id: "b", type: "patient_photo:preop_donor_left" },
    ]);
    assert.strictEqual(sets.length, 1);
    assert.strictEqual(pairDonorViewsAcrossSets(sets).length, 0);
  });
});

describe("HA-DONOR-HEALING-1C — eligibility & state mapping", () => {
  it("maps single-set evidence to insufficient_longitudinal_evidence", () => {
    const record = buildAutomatedDonorLongitudinalComparison({
      ...ENTRY,
      uploadTypes: [
        "patient_photo:preop_donor_rear",
        "patient_photo:preop_donor_left",
        "patient_photo:preop_donor_right",
      ],
    });
    assert.ok(record);
    assert.strictEqual(record!.overallState, "insufficient_longitudinal_evidence");
    assert.strictEqual(record!.comparability.scoreBand, "insufficient");
  });

  it("maps multi-set comparable evidence with improving trend", () => {
    const record = buildAutomatedDonorLongitudinalComparison({
      answers: { ...ENTRY.answers, donor_appearance_trend: "improving" },
      summary: ENTRY.summary,
      uploads: [
        { id: "1", type: "patient_photo:preop_donor_rear" },
        { id: "2", type: "patient_photo:preop_donor_left" },
        { id: "3", type: "patient_photo:postop_month6_donor" },
        { id: "4", type: "patient_photo:day0_donor_left" },
      ],
    });
    assert.ok(record);
    assert.strictEqual(record!.overallState, "improving_appearance");
    assert.ok(record!.pairs.length >= 1);
  });

  it("marks heavy limitations as not_comparable", () => {
    const sets = clusterDonorPhotoSets([
      { id: "1", type: "preop_donor_rear" },
      { id: "2", type: "postop_month6_donor" },
    ]);
    const pairs = pairDonorViewsAcrossSets(sets);
    const comparability = evaluateDonorComparability({
      sets,
      pairs,
      limitations: ["lighting", "hair_length", "angle"],
    });
    assert.strictEqual(comparability.scoreBand, "not_comparable");
    assert.strictEqual(
      mapDonorLongitudinalComparisonState({ comparability }),
      "not_comparable"
    );
  });

  it("exposes all six approved comparison states", () => {
    assert.strictEqual(DONOR_LONGITUDINAL_COMPARISON_STATES.length, 6);
    for (const state of DONOR_LONGITUDINAL_COMPARISON_STATES) {
      assert.ok(DONOR_LONGITUDINAL_COMPARISON_LABELS[state].length > 0);
    }
  });
});

describe("HA-DONOR-HEALING-1C — clinician gate & snapshots", () => {
  function draft(): DonorLongitudinalComparisonRecord {
    const record = buildAutomatedDonorLongitudinalComparison({
      ...ENTRY,
      uploads: [
        { id: "1", type: "patient_photo:preop_donor_rear" },
        { id: "2", type: "patient_photo:postop_month6_donor" },
      ],
    });
    assert.ok(record);
    return record!;
  }

  it("hides patient slice until clinician confirmation", () => {
    const automated = draft();
    assert.strictEqual(toPatientSafeDonorLongitudinalSlice(automated), null);

    const confirmed = confirmDonorLongitudinalComparison(automated, {
      actorUserId: "auditor-1",
      at: "2026-07-30T00:00:00.000Z",
    });
    const slice = toPatientSafeDonorLongitudinalSlice(confirmed);
    assert.ok(slice);
    assert.strictEqual(slice!.provenanceSource, "clinician_confirmation");
    assert.ok(!("confirmedByUserId" in slice!));
    assert.ok(!patientFacingDonorComparisonContainsForbiddenLanguage(slice!));
  });

  it("appends immutable snapshots on confirm and correct", () => {
    const automated = draft();
    assert.strictEqual(automated.snapshots.length, 0);

    const confirmed = confirmDonorLongitudinalComparison(automated, {
      actorUserId: "auditor-1",
      at: "2026-07-30T00:00:00.000Z",
    });
    assert.strictEqual(confirmed.snapshots.length, 1);
    const firstSnap = confirmed.snapshots[0]!;

    const corrected = correctDonorLongitudinalComparison(confirmed, {
      nextState: "persistent_irregularity",
      actorUserId: "auditor-1",
      at: "2026-07-30T01:00:00.000Z",
      limitations: ["lighting"],
    });
    assert.strictEqual(corrected.snapshots.length, 2);
    assert.deepStrictEqual(corrected.snapshots[0], firstSnap);
    assert.strictEqual(corrected.overallState, "persistent_irregularity");
    assert.strictEqual(corrected.provenance.source, "clinician_correction");
    assert.ok(
      corrected.provenance.history.some((h) => h.source === "clinician_confirmation")
    );
  });

  it("keeps clinician-reviewed records immutable on resolve", () => {
    const confirmed = confirmDonorLongitudinalComparison(draft(), {
      actorUserId: "auditor-1",
      at: "2026-07-30T00:00:00.000Z",
    });
    const resolved = resolveDonorLongitudinalComparisonForReport({
      ...ENTRY,
      // Different evidence — must not overwrite clinician-reviewed record
      uploadTypes: ["patient_photo:preop_donor_rear"],
      stored: confirmed,
    });
    assert.strictEqual(resolved?.overallState, confirmed.overallState);
    assert.strictEqual(resolved?.snapshots.length, confirmed.snapshots.length);
  });
});

describe("HA-DONOR-HEALING-1C — forbidden language", () => {
  it("extends forbidden diagnostic phrases for longitudinal safety", () => {
    const required = [
      "follicle death",
      "permanent depletion",
      "exact density loss",
      "confirmed overharvesting",
      "future safe graft capacity",
    ];
    for (const phrase of required) {
      assert.ok(
        (FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES as readonly string[]).includes(phrase),
        `missing forbidden phrase: ${phrase}`
      );
    }
  });

  it("patient labels never contain forbidden diagnostic phrases", () => {
    for (const state of DONOR_LONGITUDINAL_COMPARISON_STATES) {
      const label = DONOR_LONGITUDINAL_COMPARISON_LABELS[state].toLowerCase();
      for (const phrase of FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES) {
        assert.ok(!label.includes(phrase), `${state} label contains "${phrase}"`);
      }
    }
  });
});
