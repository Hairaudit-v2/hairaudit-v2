/**
 * HA-DONOR-HEALING-1D — zone taxonomy, geometry, clinician gate,
 * forbidden language, and snapshot immutability.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES } from "../src/lib/patient/donorHealingEntry";
import {
  DONOR_ZONE_IDS,
  DONOR_ZONE_INTENSITIES,
  DONOR_ZONE_INTENSITY_LABELS,
  DONOR_ZONE_LABELS,
  buildAutomatedDonorZoneAnnotation,
  buildDonorZoneHeatmapSummaries,
  confirmDonorZoneAnnotation,
  correctDonorZoneAnnotation,
  createDonorZoneAnnotationItem,
  deleteDonorZoneAnnotation,
  patientFacingDonorZoneContainsForbiddenLanguage,
  resolveDonorZoneAnnotationForReport,
  toPatientSafeDonorZoneAnnotationSlice,
  upsertDonorZoneAnnotation,
  type DonorZoneAnnotationRecord,
} from "../src/lib/patient/donorZoneAnnotation";

const ENTRY = {
  answers: {
    entry_context: "donor_healing",
    primary_donor_concern: "donor_healing",
  },
  summary: { entry_context: "donor_healing" },
};

describe("HA-DONOR-HEALING-1D — enums", () => {
  it("exposes fixed zone taxonomy and intensity bands", () => {
    assert.strictEqual(DONOR_ZONE_IDS.length, 7);
    assert.strictEqual(DONOR_ZONE_INTENSITIES.length, 5);
    for (const z of DONOR_ZONE_IDS) {
      assert.ok(DONOR_ZONE_LABELS[z].length > 0);
    }
    for (const i of DONOR_ZONE_INTENSITIES) {
      assert.ok(DONOR_ZONE_INTENSITY_LABELS[i].length > 0);
    }
  });
});

describe("HA-DONOR-HEALING-1D — geometry & rollup", () => {
  it("creates a validated polygon annotation for rear donor view", () => {
    const item = createDonorZoneAnnotationItem({
      uploadId: "up1",
      categoryKey: "patient_photo:preop_donor_rear",
      zoneId: "occipital",
      intensity: "mild_visible_irregularity",
      coordinates: [
        { x: 0.2, y: 0.2 },
        { x: 0.5, y: 0.2 },
        { x: 0.4, y: 0.5 },
      ],
    });
    assert.strictEqual(item.view, "rear");
    assert.strictEqual(item.zoneId, "occipital");
    assert.strictEqual(item.coordinates.length, 3);
  });

  it("rejects custom zone without a note", () => {
    assert.throws(() =>
      createDonorZoneAnnotationItem({
        uploadId: "up1",
        categoryKey: "preop_donor_rear",
        zoneId: "custom",
        intensity: "moderate_visible_irregularity",
        coordinates: [
          { x: 0.1, y: 0.1 },
          { x: 0.2, y: 0.1 },
          { x: 0.2, y: 0.2 },
        ],
      })
    );
  });

  it("rolls up strongest intensity per view/zone", () => {
    const a = createDonorZoneAnnotationItem({
      id: "a1",
      uploadId: "up1",
      categoryKey: "preop_donor_rear",
      zoneId: "occipital",
      intensity: "mild_visible_irregularity",
      coordinates: [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.1 },
        { x: 0.2, y: 0.2 },
      ],
    });
    const b = createDonorZoneAnnotationItem({
      id: "a2",
      uploadId: "up1",
      categoryKey: "preop_donor_rear",
      zoneId: "occipital",
      intensity: "marked_visible_irregularity",
      coordinates: [
        { x: 0.3, y: 0.3 },
        { x: 0.4, y: 0.3 },
        { x: 0.4, y: 0.4 },
      ],
    });
    const summaries = buildDonorZoneHeatmapSummaries([a, b]);
    assert.strictEqual(summaries.length, 1);
    assert.strictEqual(summaries[0]!.intensity, "marked_visible_irregularity");
    assert.strictEqual(summaries[0]!.annotationCount, 2);
  });
});

describe("HA-DONOR-HEALING-1D — clinician gate & snapshots", () => {
  function draftWithAnnotation(): DonorZoneAnnotationRecord {
    const shell = buildAutomatedDonorZoneAnnotation(ENTRY);
    assert.ok(shell);
    const item = createDonorZoneAnnotationItem({
      uploadId: "up1",
      categoryKey: "preop_donor_rear",
      zoneId: "parietal_left",
      intensity: "moderate_visible_irregularity",
      coordinates: [
        { x: 0.1, y: 0.1 },
        { x: 0.3, y: 0.1 },
        { x: 0.2, y: 0.3 },
      ],
    });
    return upsertDonorZoneAnnotation(shell!, item);
  }

  it("hides patient slice until clinician confirmation", () => {
    const draft = draftWithAnnotation();
    assert.strictEqual(toPatientSafeDonorZoneAnnotationSlice(draft), null);

    const confirmed = confirmDonorZoneAnnotation(draft, {
      actorUserId: "auditor-1",
      at: "2026-07-30T00:00:00.000Z",
    });
    const slice = toPatientSafeDonorZoneAnnotationSlice(confirmed);
    assert.ok(slice);
    assert.strictEqual(slice!.provenanceSource, "clinician_confirmation");
    assert.ok(slice!.schematic.length >= 1);
    assert.ok(!patientFacingDonorZoneContainsForbiddenLanguage(slice!));
  });

  it("appends immutable snapshots on confirm and correct", () => {
    const draft = draftWithAnnotation();
    assert.strictEqual(draft.snapshots.length, 0);

    const confirmed = confirmDonorZoneAnnotation(draft, {
      actorUserId: "auditor-1",
      at: "2026-07-30T00:00:00.000Z",
    });
    assert.strictEqual(confirmed.snapshots.length, 1);
    const first = confirmed.snapshots[0]!;

    const without = deleteDonorZoneAnnotation(
      confirmed,
      confirmed.annotations[0]!.id
    );
    const corrected = correctDonorZoneAnnotation(without, {
      actorUserId: "auditor-1",
      at: "2026-07-30T01:00:00.000Z",
    });
    assert.strictEqual(corrected.snapshots.length, 2);
    assert.deepStrictEqual(corrected.snapshots[0], first);
    assert.strictEqual(corrected.provenance.source, "clinician_correction");
  });

  it("keeps clinician-reviewed records immutable on resolve", () => {
    const confirmed = confirmDonorZoneAnnotation(draftWithAnnotation(), {
      actorUserId: "auditor-1",
      at: "2026-07-30T00:00:00.000Z",
    });
    const resolved = resolveDonorZoneAnnotationForReport({
      ...ENTRY,
      stored: confirmed,
    });
    assert.strictEqual(resolved?.snapshots.length, confirmed.snapshots.length);
    assert.strictEqual(resolved?.annotations.length, confirmed.annotations.length);
  });
});

describe("HA-DONOR-HEALING-1D — forbidden language", () => {
  it("patient intensity labels never contain forbidden diagnostic phrases", () => {
    for (const intensity of DONOR_ZONE_INTENSITIES) {
      const label = DONOR_ZONE_INTENSITY_LABELS[intensity].toLowerCase();
      for (const phrase of FORBIDDEN_DONOR_DIAGNOSTIC_PHRASES) {
        assert.ok(!label.includes(phrase), `${intensity} contains "${phrase}"`);
      }
    }
  });

  it("caveat avoids forbidden diagnostic certainty phrasing", () => {
    const confirmed = confirmDonorZoneAnnotation(
      (() => {
        const shell = buildAutomatedDonorZoneAnnotation(ENTRY)!;
        return upsertDonorZoneAnnotation(
          shell,
          createDonorZoneAnnotationItem({
            uploadId: "up1",
            categoryKey: "preop_donor_rear",
            zoneId: "occipital",
            intensity: "broadly_even_appearance",
            coordinates: [
              { x: 0.2, y: 0.2 },
              { x: 0.5, y: 0.2 },
              { x: 0.4, y: 0.5 },
            ],
          })
        );
      })(),
      { actorUserId: "a1", at: "2026-07-30T00:00:00.000Z" }
    );
    const slice = toPatientSafeDonorZoneAnnotationSlice(confirmed)!;
    assert.ok(!patientFacingDonorZoneContainsForbiddenLanguage(slice));
    assert.match(slice.caveat.toLowerCase(), /not density measurements/i);
  });
});
