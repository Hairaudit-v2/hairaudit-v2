import test from "node:test";
import assert from "node:assert/strict";
import { adaptExistingAuditScore } from "@/lib/auditos/scoring/adaptExistingAuditScore";
import { buildEvidenceManifestFromLegacy } from "@/lib/auditos/evidence/buildEvidenceManifestFromLegacy";
import type { CaseEvidenceManifest } from "@/lib/evidence/evidenceManifest";
import { adaptLegacyReportModel } from "@/lib/auditos/reports/adaptLegacyReportModel";
import {
  emitAuditOsEvent,
  isAuditOsFiEventsEnabled,
  sanitizeAuditOsFiPayload,
} from "@/lib/auditos/events/emitAuditOsEvent.server";
import { setEventSink } from "@/lib/integrations/sink";
import type { HairAuditEventSink } from "@/lib/integrations/types";

test("adaptExistingAuditScore: maps forensic domain_scores_v1 and overall", () => {
  const legacy = {
    score: 88,
    forensic_audit: {
      overall_scores_v1: { performance_score: 88, confidence_grade: "high" },
      domain_scores_v1: {
        domains: [
          { domain_id: "SP", raw_score: 80, weighted_score: 12, confidence: 0.7 },
          { domain_id: "DP", raw_score: 90, weighted_score: 22.5 },
        ],
      },
      section_scores: { donor_management: 75 },
      confidence: 0.82,
    },
    grade: "A",
  };
  const out = adaptExistingAuditScore(legacy);
  assert.equal(out.provenance.scoringEngineVersion, "hairaudit.scoring_engine.v1");
  assert.equal(out.overallScore, 88);
  assert.equal(out.grade, "A");
  assert.equal(out.domainScores.length, 2);
  assert.equal(out.domainScores[0]?.domainId, "SP");
  assert.equal(out.confidenceLabel, "high");
  assert.ok(out.sectionScores && out.sectionScores.donor_management === 75);
});

test("adaptExistingAuditScore: tolerant of empty / non-object input", () => {
  const out = adaptExistingAuditScore(null);
  assert.equal(out.domainScores.length, 0);
  assert.equal(out.provenance.rubricVersion, "hairaudit.rubric.unknown");
});

test("adaptExistingAuditScore: override rows populate humanOverrides", () => {
  const out = adaptExistingAuditScore(
    { score: 70 },
    { overrideRows: [{ domain_key: "SP" }, { domain_key: "SP" }] }
  );
  assert.equal(out.humanOverrides?.hasOverrides, true);
  assert.deepEqual(out.humanOverrides?.overriddenDomainKeys, ["SP"]);
});

test("buildEvidenceManifestFromLegacy: splits uploads and merges prepared images", () => {
  const legacyManifest: CaseEvidenceManifest = {
    id: "m1",
    case_id: "c1",
    status: "ready",
    prepared_images: [
      {
        upload_id: "u-prep",
        original_path: "cases/c1/a.jpg",
        prepared_path: "cases/c1/prepared/a.jpg",
        category: "preop_front",
        width: 1200,
        height: 900,
        mime_type: "image/jpeg",
        quality_label: "usable",
        notes: "",
      },
    ],
    quality_score: 82.5,
    missing_categories: ["day0_donor"],
    errors: [],
  };
  const manifest = buildEvidenceManifestFromLegacy({
    caseId: "case-uuid",
    legacyManifest,
    uploads: [
      { id: "u1", type: "patient_photo:front", storage_path: "cases/case-uuid/x.jpg", metadata: { category: "preop_front" } },
      { id: "u2", type: "clinic_document:pdf", storage_path: "cases/case-uuid/doc.pdf", metadata: {} },
    ],
  });
  assert.equal(manifest.evidenceManifestVersion, "hairaudit.evidence_manifest.v1");
  assert.equal(manifest.caseId, "case-uuid");
  assert.ok(manifest.images.some((i) => i.uploadId === "u1"));
  assert.ok(manifest.images.some((i) => i.type === "prepared_image"));
  assert.equal(manifest.documents.length, 1);
  assert.ok(manifest.missingEvidence.includes("day0_donor"));
  assert.equal(manifest.completeness.coverageScore, 82.5);
});

test("adaptLegacyReportModel: stitches scoring, evidence, findings, human review", () => {
  const normalized = adaptLegacyReportModel({
    caseId: "cid",
    reportRow: {
      id: "rid",
      version: 3,
      created_at: "2026-01-01T00:00:00Z",
      summary: {
        score: 77,
        findings: [{ title: "Gap", severity: "medium", recommended_next_step: "Upload donor rear" }],
        forensic_audit: {
          key_findings: [{ title: "AI note", severity: "low", impact: "x", recommended_next_step: "Follow up" }],
          data_quality: { limitations: ["low resolution"] },
        },
      },
      auditor_review_eligibility: "eligible",
      auditor_review_status: "requested",
      provisional_status: "pending_validation",
      counts_for_awards: false,
    },
    legacyEvidenceManifest: null,
    uploads: [],
  });
  assert.equal(normalized.reportId, "rid");
  assert.equal(normalized.reportVersion, 3);
  assert.equal(normalized.scoring.overallScore, 77);
  assert.ok(normalized.findings.some((f) => f.title === "Gap"));
  assert.ok(normalized.recommendations.some((r) => r.includes("donor") || r.includes("Follow")));
  assert.deepEqual(normalized.limitations, ["low resolution"]);
  assert.equal(normalized.humanReview?.auditorReviewEligibility, "eligible");
});

test("sanitizeAuditOsFiPayload: drops unknown and non-scalar coercion", () => {
  const safe = sanitizeAuditOsFiPayload({
    case_id: "11111111-1111-1111-1111-111111111111",
    report_version: 2,
    patient_email: "nope@example.com",
    extra: { nested: true },
  });
  assert.equal(safe.case_id, "11111111-1111-1111-1111-111111111111");
  assert.equal(safe.report_version, 2);
  assert.equal(safe.patient_email, undefined);
  assert.equal(safe.extra, undefined);
});

test("emitAuditOsEvent: disabled by default does not invoke sink", async () => {
  const prev = process.env.HAIRAUDIT_FI_EVENTS_ENABLED;
  delete process.env.HAIRAUDIT_FI_EVENTS_ENABLED;
  let calls = 0;
  const sink: HairAuditEventSink = {
    async emit() {
      calls += 1;
    },
  };
  setEventSink(sink);
  assert.equal(isAuditOsFiEventsEnabled(), false);
  await emitAuditOsEvent("hairaudit.case.submitted", { case_id: "cid" });
  assert.equal(calls, 0);
  process.env.HAIRAUDIT_FI_EVENTS_ENABLED = prev;
  setEventSink({ async emit() {} });
});

test("emitAuditOsEvent: invokes sink when HAIRAUDIT_FI_EVENTS_ENABLED=true", async () => {
  const prev = process.env.HAIRAUDIT_FI_EVENTS_ENABLED;
  process.env.HAIRAUDIT_FI_EVENTS_ENABLED = "true";
  let lastName = "";
  let lastPayload: Record<string, unknown> | null = null;
  setEventSink({
    async emit(name, payload) {
      lastName = name;
      lastPayload = payload;
    },
  });
  await emitAuditOsEvent("hairaudit.report.generated", {
    case_id: "22222222-2222-2222-2222-222222222222",
    report_id: "rep",
    report_version: 1,
  });
  assert.equal(lastName, "hairaudit.report.generated");
  assert.ok(lastPayload);
  assert.equal(lastPayload?.case_id, "22222222-2222-2222-2222-222222222222");
  process.env.HAIRAUDIT_FI_EVENTS_ENABLED = prev;
  setEventSink({ async emit() {} });
});
