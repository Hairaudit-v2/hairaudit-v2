/**
 * HA-INTELLIGENCE-2 — report pipeline shadow wiring tests.
 * Run: npx tsx --test tests/hairAuditIntelligencePipeline.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION } from "@/lib/hairaudit-intelligence";
import {
  canShowHairAuditIntelligencePanelForRole,
  isHairAuditIntelligenceReviewPanelEnabled,
} from "@/lib/hairaudit-intelligence/shadow/hairAuditIntelligenceEnv.server";
import { extractHairAuditIntelligenceFromSummary } from "@/lib/hairaudit-intelligence/shadow/extractHairAuditIntelligenceForReview";
import { attachHairAuditIntelligenceToReportSummarySafe } from "@/lib/hairaudit-intelligence/shadow/inngestHairAuditIntelligence.server";
import {
  legacySummaryToIntelligenceReportSummary,
  mergeHairAuditIntelligenceIntoSummaryMetadata,
} from "@/lib/hairaudit-intelligence/shadow/mergeHairAuditIntelligenceIntoSummary.server";
import {
  assertPatientOutputDoesNotLeakIntelligence,
  collectPatientVisibleReportText,
  FORBIDDEN_PATIENT_LEAK_TERMS,
} from "@/lib/hairaudit-intelligence/shadow/patientOutputSafety";
import { runHairAuditIntelligenceFromLegacyArtifacts } from "@/lib/hairaudit-intelligence";

const richUploads = [
  { id: "u1", type: "patient_photo:preop_front" },
  { id: "u2", type: "patient_photo:preop_crown" },
  { id: "u3", type: "patient_photo:preop_donor_rear" },
  { id: "u4", type: "patient_photo:day0_recipient" },
];

function makeLegacySummary(): Record<string, unknown> {
  return {
    score: 72,
    donor_quality: "Moderate",
    findings: ["Temple recession noted"],
    metadata: {
      pipelineStage: "audit_complete",
      customFlag: true,
    },
    forensic_audit: {
      key_findings: [{ title: "Temple recession on baseline front", severity: "medium" }],
      red_flags: [{ title: "Uneven graft spacing on day-0 recipient", severity: "high" }],
      summary: "Independent visual review based on submitted photos.",
      overall_score: 72,
      model: "test-model",
    },
  };
}

describe("HA-INTELLIGENCE-2 pipeline wiring", () => {
  it("attaches bundle to summary.metadata.hairAuditIntelligence", () => {
    const base = makeLegacySummary();
    const { summary, attached, bundle } = attachHairAuditIntelligenceToReportSummarySafe({
      summary: base,
      caseId: "case-pipeline-1",
      uploads: richUploads,
    });

    assert.equal(attached, true);
    assert.ok(bundle);
    const meta = summary.metadata as Record<string, unknown>;
    const stored = meta.hairAuditIntelligence as Record<string, unknown>;
    assert.equal(stored.engineVersion, HAIRAUDIT_INTELLIGENCE_ENGINE_VERSION);
    assert.ok(stored.generatedAt);
    assert.ok(stored.overallSeverity);
    assert.ok(stored.overallConfidence);
    assert.ok(stored.hairLossClassification);
    assert.ok(stored.donorIntelligence);
    assert.ok(stored.repairSurgery);
    assert.ok(stored.proceduralIntelligence);
    assert.equal(
      (stored.hairLossClassification as { executionMode?: string }).executionMode,
      "rule_based_placeholder"
    );
    assert.equal((stored.hairLossClassification as { advisoryOnly?: boolean }).advisoryOnly, true);
  });

  it("preserves existing summary fields and merges metadata safely", () => {
    const base = makeLegacySummary();
    const { summary } = attachHairAuditIntelligenceToReportSummarySafe({
      summary: base,
      caseId: "case-pipeline-2",
      uploads: richUploads,
    });

    assert.equal(summary.score, 72);
    assert.equal(summary.donor_quality, "Moderate");
    assert.deepEqual(summary.findings, ["Temple recession noted"]);
    const meta = summary.metadata as Record<string, unknown>;
    assert.equal(meta.pipelineStage, "audit_complete");
    assert.equal(meta.customFlag, true);
    assert.ok(meta.hairAuditIntelligence);
  });

  it("maps forensic_audit findings for intelligence input", () => {
    const mapped = legacySummaryToIntelligenceReportSummary(makeLegacySummary());
    assert.equal(mapped.key_findings?.length, 1);
    assert.equal(mapped.red_flags?.length, 1);
  });

  it("does not block report generation when intelligence throws", () => {
    const base = makeLegacySummary();
    const { summary, attached } = attachHairAuditIntelligenceToReportSummarySafe({
      summary: base,
      caseId: "case-fail-safe",
      uploads: richUploads,
      generateBundle: () => {
        throw new Error("simulated intelligence failure");
      },
    });

    assert.equal(attached, false);
    assert.equal(summary.score, 72);
    assert.equal((summary.metadata as Record<string, unknown>).pipelineStage, "audit_complete");
    assert.equal((summary.metadata as Record<string, unknown>).hairAuditIntelligence, undefined);
  });

  it("patient PDF/web output does not expose clinicianNotes or intelligence metadata", () => {
    const base = makeLegacySummary();
    const { summary } = attachHairAuditIntelligenceToReportSummarySafe({
      summary: base,
      caseId: "case-patient-safe",
      uploads: richUploads,
    });

    const visible = collectPatientVisibleReportText(summary);
    assert.doesNotMatch(visible, /clinicianNotes/i);
    assert.doesNotMatch(visible, /hairAuditIntelligence/i);
    for (const term of FORBIDDEN_PATIENT_LEAK_TERMS) {
      assert.doesNotMatch(visible, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    assertPatientOutputDoesNotLeakIntelligence(summary);
  });

  it("auditor/doctor can access structured bundle from summary metadata", () => {
    const bundle = runHairAuditIntelligenceFromLegacyArtifacts({
      caseId: "case-review",
      uploads: richUploads,
      reportSummary: legacySummaryToIntelligenceReportSummary(makeLegacySummary()),
    });
    const summary = mergeHairAuditIntelligenceIntoSummaryMetadata(makeLegacySummary(), bundle);
    const extracted = extractHairAuditIntelligenceFromSummary(summary);

    assert.ok(extracted);
    assert.equal(extracted?.caseId, "case-review");
    assert.equal(extracted?.hairLossClassification.engineId, "hair_loss_classification");
    assert.equal(extracted?.donorIntelligence.engineId, "donor_intelligence");
    assert.equal(extracted?.repairSurgery.engineId, "repair_surgery");
    assert.equal(extracted?.proceduralIntelligence.engineId, "procedural_intelligence");
    assert.match(extracted?.donorIntelligence.clinicianNotes, /Donor|donor/i);
  });

  it("gates professional review panel by role and env", () => {
    assert.equal(canShowHairAuditIntelligencePanelForRole("auditor"), true);
    assert.equal(canShowHairAuditIntelligencePanelForRole("doctor"), true);
    assert.equal(canShowHairAuditIntelligencePanelForRole("patient"), false);
    assert.equal(isHairAuditIntelligenceReviewPanelEnabled(), process.env.NODE_ENV !== "production");
  });
});
