/**
 * FI-OUTCOME-INTELLIGENCE-1C — Treatment-aware policy + evidence tests.
 * Run: pnpm exec tsx --test tests/longitudinalCapturePolicy.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildMilestoneEvidenceRequirements,
  patientSafeLabelForRole,
  publicViewKeyForRole,
  type TreatmentCaptureContext,
} from "@/lib/outcomeIntelligence/longitudinalCapturePolicy";
import { assessMilestoneEvidence } from "@/lib/outcomeIntelligence/longitudinalCaptureEvidence";
import { assertPatientSafeMissingLabels } from "@/lib/outcomeIntelligence/longitudinalCaptureEvidence";
import type { ProjectionUploadInput } from "@/lib/projection/types";

const frontalOnly: TreatmentCaptureContext = {
  treatedAreas: ["frontal", "hairline"],
  crownTreated: false,
  templesTreated: false,
  frontalFocus: true,
  donorEvidenceRequired: false,
};

const frontalCrown: TreatmentCaptureContext = {
  ...frontalOnly,
  treatedAreas: ["frontal", "crown"],
  crownTreated: true,
};

const withTemples: TreatmentCaptureContext = {
  ...frontalOnly,
  treatedAreas: ["frontal", "temples"],
  templesTreated: true,
};

const donorRequired: TreatmentCaptureContext = {
  ...frontalOnly,
  donorEvidenceRequired: true,
};

describe("FI-OUTCOME-INTELLIGENCE-1C treatment-aware evidence", () => {
  it("15. frontal-only does not require crown", () => {
    const req = buildMilestoneEvidenceRequirements({
      stage: "month_3",
      treatment: frontalOnly,
    });
    assert.ok(!req.required.includes("followup_crown"));
    assert.ok(req.recommended.includes("followup_crown"));
  });

  it("16. crown-treated requires crown", () => {
    const req = buildMilestoneEvidenceRequirements({
      stage: "month_6",
      treatment: frontalCrown,
    });
    assert.ok(req.required.includes("followup_crown"));
  });

  it("17. temple treatment increases side-view requirement", () => {
    const req = buildMilestoneEvidenceRequirements({
      stage: "month_6",
      treatment: withTemples,
    });
    assert.ok(req.required.includes("followup_left"));
    assert.ok(req.required.includes("followup_right"));
  });

  it("18. donor requirement follows policy", () => {
    const rec = buildMilestoneEvidenceRequirements({
      stage: "month_6",
      treatment: frontalOnly,
    });
    assert.ok(!rec.required.includes("followup_donor_rear"));
    assert.ok(rec.recommended.includes("followup_donor_rear"));

    const req = buildMilestoneEvidenceRequirements({
      stage: "month_6",
      treatment: donorRequired,
    });
    assert.ok(req.required.includes("followup_donor_rear"));
  });

  it("19. recommended views do not block readiness", () => {
    const requirements = buildMilestoneEvidenceRequirements({
      stage: "month_6",
      treatment: frontalOnly,
    });
    const uploads: ProjectionUploadInput[] = [
      { id: "f", type: "patient_photo:postop_month6_front" },
      { id: "t", type: "patient_photo:postop_month6_top" },
      {
        id: "c",
        type: "patient_photo:current_recipient_closeup",
        captured_at: "2025-07-15T00:00:00.000Z",
      },
    ];
    const assessed = assessMilestoneEvidence({
      stage: "month_6",
      uploads,
      requirements,
      caseContext: { procedureDate: "2025-01-15", treatedAreas: ["frontal"] },
    });
    assert.equal(assessed.requiredSatisfied, true);
    assert.ok(assessed.missingRecommendedEvidenceRoles.length >= 1);
  });
});

describe("FI-OUTCOME-INTELLIGENCE-1C evidence normalization", () => {
  const requirements = buildMilestoneEvidenceRequirements({
    stage: "month_3",
    treatment: frontalOnly,
  });

  it("20. month3 aliases satisfy Month 3 roles", () => {
    const uploads: ProjectionUploadInput[] = [
      { id: "f", type: "patient_photo:postop_month3_front" },
      { id: "t", type: "patient_photo:postop_month3_top" },
    ];
    const assessed = assessMilestoneEvidence({
      stage: "month_3",
      uploads,
      requirements,
      caseContext: { procedureDate: "2025-01-15" },
    });
    assert.ok(assessed.presentEvidenceRoles.includes("followup_front"));
    assert.ok(assessed.presentEvidenceRoles.includes("followup_top"));
  });

  it("21. month6 aliases do not satisfy Month 3", () => {
    const uploads: ProjectionUploadInput[] = [
      { id: "f", type: "patient_photo:postop_month6_front" },
      { id: "t", type: "patient_photo:postop_month6_top" },
    ];
    const assessed = assessMilestoneEvidence({
      stage: "month_3",
      uploads,
      requirements,
      caseContext: { procedureDate: "2025-01-15" },
    });
    assert.equal(assessed.presentEvidenceRoles.length, 0);
    assert.ok(assessed.rejectedCount >= 1);
  });

  it("22. canonical 1E resolver reused (unknown type ignored)", () => {
    const uploads: ProjectionUploadInput[] = [
      { id: "x", type: "patient_photo:totally_unknown_key" },
    ];
    const assessed = assessMilestoneEvidence({
      stage: "month_3",
      uploads,
      requirements,
      caseContext: { procedureDate: "2025-01-15" },
    });
    assert.equal(assessed.anyEvidencePresent, false);
  });

  it("23. raw storage presence alone does not count incorrectly", () => {
    const uploads: ProjectionUploadInput[] = [
      {
        id: "f",
        type: "patient_photo:postop_month3_front",
        // Capture timing conflicts with month3 category → rejected by 1E
        captured_at: "2025-10-01T00:00:00.000Z",
      },
    ];
    const assessed = assessMilestoneEvidence({
      stage: "month_3",
      uploads,
      requirements,
      caseContext: { procedureDate: "2025-01-15" },
    });
    assert.ok(!assessed.presentEvidenceRoles.includes("followup_front"));
  });

  it("24. missing labels are patient-safe", () => {
    const labels = requirements.required.map(patientSafeLabelForRole);
    const check = assertPatientSafeMissingLabels(labels);
    assert.equal(check.ok, true);
    assert.equal(publicViewKeyForRole("followup_front"), "front");
    assert.equal(patientSafeLabelForRole("followup_front"), "Front View");
  });
});
