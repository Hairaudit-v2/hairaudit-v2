/**
 * HA-PROJECTION-1E — Longitudinal evidence role + stage provenance.
 * Run: pnpm exec tsx --test tests/longitudinalEvidence.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assessLongitudinalEvidence,
  isCrownRelevant,
  resolveLongitudinalEvidenceRole,
  resolveLongitudinalOutcomeStage,
} from "@/lib/projection/longitudinalEvidence";

const PROCEDURE = "2025-01-15T00:00:00.000Z";

describe("HA-PROJECTION-1E stage resolution", () => {
  it("1. true month3 evidence → month_3", () => {
    const stage = resolveLongitudinalOutcomeStage(
      {
        type: "patient_photo:postop_month3_front",
        captured_at: "2025-04-15T00:00:00.000Z",
      },
      { procedureDate: PROCEDURE }
    );
    assert.equal(stage.stage, "month_3");
    assert.equal(stage.usableForExactStage, true);
    assert.ok(stage.stageConfidence === "high" || stage.stageConfidence === "moderate");
  });

  it("2. true month6 evidence → month_6", () => {
    const stage = resolveLongitudinalOutcomeStage(
      {
        type: "patient_photo:postop_month6_front",
        captured_at: "2025-07-20T00:00:00.000Z",
      },
      { procedureDate: PROCEDURE }
    );
    assert.equal(stage.stage, "month_6");
    assert.equal(stage.usableForExactStage, true);
  });

  it("3. category/timestamp conflict does not silently misclassify", () => {
    const stage = resolveLongitudinalOutcomeStage(
      {
        type: "patient_photo:postop_month6_front",
        // ~3 months after procedure — conflicts with month6 category
        captured_at: "2025-04-15T00:00:00.000Z",
      },
      { procedureDate: PROCEDURE }
    );
    assert.equal(stage.usableForExactStage, false);
    assert.equal(stage.stageConfidence, "low");
    assert.ok(stage.conflictReason);
    assert.match(String(stage.conflictReason), /conflict|implies|indicates/i);
  });

  it("4. uncertain timing reduces confidence or rejects exact stage", () => {
    const stage = resolveLongitudinalOutcomeStage(
      { type: "doctor_photo:img_followup_front" },
      { procedureDate: PROCEDURE }
    );
    assert.equal(stage.usableForExactStage, false);
    assert.equal(stage.stageConfidence, "low");
  });
});

describe("HA-PROJECTION-1E evidence normalization", () => {
  it("5. month6 front aliases normalize", () => {
    const r = resolveLongitudinalEvidenceRole({
      type: "patient_photo:postop_month6_front",
    });
    assert.equal(r.role, "followup_front");
    assert.equal(r.categoryStage, "month_6");
  });

  it("6. doctor/clinic follow-up aliases normalize", () => {
    assert.equal(
      resolveLongitudinalEvidenceRole({ type: "doctor_photo:img_followup_top" }).role,
      "followup_top"
    );
    assert.equal(
      resolveLongitudinalEvidenceRole({ type: "clinic_photo:img_followup_donor" }).role,
      "followup_donor_rear"
    );
  });

  it("7. donor follow-up maps correctly", () => {
    assert.equal(
      resolveLongitudinalEvidenceRole({
        type: "patient_photo:postop_month12_donor",
      }).role,
      "followup_donor_rear"
    );
  });

  it("8. crown evidence only required when relevant", () => {
    assert.equal(isCrownRelevant(["hairline", "frontal"]), false);
    assert.equal(isCrownRelevant(["crown"]), true);

    const withoutCrown = assessLongitudinalEvidence({
      stage: "month_6",
      presentRoles: [
        "followup_front",
        "followup_top",
        "followup_recipient_closeup",
        "followup_donor_rear",
      ],
      treatedAreas: ["hairline", "frontal"],
    });
    assert.equal(withoutCrown.crownRelevant, false);
    assert.ok(!withoutCrown.missingRecommendedRoles.includes("followup_crown"));

    const withCrown = assessLongitudinalEvidence({
      stage: "month_6",
      presentRoles: ["followup_front"],
      treatedAreas: ["crown"],
    });
    assert.equal(withCrown.crownRelevant, true);
    assert.ok(withCrown.missingRecommendedRoles.includes("followup_crown"));
  });
});
