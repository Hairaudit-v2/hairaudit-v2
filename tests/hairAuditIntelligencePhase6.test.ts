/**
 * HA-INTELLIGENCE-6 — contract hardening, auditor protection, write-back observability, force escape hatch.
 * Run: npx tsx --test tests/hairAuditIntelligencePhase6.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { UploadMetadataContract } from "@/lib/hairaudit/uploadContract";
import {
  isAuditorClassifierCorrectionAction,
  isAuditorClassifierProtected,
  markAuditorClassifierCorrection,
} from "@/lib/auditor/auditorClassifierCorrection.server";
import {
  mergeClassifierMetadataWriteback,
  shouldOverwriteClassifierField,
  writeBackClassifierMetadataForCompletedJob,
} from "@/lib/hairaudit-intelligence/shadow/classifierMetadataWriteback.server";
import {
  assertClassifierWritebackLogHasNoPii,
  buildClassifierWritebackLogPayload,
} from "@/lib/hairaudit-intelligence/shadow/classifierWritebackObservability.server";
import {
  assertPatientOutputDoesNotLeakIntelligence,
  collectPatientVisibleReportText,
} from "@/lib/hairaudit-intelligence/shadow/patientOutputSafety";
import { attachHairAuditIntelligenceToReportSummarySafeWithClassifier } from "@/lib/hairaudit-intelligence/shadow/inngestHairAuditIntelligence.server";
import { buildFiImageIntelligenceIdempotencyKey } from "@/lib/hairaudit/fiImageIntelligenceQueue";
import type { FiImageIntelligenceProcessedJobRecord } from "@/lib/hairaudit/fiImageIntelligencePersistence";
import { processFiImageIntelligenceJob } from "@/lib/hairaudit/fiImageIntelligenceWorker";
import { createMemoryFiImageIntelligencePersistence } from "@/lib/hairaudit/fiImageIntelligencePersistence";
import type { FiImageIntelligenceJobPayload } from "@/lib/hairaudit/fiImageIntelligenceQueue";

const CASE_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const UPLOAD_A = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

function makeCompletedFiJob(result: Record<string, unknown>): FiImageIntelligenceProcessedJobRecord {
  return {
    id: "job-phase6-1",
    idempotency_key: buildFiImageIntelligenceIdempotencyKey(CASE_ID, UPLOAD_A),
    case_id: CASE_ID,
    upload_id: UPLOAD_A,
    event_name: "hairaudit/fi.image-intelligence.enqueue",
    source_system: "hairaudit",
    status: "completed",
    result: result as FiImageIntelligenceProcessedJobRecord["result"],
    error_message: null,
    processed_at: "2026-06-19T12:00:00.000Z",
    created_at: "2026-06-19T12:00:00.000Z",
    updated_at: "2026-06-19T12:00:00.000Z",
  };
}

function makeFiResult(overrides: Record<string, unknown> = {}) {
  return {
    classification_status: "classified",
    canonical_photo_category: "preop_crown",
    confidence: 0.91,
    quality_status: "acceptable",
    protocol_status: "compliant",
    model_provider: "fi_os",
    model_version: "stub-v1",
    processed_at: "2026-06-19T12:00:00.000Z",
    dry_run: false,
    idempotency_key: buildFiImageIntelligenceIdempotencyKey(CASE_ID, UPLOAD_A),
    source_case_id: CASE_ID,
    source_upload_id: UPLOAD_A,
    image_fetch_status: "ok",
    image_content_type: "image/jpeg",
    image_size_bytes: 12000,
    classification_source: "fi_os",
    classification_notes: "",
    ...overrides,
  };
}

function buildWorkerPayload(): FiImageIntelligenceJobPayload {
  const idempotency_key = buildFiImageIntelligenceIdempotencyKey(CASE_ID, UPLOAD_A);
  return {
    idempotency_key,
    enqueued_at: "2026-06-19T12:00:00.000Z",
    input: {
      source_system: "hairaudit",
      source_event_name: "hairaudit.upload.created",
      source_case_id: CASE_ID,
      source_upload_id: UPLOAD_A,
      actor_type: "patient",
      upload_surface: "forensic_audit",
      storage_bucket: "case-files",
      storage_path: `cases/${CASE_ID}/patient/front/1.jpg`,
      canonical_photo_category: "patient_current_front",
      legacy_upload_type: "patient_photo:front",
      metadata_version: "1",
      occurred_at: "2026-06-19T12:00:00.000Z",
    },
  };
}

describe("HA-INTELLIGENCE-6 UploadMetadataContract", () => {
  it("accepts classifier extension fields on the contract type", () => {
    const metadata: Pick<
      UploadMetadataContract,
      | "fi_quality_status_raw"
      | "fi_protocol_status_raw"
      | "classifier_source"
      | "classifier_synced_at"
      | "corrected_at"
      | "quality_checks"
      | "protocol_deviation_notes"
    > = {
      fi_quality_status_raw: "acceptable",
      fi_protocol_status_raw: "minor_deviation",
      classifier_source: "fi_os",
      classifier_synced_at: "2026-06-19T12:00:00.000Z",
      corrected_at: "2026-06-19T11:00:00.000Z",
      quality_checks: { overall: "pass" },
      protocol_deviation_notes: "Angle deviation noted.",
    };

    assert.equal(metadata.classifier_source, "fi_os");
    assert.ok(metadata.corrected_at);
    assert.equal(metadata.quality_checks?.overall, "pass");
  });
});

describe("HA-INTELLIGENCE-6 auditor correction stamping", () => {
  it("recognizes auditor correction actions", () => {
    assert.equal(isAuditorClassifierCorrectionAction("reassign"), true);
    assert.equal(isAuditorClassifierCorrectionAction("rename"), true);
    assert.equal(isAuditorClassifierCorrectionAction("exclude"), true);
    assert.equal(isAuditorClassifierCorrectionAction("restore"), true);
    assert.equal(isAuditorClassifierCorrectionAction("delete"), false);
  });

  it("stamps rename/exclude/restore metadata with auditor markers", () => {
    for (const action of ["rename", "exclude", "restore"] as const) {
      const marked = markAuditorClassifierCorrection({ display_name: action, audit_excluded: action === "exclude" });
      assert.equal(marked.classifier_source, "auditor");
      assert.ok(marked.corrected_at);
    }
  });

  it("detects auditor-protected metadata via source or corrected_at", () => {
    assert.equal(isAuditorClassifierProtected({ classifier_source: "auditor" }), true);
    assert.equal(isAuditorClassifierProtected({ corrected_at: "2026-06-19T10:00:00.000Z" }), true);
    assert.equal(isAuditorClassifierProtected({ classifier_source: "fi_os" }), false);
  });
});

describe("HA-INTELLIGENCE-6 auditor-protected write-back", () => {
  it("does not overwrite auditor-protected classifier fields", () => {
    const existing = markAuditorClassifierCorrection({
      ai_detected_category: "preop_front",
      ai_classification_confidence: 0.95,
      photo_quality_status: "pass",
      photo_protocol_status: "compliant",
      fi_quality_status_raw: "good",
      fi_protocol_status_raw: "compliant",
      quality_checks: { overall: "pass" },
      protocol_deviation_notes: "Auditor note",
      classifier_synced_at: "2026-06-19T10:00:00.000Z",
    }) as Record<string, unknown>;

    const patch = {
      ai_detected_category: "preop_crown",
      ai_classification_confidence: 0.99,
      photo_quality_status: "fail",
      photo_protocol_status: "non_compliant",
      classifier_source: "fi_os",
      classifier_synced_at: "2026-06-19T13:00:00.000Z",
      fi_quality_status_raw: "poor",
      fi_protocol_status_raw: "non_compliant",
      quality_checks: { overall: "fail" },
      protocol_deviation_notes: "FI deviation note",
    };

    for (const field of Object.keys(patch) as Array<keyof typeof patch>) {
      assert.equal(
        shouldOverwriteClassifierField({
          field,
          existingMetadata: existing,
          incomingValue: patch[field],
          incomingConfidence: 0.99,
        }),
        false,
        `expected no overwrite for protected field ${String(field)}`
      );
    }

    const merged = mergeClassifierMetadataWriteback({
      existingMetadata: existing,
      patch,
      incomingConfidence: 0.99,
    });

    assert.equal(merged.ai_detected_category, "preop_front");
    assert.equal(merged.classifier_source, "auditor");
    assert.equal(merged.fi_quality_status_raw, "good");
  });

  it("force write-back overwrites auditor-protected metadata when explicitly enabled", () => {
    const existing = markAuditorClassifierCorrection({
      ai_detected_category: "preop_front",
      ai_classification_confidence: 0.95,
      photo_quality_status: "pass",
    }) as Record<string, unknown>;

    const merged = mergeClassifierMetadataWriteback({
      existingMetadata: existing,
      patch: {
        ai_detected_category: "preop_crown",
        ai_classification_confidence: 0.91,
        photo_quality_status: "fail",
        classifier_source: "fi_os",
        classifier_synced_at: "2026-06-19T13:00:00.000Z",
      },
      incomingConfidence: 0.91,
      forceClassifierWriteback: true,
    });

    assert.equal(merged.ai_detected_category, "preop_crown");
    assert.equal(merged.classifier_source, "fi_os");
    assert.equal(merged.photo_quality_status, "fail");
  });

  it("worker write-back skips protected rows without force when classifier fields are complete", async () => {
    const existing = markAuditorClassifierCorrection({
      ai_detected_category: "preop_front",
      ai_classification_confidence: 0.95,
      photo_quality_status: "pass",
      photo_protocol_status: "compliant",
      fi_quality_status_raw: "good",
      fi_protocol_status_raw: "compliant",
      quality_checks: { overall: "pass" },
      classifier_synced_at: "2026-06-19T10:00:00.000Z",
    });

    const result = await writeBackClassifierMetadataForCompletedJob({
      job: makeCompletedFiJob(makeFiResult()),
      existingMetadata: existing as Record<string, unknown>,
      adapter: {
        async updateUploadMetadata() {
          return { ok: true };
        },
      },
    });

    assert.equal(result.outcome, "skipped");
    assert.equal(result.protectedByAuditorCorrection, true);
    assert.equal(result.fieldsAppliedCount, 0);
  });
});

describe("HA-INTELLIGENCE-6 write-back observability", () => {
  it("builds non-PII structured write-back log payload", () => {
    const payload = buildClassifierWritebackLogPayload({
      caseId: CASE_ID,
      uploadId: UPLOAD_A,
      outcome: "success",
      fieldsAppliedCount: 4,
      protectedByAuditorCorrection: false,
      durationMs: 18,
    });

    assert.equal(payload.tag, "image-classifier-writeback");
    assert.equal(payload.caseIdPresent, true);
    assert.equal(payload.uploadIdPresent, true);
    assert.equal(payload.outcome, "success");
    assert.equal(payload.fieldsAppliedCount, 4);
    assertClassifierWritebackLogHasNoPii(payload);
    assert.doesNotMatch(JSON.stringify(payload), /a0eebc99/);
    assert.doesNotMatch(JSON.stringify(payload), /d0eebc99/);
  });

  it("worker logs success/skipped/failed outcomes without PII", async () => {
    const logs: Array<Record<string, unknown>> = [];
    const persistence = createMemoryFiImageIntelligencePersistence();

    await processFiImageIntelligenceJob(buildWorkerPayload(), {
      workerEnabled: true,
      classifierProvider: "manual_stub",
      persistence,
      uploadMetadataWriter: {
        async updateUploadMetadata(_uploadId, metadata) {
          return { ok: true };
        },
        async getUploadMetadata() {
          return markAuditorClassifierCorrection({
            ai_detected_category: "preop_front",
            ai_classification_confidence: 0.95,
            photo_quality_status: "pass",
            photo_protocol_status: "compliant",
            fi_quality_status_raw: "good",
            fi_protocol_status_raw: "compliant",
            quality_checks: { overall: "pass" },
            classifier_synced_at: "2026-06-19T10:00:00.000Z",
          }) as Record<string, unknown>;
        },
      },
      logger: {
        info(_msg, meta) {
          if (meta?.tag === "image-classifier-writeback") logs.push(meta);
        },
      },
    });

    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.outcome, "skipped");
    assert.equal(logs[0]?.protectedByAuditorCorrection, true);
    assertClassifierWritebackLogHasNoPii(logs[0] as ReturnType<typeof buildClassifierWritebackLogPayload>);

    logs.length = 0;
    await processFiImageIntelligenceJob(buildWorkerPayload(), {
      workerEnabled: true,
      classifierProvider: "manual_stub",
      persistence: createMemoryFiImageIntelligencePersistence(),
      uploadMetadataWriter: {
        async updateUploadMetadata() {
          return { ok: true };
        },
        async getUploadMetadata() {
          return {};
        },
      },
      logger: {
        info(_msg, meta) {
          if (meta?.tag === "image-classifier-writeback") logs.push(meta);
        },
      },
    });

    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.outcome, "success");
    assert.equal(logs[0]?.fieldsAppliedCount as number > 0, true);

    logs.length = 0;
    await processFiImageIntelligenceJob(buildWorkerPayload(), {
      workerEnabled: true,
      classifierProvider: "manual_stub",
      persistence: createMemoryFiImageIntelligencePersistence(),
      uploadMetadataWriter: {
        async updateUploadMetadata() {
          return { ok: false, error: "db unavailable" };
        },
      },
      logger: {
        info(_msg, meta) {
          if (meta?.tag === "image-classifier-writeback") logs.push(meta);
        },
      },
    });

    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.outcome, "failed");
  });
});

describe("HA-INTELLIGENCE-6 patient output safety", () => {
  it("patient output remains clean after attach with classifier metadata", async () => {
    const fiJob = makeCompletedFiJob(makeFiResult());
    const { summary } = await attachHairAuditIntelligenceToReportSummarySafeWithClassifier({
      summary: { score: 70, metadata: { pipelineStage: "audit_complete" } },
      caseId: CASE_ID,
      uploads: [{ id: UPLOAD_A, type: "patient_photo:preop_front" }],
      logger: { info() {}, warn() {} },
      fiPersistence: {
        async findProcessedJobByIdempotencyKey() {
          return fiJob;
        },
        async findProcessedJobsByIdempotencyKeys() {
          return [fiJob];
        },
        async markJobProcessing() {
          return { ok: false, error: "noop" };
        },
        async markJobCompleted() {
          return { ok: false, error: "noop" };
        },
        async markJobFailed() {
          return { ok: false, error: "noop" };
        },
      },
    });

    const visible = collectPatientVisibleReportText(summary);
    assert.doesNotMatch(visible, /classifier_source/i);
    assert.doesNotMatch(visible, /corrected_at/i);
    assert.doesNotMatch(visible, /fi_quality_status_raw/i);
    assertPatientOutputDoesNotLeakIntelligence(summary);
  });
});
