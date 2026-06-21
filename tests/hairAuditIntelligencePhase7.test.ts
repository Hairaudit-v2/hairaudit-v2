/**
 * HA-INTELLIGENCE-7 — patient translation layer, professional raw exposure,
 * patient report section, snapshot persistence, and trust safeguards.
 *
 * Run: npx tsx --test tests/hairAuditIntelligencePhase7.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runHairAuditIntelligenceFromLegacyArtifacts } from "@/lib/hairaudit-intelligence";
import type { HairAuditIntelligenceBundle } from "@/lib/hairaudit-intelligence/types";
import {
  assertPatientObservationSafe,
  FORBIDDEN_PATIENT_OBSERVATION_TERMS,
  PATIENT_INTELLIGENCE_HEADING,
  translateIntelligenceForPatient,
} from "@/lib/hairaudit-intelligence/patient/patientIntelligenceTranslation";
import { buildHairAuditIntelligenceSnapshotRow } from "@/lib/hairaudit-intelligence/shadow/persistHairAuditIntelligenceSnapshot.server";

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

const richReportSummary = {
  key_findings: [
    { title: "Temple recession noted on baseline front view", severity: "medium" as const },
    { title: "Crown thinning may warrant follow-up", severity: "high" as const },
    { title: "Donor density appears moderate in rear view", severity: "medium" as const },
    { title: "Diffuse thinning across the top", severity: "medium" as const },
    { title: "Uneven graft spacing on day-0 recipient", severity: "medium" as const },
    { title: "Asymmetry between left and right hairline", severity: "medium" as const },
  ],
  red_flags: [
    { title: "Possible overharvesting in donor follow-up", severity: "high" as const },
    { title: "Signs of prior transplant in donor area", severity: "high" as const },
  ],
};

function buildRichBundle(): HairAuditIntelligenceBundle {
  return runHairAuditIntelligenceFromLegacyArtifacts({
    caseId: "case-phase7",
    uploads: richUploads,
    reportSummary: richReportSummary,
  });
}

// Raw enum/field vocabulary that must NEVER reach a patient observation.
const RAW_FIELD_TOKENS = [
  "norwoodStage",
  "III_vertex",
  "not_assessable",
  "none_suggested",
  "elevated_suspicion",
  "appears_limited",
  "donorReserveRisk",
  "overharvestingIndicators",
  "priorTransplantEvidence",
  "implantationPatternIrregularities",
  "graftSpacingAnomalies",
  "rule_based_placeholder",
  "classifier_enriched_rule_based",
];

describe("HA-INTELLIGENCE-7 patient translation layer", () => {
  it("produces calm observations for a rich bundle", () => {
    const translation = translateIntelligenceForPatient(buildRichBundle());
    assert.equal(translation.heading, PATIENT_INTELLIGENCE_HEADING);
    assert.ok(translation.hasObservations, "expected at least one patient observation");
    assert.ok(translation.observations.length > 0);
    assert.match(translation.disclaimer, /not a diagnosis/i);
  });

  it("never exposes raw engine fields, enums, or classification strings", () => {
    const bundle = buildRichBundle();
    const translation = translateIntelligenceForPatient(bundle);
    const blob = JSON.stringify(
      translation.observations.map((o) => ({ area: o.area, areaLabel: o.areaLabel, observation: o.observation }))
    );

    for (const token of RAW_FIELD_TOKENS) {
      assert.ok(!blob.includes(token), `patient output leaked raw token: ${token}`);
    }
    // raw classification labels must not appear verbatim
    assert.ok(!blob.includes(bundle.hairLossClassification.classification));
    // engine ids must not leak
    assert.ok(!blob.toLowerCase().includes("engineid"));
    assert.ok(!blob.includes("hair_loss_classification"));
  });

  it("never leaks confidence, severity, scores, or AI language", () => {
    const translation = translateIntelligenceForPatient(buildRichBundle());
    for (const o of translation.observations) {
      assertPatientObservationSafe(o.observation); // throws on any forbidden term
      assert.doesNotMatch(o.observation, /\bAI\b/);
      assert.doesNotMatch(o.observation, /confidence|severity|score|%|Norwood|GPT|AuditOS/i);
    }
  });

  it("uses the documented calm phrasing for crown progression", () => {
    const translation = translateIntelligenceForPatient(buildRichBundle());
    const crown = translation.observations.find((o) => o.area === "crown_region");
    if (crown) {
      assert.match(crown.observation, /crown region/i);
      assert.match(crown.observation, /may suggest|benefit from|review/i);
    }
  });

  it("returns no observations for an empty/undefined bundle", () => {
    const translation = translateIntelligenceForPatient(undefined);
    assert.equal(translation.hasObservations, false);
    assert.equal(translation.observations.length, 0);
  });

  it("guard rejects observations containing forbidden vocabulary", () => {
    assert.throws(() => assertPatientObservationSafe("Your Norwood III pattern was detected"));
    assert.throws(() => assertPatientObservationSafe("Elevated miniaturisation suspicion in donor"));
    assert.throws(() => assertPatientObservationSafe("Confidence 82% from the classifier"));
    assert.throws(() => assertPatientObservationSafe("This AI model flagged the donor area"));
    assert.ok(FORBIDDEN_PATIENT_OBSERVATION_TERMS.length > 0);
  });
});

describe("HA-INTELLIGENCE-7 professional raw exposure", () => {
  it("retains raw intelligence fields for professional review", () => {
    const bundle = buildRichBundle();
    for (const output of [
      bundle.hairLossClassification,
      bundle.donorIntelligence,
      bundle.repairSurgery,
      bundle.proceduralIntelligence,
    ]) {
      // The professional panel renders exactly these — confirm they exist on the bundle.
      assert.ok(typeof output.classification === "string" && output.classification.length > 0);
      assert.ok(typeof output.severity === "string");
      assert.ok(typeof output.confidence === "string");
      assert.ok(output.fields && typeof output.fields === "object");
      assert.ok(typeof output.clinicianNotes === "string" && output.clinicianNotes.length > 0);
      assert.ok(typeof output.suggestedNextStep === "string" && output.suggestedNextStep.length > 0);
      assert.ok(typeof output.executionMode === "string");
    }
    // Hair-loss engine retains the (never-patient-facing) Norwood field for clinicians.
    assert.ok("norwoodStage" in bundle.hairLossClassification.fields);
  });
});

describe("HA-INTELLIGENCE-7 snapshot persistence", () => {
  it("builds a PII-free, idempotent snapshot row from a bundle", () => {
    const bundle = buildRichBundle();
    const row = buildHairAuditIntelligenceSnapshotRow({
      caseId: "case-phase7",
      reportId: "report-1",
      reportVersion: 3,
      bundle,
      sourceEventName: "report_generated",
      now: "2026-06-21T00:00:00.000Z",
    });

    assert.equal(row.case_id, "case-phase7");
    assert.equal(row.report_id, "report-1");
    assert.equal(row.report_version, 3);
    assert.equal(row.engine_version, bundle.engineVersion);
    assert.equal(row.overall_severity, bundle.overallSeverity);
    assert.equal(row.overall_confidence, bundle.overallConfidence);
    assert.equal(row.engine_metadata.engines.length, 4);

    // Raw engine metadata is retained (professional), patient observations are translated.
    assert.ok("norwoodStage" in (row.engine_metadata.engines[0].fields as Record<string, unknown>));
    const obsBlob = JSON.stringify(row.patient_observations);
    for (const token of RAW_FIELD_TOKENS) {
      assert.ok(!obsBlob.includes(token), `snapshot patient_observations leaked: ${token}`);
    }

    // No image storage paths persisted.
    const blob = JSON.stringify(row);
    assert.ok(!blob.includes("storage_path"));
    assert.ok(!blob.includes("storagePath"));
  });

  it("captures progression-comparable bands across versions", () => {
    const bundle = buildRichBundle();
    const v1 = buildHairAuditIntelligenceSnapshotRow({
      caseId: "c1",
      reportId: "r1",
      reportVersion: 1,
      bundle,
    });
    const v2 = buildHairAuditIntelligenceSnapshotRow({
      caseId: "c1",
      reportId: "r2",
      reportVersion: 2,
      bundle,
    });
    // Same case, different versions → independently queryable history rows.
    assert.equal(v1.case_id, v2.case_id);
    assert.notEqual(v1.report_version, v2.report_version);
    assert.ok(v1.overall_severity && v2.overall_severity);
  });
});
