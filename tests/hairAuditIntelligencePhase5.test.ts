/**
 * HA-INTELLIGENCE-5 — worker write-back, batched FI lookup, status normalization, auditor protection.
 * Run: npx tsx --test tests/hairAuditIntelligencePhase5.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { markAuditorClassifierCorrection } from "@/lib/auditor/auditorClassifierCorrection.server";
import {
  buildClassifierByUploadId,
  loadCompletedFiJobsForUploads,
  mapFiJobToClassifierRef,
} from "@/lib/hairaudit-intelligence/shadow/classifierEnrichment.server";
import {
  buildClassifierMetadataPatchFromFiJob,
  mergeClassifierMetadataWriteback,
  writeBackClassifierMetadataForCompletedJob,
} from "@/lib/hairaudit-intelligence/shadow/classifierMetadataWriteback.server";
import {
  normalizeFiClassifierStatuses,
  normalizeFiProtocolStatusToUploadContract,
  normalizeFiQualityStatusToUploadContract,
} from "@/lib/hairaudit-intelligence/shadow/classifierStatusNormalization.server";
import { attachHairAuditIntelligenceToReportSummarySafeWithClassifier } from "@/lib/hairaudit-intelligence/shadow/inngestHairAuditIntelligence.server";
import {
  assertPatientOutputDoesNotLeakIntelligence,
  collectPatientVisibleReportText,
} from "@/lib/hairaudit-intelligence/shadow/patientOutputSafety";
import {
  createMemoryFiImageIntelligencePersistence,
  markJobCompleted,
  markJobProcessing,
} from "@/lib/hairaudit/fiImageIntelligencePersistence";
import { buildFiImageIntelligenceIdempotencyKey } from "@/lib/hairaudit/fiImageIntelligenceQueue";
import type { FiImageIntelligenceProcessedJobRecord } from "@/lib/hairaudit/fiImageIntelligencePersistence";
import { processFiImageIntelligenceJob } from "@/lib/hairaudit/fiImageIntelligenceWorker";
import type { FiImageIntelligenceJobPayload } from "@/lib/hairaudit/fiImageIntelligenceQueue";

const CASE_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const UPLOAD_A = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const UPLOAD_B = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a45";
const UPLOAD_C = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a46";

function makeCompletedFiJob(
  uploadId: string,
  result: Record<string, unknown>
): FiImageIntelligenceProcessedJobRecord {
  return {
    id: `job-${uploadId}`,
    idempotency_key: buildFiImageIntelligenceIdempotencyKey(CASE_ID, uploadId),
    case_id: CASE_ID,
    upload_id: uploadId,
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

function makeFiResult(uploadId: string, overrides: Record<string, unknown> = {}) {
  return {
    classification_status: "classified",
    canonical_photo_category: "preop_crown",
    confidence: 0.88,
    quality_status: "acceptable",
    protocol_status: "compliant",
    model_provider: "fi_os",
    model_version: "stub-v1",
    processed_at: "2026-06-19T12:00:00.000Z",
    dry_run: false,
    idempotency_key: buildFiImageIntelligenceIdempotencyKey(CASE_ID, uploadId),
    source_case_id: CASE_ID,
    source_upload_id: uploadId,
    image_fetch_status: "ok",
    image_content_type: "image/jpeg",
    image_size_bytes: 12000,
    classification_source: "fi_os",
    classification_notes: "",
    ...overrides,
  };
}

function buildWorkerPayload(uploadId: string): FiImageIntelligenceJobPayload {
  const idempotency_key = buildFiImageIntelligenceIdempotencyKey(CASE_ID, uploadId);
  return {
    idempotency_key,
    enqueued_at: "2026-06-19T12:00:00.000Z",
    input: {
      source_system: "hairaudit",
      source_event_name: "hairaudit.upload.created",
      source_case_id: CASE_ID,
      source_upload_id: uploadId,
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

describe("HA-INTELLIGENCE-5 status normalization", () => {
  it("maps FI quality vocabulary into upload metadata contract", () => {
    assert.equal(normalizeFiQualityStatusToUploadContract("excellent"), "pass");
    assert.equal(normalizeFiQualityStatusToUploadContract("good"), "pass");
    assert.equal(normalizeFiQualityStatusToUploadContract("acceptable"), "pass");
    assert.equal(normalizeFiQualityStatusToUploadContract("minor_deviation"), "warn");
    assert.equal(normalizeFiQualityStatusToUploadContract("warn"), "warn");
    assert.equal(normalizeFiQualityStatusToUploadContract("low"), "fail");
    assert.equal(normalizeFiQualityStatusToUploadContract("poor"), "fail");
    assert.equal(normalizeFiQualityStatusToUploadContract("unacceptable"), "fail");
    assert.equal(normalizeFiQualityStatusToUploadContract("missing_required_view"), "fail");
  });

  it("maps FI protocol vocabulary into upload metadata contract", () => {
    assert.equal(normalizeFiProtocolStatusToUploadContract("compliant"), "compliant");
    assert.equal(normalizeFiProtocolStatusToUploadContract("minor_deviation"), "minor_deviation");
    assert.equal(normalizeFiProtocolStatusToUploadContract("major_deviation"), "major_deviation");
    assert.equal(normalizeFiProtocolStatusToUploadContract("non_compliant"), "non_compliant");
    assert.equal(normalizeFiProtocolStatusToUploadContract("missing_required_view"), "major_deviation");
  });

  it("preserves original raw FI values in normalization helper", () => {
    const normalized = normalizeFiClassifierStatuses({
      qualityStatus: "acceptable",
      protocolStatus: "minor_deviation",
    });
    assert.equal(normalized.qualityStatus, "pass");
    assert.equal(normalized.protocolStatus, "minor_deviation");
    assert.equal(normalized.qualityStatusRaw, "acceptable");
    assert.equal(normalized.protocolStatusRaw, "minor_deviation");
  });

  it("write-back patch stores normalized contract values and raw FI tokens", () => {
    const patch = buildClassifierMetadataPatchFromFiJob(
      makeCompletedFiJob(UPLOAD_A, makeFiResult(UPLOAD_A, { quality_status: "good", protocol_status: "warn" }))
    )!.patch;

    assert.equal(patch.photo_quality_status, "pass");
    assert.equal(patch.photo_protocol_status, "minor_deviation");
    assert.equal(patch.fi_quality_status_raw, "good");
    assert.equal(patch.fi_protocol_status_raw, "warn");
  });
});

describe("HA-INTELLIGENCE-5 batched FI lookup", () => {
  it("returns completed jobs for partial idempotency key matches", async () => {
    const adapter = createMemoryFiImageIntelligencePersistence();
    const keyA = buildFiImageIntelligenceIdempotencyKey(CASE_ID, UPLOAD_A);
    const keyB = buildFiImageIntelligenceIdempotencyKey(CASE_ID, UPLOAD_B);

    await markJobProcessing(
      {
        idempotency_key: keyA,
        case_id: CASE_ID,
        upload_id: UPLOAD_A,
        event_name: "hairaudit/fi.image-intelligence.enqueue",
      },
      adapter
    );
    await markJobCompleted(
      {
        idempotency_key: keyA,
        result: makeFiResult(UPLOAD_A, { canonical_photo_category: "preop_front" }),
      },
      adapter
    );
    await markJobProcessing(
      {
        idempotency_key: keyB,
        case_id: CASE_ID,
        upload_id: UPLOAD_B,
        event_name: "hairaudit/fi.image-intelligence.enqueue",
      },
      adapter
    );
    await markJobCompleted(
      {
        idempotency_key: keyB,
        result: makeFiResult(UPLOAD_B, { canonical_photo_category: "preop_crown" }),
      },
      adapter
    );

    const jobs = await loadCompletedFiJobsForUploads({
      caseId: CASE_ID,
      uploadIds: [UPLOAD_A, UPLOAD_B, UPLOAD_C],
      persistence: adapter,
    });

    assert.equal(jobs.length, 2);
    const uploadIds = new Set(jobs.map((job) => job.upload_id));
    assert.ok(uploadIds.has(UPLOAD_A));
    assert.ok(uploadIds.has(UPLOAD_B));
    assert.equal(uploadIds.has(UPLOAD_C), false);
  });

  it("falls back to upload metadata when FI rows are missing", () => {
    const job = makeCompletedFiJob(UPLOAD_A, makeFiResult(UPLOAD_A));
    const { classifierByUploadId, classifierSource } = buildClassifierByUploadId({
      uploads: [
        {
          id: UPLOAD_B,
          metadata: {
            ai_detected_category: "preop_front",
            photo_quality_status: "pass",
            photo_protocol_status: "compliant",
            ai_classification_confidence: 0.7,
          },
        },
      ],
      fiCompletedJobs: [job],
    });

    assert.equal(classifierSource, "fi_and_upload_metadata");
    assert.equal(classifierByUploadId[UPLOAD_A]?.canonicalPhotoCategory, "preop_crown");
    assert.equal(classifierByUploadId[UPLOAD_B]?.canonicalPhotoCategory, "preop_front");
    assert.equal(classifierByUploadId[UPLOAD_B]?.qualityStatus, "pass");
  });

  it("keeps FI priority over upload metadata for the same upload", () => {
    const job = makeCompletedFiJob(
      UPLOAD_A,
      makeFiResult(UPLOAD_A, { canonical_photo_category: "preop_crown", quality_status: "good" })
    );
    const ref = mapFiJobToClassifierRef(job);
    assert.equal(ref?.qualityStatus, "pass");

    const { classifierByUploadId } = buildClassifierByUploadId({
      uploads: [
        {
          id: UPLOAD_A,
          metadata: {
            ai_detected_category: "preop_front",
            photo_quality_status: "fail",
          },
        },
      ],
      fiCompletedJobs: [job],
    });

    assert.equal(classifierByUploadId[UPLOAD_A]?.canonicalPhotoCategory, "preop_crown");
    assert.equal(classifierByUploadId[UPLOAD_A]?.qualityStatus, "pass");
  });
});

describe("HA-INTELLIGENCE-5 worker write-back", () => {
  it("attempts metadata write-back when classification completes", async () => {
    const writes: Array<{ uploadId: string; metadata: Record<string, unknown> }> = [];
    const persistence = createMemoryFiImageIntelligencePersistence();

    const outcome = await processFiImageIntelligenceJob(buildWorkerPayload(UPLOAD_A), {
      workerEnabled: true,
      classifierProvider: "manual_stub",
      persistence,
      uploadMetadataWriter: {
        async updateUploadMetadata(uploadId, metadata) {
          writes.push({ uploadId, metadata });
          return { ok: true };
        },
      },
    });

    assert.equal(outcome.status, "classified");
    assert.equal(writes.length, 1);
    assert.equal(writes[0]?.uploadId, UPLOAD_A);
    assert.equal(writes[0]?.metadata.ai_detected_category, "front");
    assert.ok(writes[0]?.metadata.classifier_synced_at);
  });

  it("does not fail classification job when write-back fails", async () => {
    const persistence = createMemoryFiImageIntelligencePersistence();

    const outcome = await processFiImageIntelligenceJob(buildWorkerPayload(UPLOAD_A), {
      workerEnabled: true,
      classifierProvider: "manual_stub",
      persistence,
      uploadMetadataWriter: {
        async updateUploadMetadata() {
          return { ok: false, error: "db unavailable" };
        },
      },
    });

    assert.equal(outcome.status, "classified");
    assert.ok(outcome.result);
  });
});

describe("HA-INTELLIGENCE-5 auditor correction protection", () => {
  it("marks auditor reassignment metadata with classifier_source auditor", () => {
    const marked = markAuditorClassifierCorrection({
      category: "preop_front",
      display_name: "Front",
    });

    assert.equal(marked.classifier_source, "auditor");
    assert.ok(marked.corrected_at);
    assert.equal(marked.category, "preop_front");
    assert.equal(marked.display_name, "Front");
  });

  it("does not overwrite auditor correction during FI write-back", () => {
    const existing = {
      ai_detected_category: "preop_front",
      ai_classification_confidence: 0.95,
      photo_quality_status: "pass",
      classifier_source: "auditor",
      corrected_at: "2026-06-19T10:00:00.000Z",
    };

    const merged = mergeClassifierMetadataWriteback({
      existingMetadata: existing,
      patch: buildClassifierMetadataPatchFromFiJob(
        makeCompletedFiJob(UPLOAD_A, makeFiResult(UPLOAD_A, { confidence: 0.88 }))
      )!.patch,
      incomingConfidence: 0.88,
    });

    assert.equal(merged.ai_detected_category, "preop_front");
    assert.equal(merged.ai_classification_confidence, 0.95);
    assert.equal(merged.classifier_source, "auditor");
    assert.equal(merged.corrected_at, "2026-06-19T10:00:00.000Z");
    assert.equal(merged.fi_quality_status_raw, "acceptable");
  });

  it("worker write-back respects auditor correction markers", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const existing = markAuditorClassifierCorrection({
      ai_detected_category: "preop_front",
      ai_classification_confidence: 0.95,
      photo_quality_status: "pass",
    });

    await writeBackClassifierMetadataForCompletedJob({
      job: makeCompletedFiJob(UPLOAD_A, makeFiResult(UPLOAD_A, { confidence: 0.8 })),
      existingMetadata: existing,
      adapter: {
        async updateUploadMetadata(_uploadId, metadata) {
          writes.push(metadata);
          return { ok: true };
        },
      },
    });

    assert.equal(writes.length, 1);
    assert.equal(writes[0]?.ai_detected_category, "preop_front");
    assert.equal(writes[0]?.classifier_source, "auditor");
    assert.equal(writes[0]?.fi_quality_status_raw, "acceptable");
  });
});

describe("HA-INTELLIGENCE-5 patient output safety", () => {
  it("patient output remains clean after classifier attach with normalized metadata", async () => {
    const fiJob = makeCompletedFiJob(UPLOAD_A, makeFiResult(UPLOAD_A));
    const adapter = createMemoryFiImageIntelligencePersistence();

    const { summary } = await attachHairAuditIntelligenceToReportSummarySafeWithClassifier({
      summary: { score: 70, metadata: { pipelineStage: "audit_complete" } },
      caseId: CASE_ID,
      uploads: [{ id: UPLOAD_A, type: "patient_photo:preop_front" }],
      logger: { info() {}, warn() {} },
      fiPersistence: adapter,
      uploadMetadataWriter: {
        async updateUploadMetadata() {
          return { ok: true };
        },
      },
    });

    // Seed FI job after attach for classifier resolution in a second pass
    const key = buildFiImageIntelligenceIdempotencyKey(CASE_ID, UPLOAD_A);
    await markJobProcessing(
      {
        idempotency_key: key,
        case_id: CASE_ID,
        upload_id: UPLOAD_A,
        event_name: "hairaudit/fi.image-intelligence.enqueue",
      },
      adapter
    );
    await markJobCompleted({ idempotency_key: key, result: makeFiResult(UPLOAD_A) }, adapter);

    const { summary: enrichedSummary } =
      await attachHairAuditIntelligenceToReportSummarySafeWithClassifier({
        summary,
        caseId: CASE_ID,
        uploads: [{ id: UPLOAD_A, type: "patient_photo:preop_front" }],
        logger: { info() {}, warn() {} },
        fiPersistence: adapter,
      });

    const visible = collectPatientVisibleReportText(enrichedSummary);
    assert.doesNotMatch(visible, /classifier_source/i);
    assert.doesNotMatch(visible, /fi_quality_status_raw/i);
    assert.doesNotMatch(visible, /fi_protocol_status_raw/i);
    assert.doesNotMatch(visible, /corrected_at/i);
    assertPatientOutputDoesNotLeakIntelligence(enrichedSummary);
  });
});
