import test from "node:test";
import assert from "node:assert/strict";
import { buildAuditOsShadowSnapshot } from "@/lib/auditos/shadow/buildAuditOsShadowSnapshot.server";
import { diffAuditOsShadowSnapshot } from "@/lib/auditos/shadow/diffAuditOsShadowSnapshot";
import type { CaseEvidenceManifest } from "@/lib/evidence/evidenceManifest";
import {
  emitAuditOsEvent,
  isAuditOsFiEventsEnabled,
  sanitizeAuditOsFiPayload,
} from "@/lib/auditos/events/emitAuditOsEvent.server";
import { setEventSink } from "@/lib/integrations/sink";
import type { HairAuditEventSink } from "@/lib/integrations/types";

test("buildAuditOsShadowSnapshot: returns partial output when report adapter throws", () => {
  const base = {
    score: 80,
    forensic_audit: {
      overall_scores_v1: { performance_score: 80 },
      domain_scores_v1: { version: 1, domains: [{ domain_id: "SP", raw_score: 70 }] },
    },
  };
  const summary = new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === "findings") {
        throw new Error("simulated findings read failure");
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as Record<string, unknown>;

  const manifest: CaseEvidenceManifest = {
    id: "m1",
    case_id: "c1",
    status: "ready",
    prepared_images: [],
    quality_score: 50,
    missing_categories: [],
    errors: [],
  };

  const snap = buildAuditOsShadowSnapshot({
    caseId: "c1",
    reportRow: { id: "r1", version: 1, summary, created_at: "2026-01-01T00:00:00Z" },
    legacyEvidenceManifest: manifest,
    uploads: [{ id: "u1", type: "patient_photo:front", storage_path: "p/a.jpg" }],
  });

  assert.ok(snap.normalizedScoring != null);
  assert.equal(snap.normalizedReport, null);
  assert.ok(snap.warnings.some((w) => w.includes("adaptLegacyReportModel")));
  assert.ok(snap.evidenceManifest != null);
});

test("buildAuditOsShadowSnapshot: captures evidence adapter warnings", () => {
  const evilManifest = {
    id: "m1",
    case_id: "c1",
    status: "ready",
    get prepared_images() {
      throw new Error("simulated manifest read failure");
    },
    quality_score: 50,
    missing_categories: [],
    errors: [],
  } as CaseEvidenceManifest;

  const snap = buildAuditOsShadowSnapshot({
    caseId: "c1",
    reportRow: {
      id: "r1",
      version: 1,
      summary: { score: 70 },
      created_at: "2026-01-01T00:00:00Z",
    },
    legacyEvidenceManifest: evilManifest,
    uploads: [],
  });

  assert.equal(snap.evidenceManifest, null);
  assert.ok(snap.warnings.some((w) => w.includes("buildEvidenceManifestFromLegacy")));
  assert.ok(snap.normalizedScoring != null);
});

test("diffAuditOsShadowSnapshot: ok when legacy and adapted align", () => {
  const summary = {
    score: 72,
    forensic_audit: {
      overall_scores_v1: { performance_score: 72 },
      domain_scores_v1: { version: 1, domains: [{ domain_id: "SP", raw_score: 70 }] },
      data_quality: { limitations: ["a"] },
      confidence: 0.7,
    },
  };
  const manifest: CaseEvidenceManifest = {
    id: "m1",
    case_id: "c1",
    status: "ready",
    prepared_images: [],
    quality_score: 80,
    missing_categories: [],
    errors: [],
  };
  const snap = buildAuditOsShadowSnapshot({
    caseId: "c1",
    reportRow: { id: "r1", version: 1, summary, created_at: "2026-01-01T00:00:00Z" },
    legacyEvidenceManifest: manifest,
    uploads: [{ id: "u1", type: "patient_photo:front", storage_path: "x.jpg" }],
  });
  const diff = diffAuditOsShadowSnapshot({
    legacySummary: summary,
    legacyEvidenceManifest: manifest,
    uploadCount: 1,
    snapshot: snap,
  });
  assert.equal(diff.status, "ok");
  assert.equal(diff.warnings.length, 0);
});

test("diffAuditOsShadowSnapshot: warning on domain count mismatch", () => {
  const summary = {
    score: 50,
    forensic_audit: {
      overall_scores_v1: { performance_score: 50 },
      domain_scores_v1: { domains: [{ domain_id: "A" }, { domain_id: "B" }] },
      data_quality: { limitations: [] },
      confidence: 0.5,
    },
  };
  const snap = buildAuditOsShadowSnapshot({
    caseId: "c1",
    reportRow: { id: "r1", version: 1, summary: { score: 50 }, created_at: "2026-01-01T00:00:00Z" },
    legacyEvidenceManifest: null,
    uploads: [],
  });
  const diff = diffAuditOsShadowSnapshot({
    legacySummary: summary,
    legacyEvidenceManifest: null,
    uploadCount: 0,
    snapshot: snap,
  });
  assert.equal(diff.status, "warning");
  assert.ok(diff.warnings.some((w) => w.includes("domain count")));
});

test("sanitizeAuditOsFiPayload: keeps FI-safe keys and drops patient-identifiable fields", () => {
  const safe = sanitizeAuditOsFiPayload({
    case_id: "11111111-1111-1111-1111-111111111111",
    report_id: "rep1",
    report_version: 2,
    scoring_engine_version: "hairaudit.scoring_engine.v1",
    scoring_version: "v2",
    evidence_manifest_version: "hairaudit.evidence_manifest.v1",
    generated_at: "2026-06-01T00:00:00Z",
    patient_email: "x@y.com",
    patient_name: "Pat",
    photo_url: "https://example.com/a.jpg",
    phone: "+1555",
  });
  assert.equal(safe.case_id, "11111111-1111-1111-1111-111111111111");
  assert.equal(safe.report_id, "rep1");
  assert.equal(safe.evidence_manifest_version, "hairaudit.evidence_manifest.v1");
  assert.equal(safe.generated_at, "2026-06-01T00:00:00Z");
  assert.equal(safe.scoring_version, "v2");
  assert.equal(safe.patient_email, undefined);
  assert.equal((safe as Record<string, unknown>).patient_name, undefined);
  assert.equal((safe as Record<string, unknown>).photo_url, undefined);
  assert.equal((safe as Record<string, unknown>).phone, undefined);
});

test("emitAuditOsEvent: production default env does not emit events", async () => {
  const prev = process.env.HAIRAUDIT_FI_EVENTS_ENABLED;
  const prevNode = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  delete process.env.HAIRAUDIT_FI_EVENTS_ENABLED;
  let calls = 0;
  setEventSink({
    async emit() {
      calls += 1;
    },
  } satisfies HairAuditEventSink);
  assert.equal(isAuditOsFiEventsEnabled(), false);
  await emitAuditOsEvent("hairaudit.audit.completed", {
    case_id: "22222222-2222-2222-2222-222222222222",
    report_id: "rid",
    report_version: 1,
  });
  assert.equal(calls, 0);
  process.env.HAIRAUDIT_FI_EVENTS_ENABLED = prev;
  process.env.NODE_ENV = prevNode;
  setEventSink({ async emit() {} });
});
