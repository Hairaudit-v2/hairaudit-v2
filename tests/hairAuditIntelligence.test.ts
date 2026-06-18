/**
 * HA-INTELLIGENCE-1 — clinical intelligence engine scaffold tests.
 * Run: npx tsx --test tests/hairAuditIntelligence.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION,
  isHairAuditIntelligenceLiveAiEnabled,
  mapReportSummaryToFindings,
  mapUploadsToIntelligenceImages,
  runDonorIntelligenceEngine,
  runHairAuditIntelligenceBundle,
  runHairAuditIntelligenceFromLegacyArtifacts,
  runHairLossClassificationEngine,
  runProceduralIntelligenceEngine,
  runRepairSurgeryEngine,
} from "@/lib/hairaudit-intelligence";

const FORBIDDEN_PATIENT_TERMS = [
  /\bdiagnosed\b/i,
  /\bconfirmed\b/i,
  /\bdefinite\b/i,
  /\bAI detected\b/i,
  /\bforensic proof\b/i,
  /\bGPT\b/i,
  /\bAuditOS\b/i,
];

function assertPatientSafeCopy(text: string) {
  for (const pattern of FORBIDDEN_PATIENT_TERMS) {
    assert.doesNotMatch(text, pattern, `Patient copy must not match ${pattern}`);
  }
  assert.match(text, /clinician|not a diagnosis|uploaded images|may suggest|Based on/i);
}

const richUploads = [
  { id: "u1", type: "patient_photo:preop_front" },
  { id: "u2", type: "patient_photo:preop_left" },
  { id: "u3", type: "patient_photo:preop_right" },
  { id: "u4", type: "patient_photo:preop_crown" },
  { id: "u5", type: "patient_photo:preop_donor_rear" },
  { id: "u6", type: "patient_photo:day0_recipient" },
  { id: "u7", type: "patient_photo:graft_tray_closeup" },
  { id: "u8", type: "patient_photo:postop_month12_front" },
];

const richFindings = [
  { title: "Temple recession noted on baseline front view", severity: "medium" as const },
  { title: "Crown thinning may warrant follow-up", severity: "high" as const },
  { title: "Donor density appears moderate in rear view", severity: "medium" as const },
  { title: "Possible overharvesting in donor follow-up", severity: "high" as const },
  { title: "Uneven graft spacing on day-0 recipient", severity: "medium" as const },
];

describe("HA-INTELLIGENCE-1 scaffold", () => {
  it("exports versioned engine contract", () => {
    assert.equal(HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION, "hairaudit.intelligence.v1");
  });

  it("does not enable live AI in Phase 1", () => {
    assert.equal(isHairAuditIntelligenceLiveAiEnabled(), false);
  });

  it("maps legacy uploads to intelligence image refs", () => {
    const images = mapUploadsToIntelligenceImages([
      { id: "a", type: "patient_photo:preop_front" },
    ]);
    assert.equal(images.length, 1);
    assert.equal(images[0]?.canonicalPhotoCategory, "preop_front");
  });

  it("maps report summary findings", () => {
    const findings = mapReportSummaryToFindings({
      key_findings: [{ title: "Crown density concern", severity: "high" }],
      red_flags: ["Uneven placement flagged"],
    });
    assert.equal(findings.length, 2);
    assert.equal(findings[0]?.severity, "high");
  });
});

describe("Hair Loss Classification Engine", () => {
  it("returns structured output with required envelope fields", () => {
    const out = runHairLossClassificationEngine({
      images: mapUploadsToIntelligenceImages(richUploads.slice(0, 4)),
      reportFindings: richFindings.slice(0, 2),
    });

    assert.equal(out.engineId, "hair_loss_classification");
    assert.equal(out.engineVersion, HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION);
    assert.equal(out.advisoryOnly, true);
    assert.equal(out.executionMode, "rule_based_placeholder");
    assert.ok(out.classification.length > 0);
    assert.ok(out.fields.norwoodStage);
    assert.ok(out.fields.crownProgression);
    assert.ok(out.fields.diffuseThinningPattern);
    assert.ok(Array.isArray(out.fields.evidenceLimitations));
    assert.ok(out.evidenceUsed.length >= 1);
    assert.ok(out.limitations.length >= 2);
    assertPatientSafeCopy(out.patientSafeSummary);
    assert.match(out.clinicianNotes, /Forensic|Norwood/i);
  });

  it("marks pattern not assessable when baseline missing", () => {
    const out = runHairLossClassificationEngine({ images: [], reportFindings: [] });
    assert.equal(out.fields.norwoodStage, "not_assessable");
    assert.equal(out.confidence, "very_low");
  });
});

describe("Donor Intelligence Engine", () => {
  it("estimates donor fields from donor photos and findings", () => {
    const out = runDonorIntelligenceEngine({
      images: mapUploadsToIntelligenceImages([richUploads[4]!]),
      reportFindings: richFindings.slice(2, 4),
    });

    assert.equal(out.engineId, "donor_intelligence");
    assert.ok(out.fields.donorDensityBand);
    assert.ok(out.fields.miniaturisationSuspicion);
    assert.ok(out.fields.retrogradeAlopeciaPattern);
    assert.ok(out.fields.extractionSafetyZoneConcerns);
    assert.ok(out.fields.donorReserveRisk);
    assertPatientSafeCopy(out.patientSafeSummary);
  });
});

describe("Repair Surgery Engine", () => {
  it("returns repair complexity from donor and outcome evidence", () => {
    const out = runRepairSurgeryEngine({
      images: mapUploadsToIntelligenceImages([richUploads[4]!, richUploads[7]!]),
      reportFindings: [richFindings[3]!],
    });

    assert.equal(out.engineId, "repair_surgery");
    assert.ok(out.fields.repairComplexityBand);
    assert.ok(out.fields.overharvestingIndicators);
    assert.ok(out.fields.priorTransplantEvidence);
    assertPatientSafeCopy(out.patientSafeSummary);
  });
});

describe("Procedural Intelligence Engine", () => {
  it("returns procedural severity from surgical and graft evidence", () => {
    const out = runProceduralIntelligenceEngine({
      images: mapUploadsToIntelligenceImages([richUploads[5]!, richUploads[6]!]),
      reportFindings: [richFindings[4]!],
    });

    assert.equal(out.engineId, "procedural_intelligence");
    assert.ok(out.fields.implantationPatternIrregularities);
    assert.ok(out.fields.graftSpacingAnomalies);
    assert.ok(out.fields.asymmetry);
    assert.ok(out.fields.survivalProbabilityEstimateBand);
    assert.ok(out.fields.proceduralConcernSeverity);
    assertPatientSafeCopy(out.patientSafeSummary);
    assert.match(out.clinicianNotes, /Procedural Intelligence|graft integrity/i);
  });
});

describe("Intelligence bundle orchestrator", () => {
  it("runs all four engines and aggregates severity/confidence", () => {
    const bundle = runHairAuditIntelligenceBundle({
      caseId: "case-123",
      images: mapUploadsToIntelligenceImages(richUploads),
      reportFindings: richFindings,
    });

    assert.equal(bundle.engineVersion, HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION);
    assert.equal(bundle.caseId, "case-123");
    assert.ok(bundle.hairLossClassification);
    assert.ok(bundle.donorIntelligence);
    assert.ok(bundle.repairSurgery);
    assert.ok(bundle.proceduralIntelligence);
    assert.ok(["none", "minor", "moderate", "significant", "critical"].includes(bundle.overallSeverity));
    assert.ok(["very_low", "low", "moderate", "high"].includes(bundle.overallConfidence));
    assert.ok(bundle.generatedAt);
  });

  it("runs from legacy artifacts convenience helper", () => {
    const bundle = runHairAuditIntelligenceFromLegacyArtifacts({
      caseId: "legacy-case",
      uploads: richUploads,
      reportSummary: {
        key_findings: [{ title: "Hairline recession on pre-op front", severity: "medium" }],
      },
    });
    assert.equal(bundle.caseId, "legacy-case");
    assert.notEqual(bundle.hairLossClassification.fields.norwoodStage, "not_assessable");
  });
});

describe("Example outputs (snapshot-style assertions)", () => {
  it("hair loss example", () => {
    const out = runHairLossClassificationEngine({
      images: mapUploadsToIntelligenceImages(richUploads.slice(0, 4)),
      reportFindings: [
        { title: "Temple recession on baseline", severity: "medium" },
        { title: "Vertex thinning", severity: "high" },
      ],
    });
    // Illustrative contract values for HA-INTELLIGENCE-1 docs
    assert.equal(out.fields.norwoodStage, "III_vertex");
    assert.match(out.patientSafeSummary, /Norwood III/i);
  });

  it("donor example", () => {
    const out = runDonorIntelligenceEngine({
      images: mapUploadsToIntelligenceImages([{ type: "patient_photo:preop_donor_rear" }]),
      reportFindings: [
        { title: "Donor density appears limited", severity: "high" },
        { title: "Sparse donor zone on rear view", severity: "high" },
      ],
    });
    assert.equal(out.fields.donorDensityBand, "appears_limited");
    assert.equal(out.fields.donorReserveRisk, "elevated");
  });

  it("repair example", () => {
    const out = runRepairSurgeryEngine({
      images: mapUploadsToIntelligenceImages([
        { type: "patient_photo:postop_healed_donor" },
        { type: "patient_photo:postop_month12_front" },
      ]),
      reportFindings: [
        { title: "Prior transplant scarring suggested", severity: "medium" },
        { title: "Overharvesting in donor zone", severity: "high" },
      ],
    });
    assert.ok(["moderate", "high"].includes(out.fields.repairComplexityBand));
  });

  it("procedural example", () => {
    const out = runProceduralIntelligenceEngine({
      images: mapUploadsToIntelligenceImages([
        { type: "patient_photo:day0_recipient" },
        { type: "patient_photo:graft_tray_closeup" },
      ]),
      reportFindings: [
        { title: "Uneven graft spacing on recipient", severity: "high" },
        { title: "Transection risk on tray closeup", severity: "high" },
      ],
    });
    assert.ok(["moderate", "significant", "critical"].includes(out.fields.proceduralConcernSeverity));
  });
});
