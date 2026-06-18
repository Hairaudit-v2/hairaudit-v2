/**
 * HA-INTELLIGENCE-4 — classifier metadata write-back, observability, and signal tests.
 * Run: npx tsx --test tests/hairAuditIntelligenceWriteback.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  runHairAuditIntelligenceFromLegacyArtifacts,
  runHairLossClassificationEngine,
} from "@/lib/hairaudit-intelligence";
import {
  buildClassifierMetadataPatchFromFiJob,
  mergeClassifierMetadataWriteback,
  shouldOverwriteClassifierField,
  writeBackClassifierResultsToUploadMetadata,
} from "@/lib/hairaudit-intelligence/shadow/classifierMetadataWriteback.server";
import {
  assertIntelligenceEnrichmentLogHasNoPii,
  buildIntelligenceEnrichmentLogPayload,
} from "@/lib/hairaudit-intelligence/shadow/intelligenceEnrichmentObservability.server";
import { attachHairAuditIntelligenceToReportSummarySafeWithClassifier } from "@/lib/hairaudit-intelligence/shadow/inngestHairAuditIntelligence.server";
import {
  assertPatientOutputDoesNotLeakIntelligence,
  collectPatientVisibleReportText,
} from "@/lib/hairaudit-intelligence/shadow/patientOutputSafety";
import { refineEngineSignalsFromClassifier } from "@/lib/hairaudit-intelligence/shared";
import { buildFiImageIntelligenceIdempotencyKey } from "@/lib/hairaudit/fiImageIntelligenceQueue";
import type { FiImageIntelligenceProcessedJobRecord } from "@/lib/hairaudit/fiImageIntelligencePersistence";

const CASE_ID = "case-writeback-1";
const UPLOAD_ID = "upload-writeback-1";

function makeCompletedFiJob(
  result: Record<string, unknown>,
  uploadId = UPLOAD_ID
): FiImageIntelligenceProcessedJobRecord {
  return {
    id: "job-writeback-1",
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

function makeFiResult(overrides: Record<string, unknown> = {}) {
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
    idempotency_key: buildFiImageIntelligenceIdempotencyKey(CASE_ID, UPLOAD_ID),
    source_case_id: CASE_ID,
    source_upload_id: UPLOAD_ID,
    image_fetch_status: "ok",
    image_content_type: "image/jpeg",
    image_size_bytes: 12000,
    classification_source: "fi_persisted_jobs",
    classification_notes: "",
    ...overrides,
  };
}

describe("HA-INTELLIGENCE-4 classifier metadata write-back", () => {
  it("preserves existing unrelated metadata during merge", () => {
    const existing = {
      category: "preop_front",
      audit_excluded: false,
      compression_applied: true,
      display_name: "Front baseline",
    };
    const patch = buildClassifierMetadataPatchFromFiJob(makeCompletedFiJob(makeFiResult()))!.patch;

    const merged = mergeClassifierMetadataWriteback({
      existingMetadata: existing,
      patch,
      incomingConfidence: 0.88,
    });

    assert.equal(merged.category, "preop_front");
    assert.equal(merged.audit_excluded, false);
    assert.equal(merged.compression_applied, true);
    assert.equal(merged.display_name, "Front baseline");
    assert.equal(merged.ai_detected_category, "preop_crown");
    assert.equal(merged.ai_classification_confidence, 0.88);
    assert.equal(merged.classifier_source, "fi_persisted_jobs");
    assert.ok(merged.classifier_synced_at);
  });

  it("does not overwrite manual metadata when FI confidence is not stronger", () => {
    const existing = {
      ai_detected_category: "preop_front",
      ai_classification_confidence: 0.95,
      photo_quality_status: "good",
      classifier_source: "auditor",
    };

    assert.equal(
      shouldOverwriteClassifierField({
        field: "ai_detected_category",
        existingMetadata: existing,
        incomingValue: "preop_crown",
        incomingConfidence: 0.88,
      }),
      false
    );

    const merged = mergeClassifierMetadataWriteback({
      existingMetadata: existing,
      patch: {
        ai_detected_category: "preop_crown",
        ai_classification_confidence: 0.88,
        photo_quality_status: "acceptable",
        classifier_source: "fi_persisted_jobs",
        classifier_synced_at: "2026-06-19T13:00:00.000Z",
      },
      incomingConfidence: 0.88,
    });

    assert.equal(merged.ai_detected_category, "preop_front");
    assert.equal(merged.ai_classification_confidence, 0.95);
    assert.equal(merged.photo_quality_status, "good");
    assert.equal(merged.classifier_source, "auditor");
  });

  it("updates upload metadata when FI confidence is clearly stronger", () => {
    const existing = {
      ai_detected_category: "preop_front",
      ai_classification_confidence: 0.55,
      classifier_source: "upload_metadata",
    };

    const merged = mergeClassifierMetadataWriteback({
      existingMetadata: existing,
      patch: buildClassifierMetadataPatchFromFiJob(
        makeCompletedFiJob(makeFiResult({ confidence: 0.91, canonical_photo_category: "preop_crown" }))
      )!.patch,
      incomingConfidence: 0.91,
    });

    assert.equal(merged.ai_detected_category, "preop_crown");
    assert.equal(merged.ai_classification_confidence, 0.91);
    assert.equal(merged.classifier_source, "fi_persisted_jobs");
  });

  it("skips malformed classifier result during write-back", async () => {
    const writes: Array<{ uploadId: string; metadata: Record<string, unknown> }> = [];
    const result = await writeBackClassifierResultsToUploadMetadata({
      uploads: [{ id: UPLOAD_ID, metadata: { category: "preop_front" } }],
      fiCompletedJobs: [makeCompletedFiJob({ broken: true })],
      adapter: {
        async updateUploadMetadata(uploadId, metadata) {
          writes.push({ uploadId, metadata });
          return { ok: true };
        },
      },
    });

    assert.equal(result.applied, 0);
    assert.equal(result.skipped, 1);
    assert.equal(writes.length, 0);
  });

  it("write-back failure does not block intelligence attach", async () => {
    const { summary, attached, bundle } = await attachHairAuditIntelligenceToReportSummarySafeWithClassifier({
      summary: { score: 70, metadata: { pipelineStage: "audit_complete" } },
      caseId: CASE_ID,
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front", metadata: {} }],
      logger: {
        info() {},
        warn() {},
      },
      uploadMetadataWriter: {
        async updateUploadMetadata() {
          return { ok: false, error: "db unavailable" };
        },
      },
    });

    assert.equal(attached, true);
    assert.ok(bundle);
    const meta = summary.metadata as Record<string, unknown>;
    assert.ok(meta.hairAuditIntelligence);
  });

  it("observability log contains no PII or report text", () => {
    const payload = buildIntelligenceEnrichmentLogPayload({
      caseId: CASE_ID,
      uploadCount: 2,
      classifierByUploadId: {
        [UPLOAD_ID]: { canonicalPhotoCategory: "preop_crown", classifierConfidence: 0.8 },
      },
      classifierSource: "fi_persisted_jobs",
      engineVersion: "hairaudit.intelligence.v1",
      overallSeverity: "minor",
      overallConfidence: "low",
      durationMs: 42,
      outcome: "success",
      writeBack: { applied: 1, skipped: 0, failed: 0 },
    });

    assert.equal(payload.tag, "intelligence-enrichment");
    assert.equal(payload.caseIdPresent, true);
    assert.equal(payload.enrichedImageCount, 1);
    assertIntelligenceEnrichmentLogHasNoPii(payload);
    assert.doesNotMatch(JSON.stringify(payload), /case-writeback-1/);
    assert.doesNotMatch(JSON.stringify(payload), /upload-writeback-1/);
  });

  it("low-quality classifier input reduces confidence", () => {
    const input = {
      images: [
        {
          canonicalPhotoCategory: "preop_front",
          qualityStatus: "poor",
          protocolStatus: "compliant",
          classifierConfidence: 0.8,
        },
      ],
      reportFindings: [],
      metadata: { classifierEnriched: true },
    };

    const baseline = runHairLossClassificationEngine({
      ...input,
      images: [{ canonicalPhotoCategory: "preop_front", qualityStatus: "acceptable" }],
    });
    const lowQuality = runHairLossClassificationEngine(input);
    const order = ["very_low", "low", "moderate", "high"];
    assert.ok(order.indexOf(lowQuality.confidence) <= order.indexOf(baseline.confidence));
  });

  it("keeps rule_based_placeholder when no classifier metadata is available", async () => {
    const { bundle } = await attachHairAuditIntelligenceToReportSummarySafeWithClassifier({
      summary: { score: 70 },
      caseId: CASE_ID,
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front" }],
      logger: { info() {}, warn() {} },
    });

    assert.equal(bundle?.hairLossClassification.executionMode, "rule_based_placeholder");
  });

  it("classifier-enriched attach sets executionMode when FI metadata is supplied", async () => {
    const fiJob = makeCompletedFiJob(makeFiResult());
    const { bundle } = await attachHairAuditIntelligenceToReportSummarySafeWithClassifier({
      summary: { score: 70 },
      caseId: CASE_ID,
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front", metadata: {} }],
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
      uploadMetadataWriter: {
        async updateUploadMetadata() {
          return { ok: true };
        },
      },
    });

    assert.equal(
      bundle?.hairLossClassification.executionMode,
      "classifier_enriched_rule_based"
    );
    assert.equal(bundle?.classifierSource, "fi_persisted_jobs");
  });

  it("patient output remains clean after classifier attach", async () => {
    const fiJob = makeCompletedFiJob(makeFiResult());
    const { summary } = await attachHairAuditIntelligenceToReportSummarySafeWithClassifier({
      summary: { score: 70, metadata: { pipelineStage: "audit_complete" } },
      caseId: CASE_ID,
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front" }],
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
    assert.doesNotMatch(visible, /ai_detected_category/i);
    assert.doesNotMatch(visible, /classifier_synced_at/i);
    assertPatientOutputDoesNotLeakIntelligence(summary);
  });

  it("applies write-back through adapter when FI job is valid", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const result = await writeBackClassifierResultsToUploadMetadata({
      uploads: [{ id: UPLOAD_ID, metadata: { category: "preop_front", display_name: "Front" } }],
      fiCompletedJobs: [makeCompletedFiJob(makeFiResult())],
      adapter: {
        async updateUploadMetadata(_uploadId, metadata) {
          writes.push(metadata);
          return { ok: true };
        },
      },
    });

    assert.equal(result.applied, 1);
    assert.equal(writes.length, 1);
    assert.equal(writes[0]?.category, "preop_front");
    assert.equal(writes[0]?.display_name, "Front");
    assert.equal(writes[0]?.ai_detected_category, "preop_crown");
  });

  it("refineEngineSignalsFromClassifier boosts low confidence with strong classifier average", () => {
    const refined = refineEngineSignalsFromClassifier({
      confidence: "low",
      severity: "none",
      images: [
        { canonicalPhotoCategory: "preop_front", classifierConfidence: 0.82 },
        { canonicalPhotoCategory: "preop_crown", classifierConfidence: 0.79 },
      ],
    });
    assert.equal(refined.confidence, "moderate");
  });

  it("refineEngineSignalsFromClassifier downgrades confidence for missing protocol views", () => {
    const refined = refineEngineSignalsFromClassifier({
      confidence: "moderate",
      severity: "none",
      images: [
        {
          canonicalPhotoCategory: "preop_front",
          protocolStatus: "missing_required_view",
          classifierConfidence: 0.7,
        },
      ],
    });
    assert.equal(refined.confidence, "low");
  });
});

describe("HA-INTELLIGENCE-4 bundle confidence from legacy artifacts", () => {
  it("uses classifier enrichment in bundle when classifier map is provided", () => {
    const bundle = runHairAuditIntelligenceFromLegacyArtifacts({
      caseId: CASE_ID,
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front" }],
      classifierByUploadId: {
        [UPLOAD_ID]: {
          canonicalPhotoCategory: "preop_crown",
          classifierConfidence: 0.86,
          qualityStatus: "poor",
        },
      },
      classifierSource: "fi_persisted_jobs",
    });

    assert.equal(bundle.hairLossClassification.executionMode, "classifier_enriched_rule_based");
    assert.equal(bundle.classifierSource, "fi_persisted_jobs");
  });
});
