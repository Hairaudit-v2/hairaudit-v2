/**
 * HA-INTELLIGENCE-3 — classifier enrichment tests.
 * Run: npx tsx --test tests/hairAuditIntelligenceClassifierEnrichment.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapUploadsToIntelligenceImages,
  runHairAuditIntelligenceFromLegacyArtifacts,
} from "@/lib/hairaudit-intelligence";
import {
  buildClassifierByUploadId,
  mapFiJobToClassifierRef,
  mapUploadMetadataToClassifierRef,
  resolveClassifierByUploadIdForIntelligence,
} from "@/lib/hairaudit-intelligence/shadow/classifierEnrichment.server";
import { attachHairAuditIntelligenceToReportSummarySafe } from "@/lib/hairaudit-intelligence/shadow/inngestHairAuditIntelligence.server";
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

const CASE_ID = "case-classifier-1";
const UPLOAD_ID = "upload-front-1";

function makeCompletedFiJob(
  result: Record<string, unknown>
): FiImageIntelligenceProcessedJobRecord {
  return {
    id: "job-1",
    idempotency_key: buildFiImageIntelligenceIdempotencyKey(CASE_ID, UPLOAD_ID),
    case_id: CASE_ID,
    upload_id: UPLOAD_ID,
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

describe("HA-INTELLIGENCE-3 classifier enrichment", () => {
  it("returns empty classifier map when no classifier metadata exists", () => {
    const { classifierByUploadId, classifierSource } = buildClassifierByUploadId({
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front" }],
    });
    assert.deepEqual(classifierByUploadId, {});
    assert.equal(classifierSource, "none");
  });

  it("maps valid FI persisted job into classifierByUploadId", () => {
    const job = makeCompletedFiJob({
      classification_status: "classified",
      canonical_photo_category: "preop_crown",
      confidence: 0.82,
      quality_status: "acceptable",
      protocol_status: "minor_deviation",
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
      classification_source: "fi_os",
      classification_notes: "Crown view confirmed by FI classifier.",
    });

    const ref = mapFiJobToClassifierRef(job);
    assert.ok(ref);
    assert.equal(ref?.canonicalPhotoCategory, "preop_crown");
    assert.equal(ref?.qualityStatus, "pass");
    assert.equal(ref?.protocolStatus, "minor_deviation");
    assert.equal(ref?.classifierConfidence, 0.82);
    assert.ok(ref?.imageLimitations?.some((n) => n.includes("FI classifier")));

    const { classifierByUploadId, classifierSource } = buildClassifierByUploadId({
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front" }],
      fiCompletedJobs: [job],
    });
    assert.equal(classifierSource, "fi_persisted_jobs");
    assert.equal(classifierByUploadId[UPLOAD_ID]?.canonicalPhotoCategory, "preop_crown");
  });

  it("maps partial upload metadata when FI rows are absent", () => {
    const ref = mapUploadMetadataToClassifierRef({
      id: UPLOAD_ID,
      type: "patient_photo:preop_front",
      metadata: {
        ai_detected_category: "preop_front",
        ai_classification_confidence: 0.71,
        photo_quality_status: "acceptable",
        photo_protocol_status: "compliant",
      },
    });
    assert.ok(ref);
    assert.equal(ref?.canonicalPhotoCategory, "preop_front");
    assert.equal(ref?.classifierConfidence, 0.71);

    const { classifierByUploadId, classifierSource } = buildClassifierByUploadId({
      uploads: [
        {
          id: UPLOAD_ID,
          type: "patient_photo:preop_front",
          metadata: {
            ai_detected_category: "preop_front",
            ai_classification_confidence: 0.71,
            photo_quality_status: "acceptable",
          },
        },
      ],
    });
    assert.equal(classifierSource, "upload_metadata");
    assert.equal(classifierByUploadId[UPLOAD_ID]?.classifierConfidence, 0.71);
  });

  it("skips malformed FI job rows fail-safe", () => {
    const malformed = makeCompletedFiJob({ broken: true });
    assert.equal(mapFiJobToClassifierRef(malformed), null);

    const { classifierByUploadId } = buildClassifierByUploadId({
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front" }],
      fiCompletedJobs: [malformed],
    });
    assert.deepEqual(classifierByUploadId, {});
  });

  it("skips malformed upload metadata fail-safe", () => {
    assert.equal(
      mapUploadMetadataToClassifierRef({
        id: UPLOAD_ID,
        metadata: { ai_classification_confidence: "not-a-number" },
      }),
      null
    );
  });

  it("FI job metadata takes priority over upload metadata for same upload", () => {
    const job = makeCompletedFiJob({
      classification_status: "classified",
      canonical_photo_category: "preop_crown",
      confidence: 0.9,
      quality_status: "good",
      protocol_status: "compliant",
      processed_at: "2026-06-19T12:00:00.000Z",
      dry_run: false,
      idempotency_key: buildFiImageIntelligenceIdempotencyKey(CASE_ID, UPLOAD_ID),
      source_case_id: CASE_ID,
      source_upload_id: UPLOAD_ID,
      image_fetch_status: "ok",
      image_content_type: null,
      image_size_bytes: null,
      classification_source: "fi_os",
      classification_notes: "",
    });

    const { classifierByUploadId, classifierSource } = buildClassifierByUploadId({
      uploads: [
        {
          id: UPLOAD_ID,
          metadata: { ai_detected_category: "preop_front", photo_quality_status: "poor" },
        },
      ],
      fiCompletedJobs: [job],
    });

    assert.equal(classifierSource, "fi_and_upload_metadata");
    assert.equal(classifierByUploadId[UPLOAD_ID]?.canonicalPhotoCategory, "preop_crown");
    assert.equal(classifierByUploadId[UPLOAD_ID]?.qualityStatus, "pass");
  });

  it("populates IntelligenceImageRef fields via mapUploadsToIntelligenceImages", () => {
    const images = mapUploadsToIntelligenceImages(
      [{ id: UPLOAD_ID, type: "patient_photo:preop_front" }],
      {
        [UPLOAD_ID]: {
          canonicalPhotoCategory: "preop_crown",
          qualityStatus: "poor",
          protocolStatus: "angle_deviation",
          classifierConfidence: 0.66,
          imageLimitations: ["Classifier quality status: poor."],
        },
      }
    );
    assert.equal(images[0]?.canonicalPhotoCategory, "preop_crown");
    assert.equal(images[0]?.qualityStatus, "poor");
    assert.equal(images[0]?.protocolStatus, "angle_deviation");
    assert.equal(images[0]?.classifierConfidence, 0.66);
    assert.deepEqual(images[0]?.imageLimitations, ["Classifier quality status: poor."]);
  });

  it("sets classifier_enriched_rule_based execution mode when enrichment present", () => {
    const bundle = runHairAuditIntelligenceFromLegacyArtifacts({
      caseId: CASE_ID,
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front" }],
      classifierByUploadId: {
        [UPLOAD_ID]: {
          canonicalPhotoCategory: "preop_crown",
          classifierConfidence: 0.8,
        },
      },
      classifierSource: "fi_persisted_jobs",
    });

    assert.equal(
      bundle.hairLossClassification.executionMode,
      "classifier_enriched_rule_based"
    );
    assert.equal(bundle.classifierSource, "fi_persisted_jobs");
    assert.ok(bundle.imageEvidence?.length);
    assert.equal(bundle.imageEvidence?.[0]?.canonicalPhotoCategory, "preop_crown");
  });

  it("keeps rule_based_placeholder when classifier metadata is missing", () => {
    const bundle = runHairAuditIntelligenceFromLegacyArtifacts({
      caseId: CASE_ID,
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front" }],
    });
    assert.equal(bundle.hairLossClassification.executionMode, "rule_based_placeholder");
    assert.equal(bundle.classifierSource, "none");
  });

  it("does not expose classifier internals in patient-visible output", () => {
    const { summary } = attachHairAuditIntelligenceToReportSummarySafe({
      summary: { score: 70, metadata: { pipelineStage: "audit_complete" } },
      caseId: CASE_ID,
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front" }],
      generateBundle: () =>
        runHairAuditIntelligenceFromLegacyArtifacts({
          caseId: CASE_ID,
          uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front" }],
          classifierByUploadId: {
            [UPLOAD_ID]: {
              canonicalPhotoCategory: "preop_crown",
              classifierConfidence: 0.88,
              imageLimitations: ["FI classifier note — internal only"],
            },
          },
          classifierSource: "fi_persisted_jobs",
        }),
    });

    const visible = collectPatientVisibleReportText(summary);
    assert.doesNotMatch(visible, /classifierConfidence/i);
    assert.doesNotMatch(visible, /FI classifier/i);
    assert.doesNotMatch(visible, /imageEvidence/i);
    assertPatientOutputDoesNotLeakIntelligence(summary);
  });

  it("resolveClassifierByUploadIdForIntelligence loads FI rows from persistence adapter", async () => {
    const adapter = createMemoryFiImageIntelligencePersistence();
    const key = buildFiImageIntelligenceIdempotencyKey(CASE_ID, UPLOAD_ID);
    await markJobProcessing(
      {
        idempotency_key: key,
        case_id: CASE_ID,
        upload_id: UPLOAD_ID,
        event_name: "hairaudit/fi.image-intelligence.enqueue",
      },
      adapter
    );
    await markJobCompleted(
      {
        idempotency_key: key,
        result: {
          classification_status: "classified",
          canonical_photo_category: "preop_donor_rear",
          confidence: 0.75,
          quality_status: "acceptable",
          protocol_status: "compliant",
          model_provider: "dry_run",
          model_version: null,
          processed_at: "2026-06-19T12:00:00.000Z",
          dry_run: false,
          idempotency_key: key,
          source_case_id: CASE_ID,
          source_upload_id: UPLOAD_ID,
          image_fetch_status: "ok",
          image_content_type: "image/jpeg",
          image_size_bytes: 8000,
          classification_source: "dry_run",
          classification_notes: "Donor rear classified.",
        },
      },
      adapter
    );

    const resolved = await resolveClassifierByUploadIdForIntelligence({
      caseId: CASE_ID,
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_donor_rear" }],
      persistence: adapter,
    });
    assert.equal(resolved.classifierSource, "fi_persisted_jobs");
    assert.equal(
      resolved.classifierByUploadId[UPLOAD_ID]?.canonicalPhotoCategory,
      "preop_donor_rear"
    );
  });

  it("resolveClassifierByUploadIdForIntelligence returns empty map on resolver failure", async () => {
    const resolved = await resolveClassifierByUploadIdForIntelligence({
      caseId: CASE_ID,
      uploads: [{ id: UPLOAD_ID, type: "patient_photo:preop_front" }],
      persistence: {
        async findProcessedJobByIdempotencyKey() {
          throw new Error("db unavailable");
        },
        async findProcessedJobsByIdempotencyKeys() {
          throw new Error("db unavailable");
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
    assert.deepEqual(resolved.classifierByUploadId, {});
    assert.equal(resolved.classifierSource, "none");
  });
});
