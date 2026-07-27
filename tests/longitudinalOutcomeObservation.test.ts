/**
 * HA-PROJECTION-1E — Longitudinal outcome observation builder + confidence.
 * Run: pnpm exec tsx --test tests/longitudinalOutcomeObservation.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assessLongitudinalEvidence,
} from "@/lib/projection/longitudinalEvidence";
import {
  deriveObservationConfidence,
  extractLongitudinalObservationConfidenceFactors,
} from "@/lib/projection/longitudinalObservationConfidence";
import { buildLongitudinalOutcomeObservation } from "@/lib/projection/longitudinalOutcomeObservation";
import { findUnsafeLongitudinalObservationClaims } from "@/lib/projection/longitudinalObservationSafety";
import type { ProjectionUploadInput } from "@/lib/projection/types";

const PROJECTION_ID = "proj-1111-1111-1111-111111111111";
const CASE_ID = "case-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PATIENT_ID = "pat-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PROCEDURE = "2025-01-15T00:00:00.000Z";

function month6Uploads(views: string[]): ProjectionUploadInput[] {
  return views.map((view, i) => ({
    id: `u${i}`,
    type: `patient_photo:postop_month6_${view}`,
    captured_at: "2025-07-20T00:00:00.000Z",
  }));
}

describe("HA-PROJECTION-1E observations", () => {
  it("18. frontal appearance generated", () => {
    const built = buildLongitudinalOutcomeObservation({
      projectionSnapshotId: PROJECTION_ID,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      stage: "month_6",
      observedAt: "2025-07-20T00:00:00.000Z",
      uploads: month6Uploads(["front"]),
      caseContext: { procedureDate: PROCEDURE, treatedAreas: ["frontal", "hairline"] },
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.ok(built.observation.recipient.frontalAppearance);
    assert.match(
      built.observation.recipient.frontalAppearance!.observation,
      /visible|developing|frontal/i
    );
  });

  it("19. density remains qualitative without measured source", () => {
    const built = buildLongitudinalOutcomeObservation({
      projectionSnapshotId: PROJECTION_ID,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      stage: "month_6",
      observedAt: "2025-07-20T00:00:00.000Z",
      uploads: month6Uploads(["front", "top"]),
      caseContext: { procedureDate: PROCEDURE },
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const density = built.observation.recipient.densityAppearance;
    assert.ok(density);
    assert.doesNotMatch(density!.observation, /\d+\s*%/);
    assert.doesNotMatch(density!.observation, /grafts?\s*per\s*cm/i);
  });

  it("20. donor visible scarring may be observed at appropriate stage", () => {
    const built = buildLongitudinalOutcomeObservation({
      projectionSnapshotId: PROJECTION_ID,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      stage: "month_12",
      observedAt: "2026-01-20T00:00:00.000Z",
      uploads: [
        {
          id: "f",
          type: "patient_photo:postop_month12_front",
          captured_at: "2026-01-20T00:00:00.000Z",
        },
        {
          id: "d",
          type: "patient_photo:postop_month12_donor",
          captured_at: "2026-01-20T00:00:00.000Z",
        },
      ],
      caseContext: { procedureDate: PROCEDURE },
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.ok(built.observation.donor);
    assert.ok(built.observation.donor!.visibleScarring);
  });

  it("21. early-stage donor image does not create permanent damage claim", () => {
    const built = buildLongitudinalOutcomeObservation({
      projectionSnapshotId: PROJECTION_ID,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      stage: "month_3",
      observedAt: "2025-04-15T00:00:00.000Z",
      uploads: [
        {
          id: "f",
          type: "patient_photo:postop_month3_front",
          captured_at: "2025-04-15T00:00:00.000Z",
        },
        {
          id: "d",
          type: "patient_photo:postop_month3_donor",
          captured_at: "2025-04-15T00:00:00.000Z",
        },
      ],
      caseContext: { procedureDate: PROCEDURE },
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const scar = built.observation.donor?.visibleScarring?.observation ?? "";
    assert.doesNotMatch(scar, /permanent damage/i);
    assert.match(scar, /cannot yet be determined|visible/i);
  });

  it("22. native-hair observation remains descriptive", () => {
    const built = buildLongitudinalOutcomeObservation({
      projectionSnapshotId: PROJECTION_ID,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      stage: "month_6",
      observedAt: "2025-07-20T00:00:00.000Z",
      uploads: month6Uploads(["front", "top"]),
      caseContext: { procedureDate: PROCEDURE },
      baselineAvailable: true,
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const native = built.observation.nativeHair.visibleNativeHairStatus;
    assert.ok(native);
    assert.doesNotMatch(native!.observation, /prescribe|medication|diagnose/i);
    assert.match(native!.observation, /visible|observed|recorded/i);
  });

  it("rejects evaluative structured observation input", () => {
    const built = buildLongitudinalOutcomeObservation({
      projectionSnapshotId: PROJECTION_ID,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      stage: "month_6",
      observedAt: "2025-07-20T00:00:00.000Z",
      uploads: month6Uploads(["front"]),
      caseContext: { procedureDate: PROCEDURE },
      structuredObservations: [
        {
          key: "frontal_appearance",
          label: "Frontal",
          observation: "This is a successful transplant and better than projected",
        },
      ],
    });
    // Builder drops unsafe structured feature; overall must still be safe
    if (built.ok) {
      const texts = [
        built.observation.recipient.frontalAppearance?.observation,
        ...built.observation.limitations,
      ];
      for (const t of texts) {
        if (!t) continue;
        assert.equal(findUnsafeLongitudinalObservationClaims(t).length, 0);
      }
    } else {
      assert.ok(built.reason);
    }
  });

  it("month 3 uses early-stage wording not failure language", () => {
    const built = buildLongitudinalOutcomeObservation({
      projectionSnapshotId: PROJECTION_ID,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      stage: "month_3",
      observedAt: "2025-04-15T00:00:00.000Z",
      uploads: [
        {
          type: "patient_photo:postop_month3_front",
          captured_at: "2025-04-15T00:00:00.000Z",
        },
      ],
      caseContext: { procedureDate: PROCEDURE },
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const frontal = built.observation.recipient.frontalAppearance!.observation;
    assert.match(frontal, /early/i);
    assert.doesNotMatch(frontal, /below expected|poor outcome|failed/i);
  });

  it("does not require crown when crown untreated", () => {
    const built = buildLongitudinalOutcomeObservation({
      projectionSnapshotId: PROJECTION_ID,
      caseId: CASE_ID,
      patientId: PATIENT_ID,
      stage: "month_6",
      observedAt: "2025-07-20T00:00:00.000Z",
      uploads: month6Uploads(["front", "top", "donor"]),
      caseContext: {
        procedureDate: PROCEDURE,
        treatedAreas: ["hairline", "frontal"],
      },
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(
      built.observation.limitations.some((l) => /crown.*missing/i.test(l)),
      false
    );
  });
});

describe("HA-PROJECTION-1E confidence", () => {
  it("29. full standardized views can reach high observation confidence", () => {
    const assessment = assessLongitudinalEvidence({
      stage: "month_6",
      presentRoles: [
        "followup_front",
        "followup_top",
        "followup_left",
        "followup_right",
        "followup_recipient_closeup",
        "followup_donor_rear",
        "followup_donor_closeup",
      ],
      treatedAreas: ["frontal"],
      stageConfidence: "high",
    });
    const factors = extractLongitudinalObservationConfidenceFactors({
      assessment,
      stageProvenance: "high",
      imageQuality: "high",
      baselineAvailable: true,
    });
    assert.equal(deriveObservationConfidence(factors), "high");
  });

  it("30. single front image remains low/moderate", () => {
    const assessment = assessLongitudinalEvidence({
      stage: "month_6",
      presentRoles: ["followup_front"],
      treatedAreas: ["frontal"],
      stageConfidence: "moderate",
    });
    const factors = extractLongitudinalObservationConfidenceFactors({
      assessment,
      stageProvenance: "moderate",
      imageQuality: "moderate",
    });
    const conf = deriveObservationConfidence(factors);
    assert.ok(conf === "low" || conf === "moderate");
    assert.notEqual(conf, "high");
  });

  it("31. uncertain timing lowers confidence", () => {
    const assessment = assessLongitudinalEvidence({
      stage: "month_6",
      presentRoles: ["followup_front", "followup_top", "followup_donor_rear"],
      stageConfidence: "low",
    });
    const factors = extractLongitudinalObservationConfidenceFactors({
      assessment,
      stageProvenance: "low",
      imageQuality: "high",
    });
    assert.equal(deriveObservationConfidence(factors), "low");
  });

  it("32. poor image quality lowers confidence", () => {
    const assessment = assessLongitudinalEvidence({
      stage: "month_6",
      presentRoles: [
        "followup_front",
        "followup_top",
        "followup_recipient_closeup",
        "followup_donor_rear",
      ],
      stageConfidence: "high",
    });
    const factors = extractLongitudinalObservationConfidenceFactors({
      assessment,
      stageProvenance: "high",
      imageQuality: "low",
    });
    assert.equal(deriveObservationConfidence(factors), "low");
  });
});
