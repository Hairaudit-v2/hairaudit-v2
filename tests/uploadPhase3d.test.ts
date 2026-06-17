import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  buildFiImageIntelligenceIdempotencyKey,
  type FiImageIntelligenceJobPayload,
} from "../src/lib/hairaudit/fiImageIntelligenceQueue";
import {
  classifyHairAuditImage,
  manualStubConfidenceForCategory,
  resolveFiImageClassifierProvider,
} from "../src/lib/hairaudit/fiImageClassifierAdapter";
import {
  fetchFiImageIntelligenceImage,
  isFiImageIntelligenceImageFetchEnabled,
} from "../src/lib/hairaudit/fiImageIntelligenceImageFetch";
import { createMemoryFiImageIntelligencePersistence } from "../src/lib/hairaudit/fiImageIntelligencePersistence";
import { findProcessedJobByIdempotencyKey } from "../src/lib/hairaudit/fiImageIntelligencePersistence";
import { buildDryRunFiImageIntelligenceResult } from "../src/lib/hairaudit/fiImageIntelligenceResult";
import { processFiImageIntelligenceJob } from "../src/lib/hairaudit/fiImageIntelligenceWorker";
import { runHairAuditEventReadinessChecks } from "../scripts/check-hairaudit-event-readiness.mjs";

const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

/** Minimal JPEG signature + padding (valid magic bytes only). */
function minimalJpegBuffer(extraBytes = 0): Buffer {
  const base = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  if (extraBytes <= 0) return base;
  return Buffer.concat([base, Buffer.alloc(extraBytes, 0x00)]);
}

function buildSampleJobPayload(
  overrides: Partial<FiImageIntelligenceJobPayload> = {}
): FiImageIntelligenceJobPayload {
  const idempotency_key =
    overrides.idempotency_key ??
    buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD);

  return {
    idempotency_key,
    enqueued_at: "2026-06-17T14:00:00.000Z",
    input: {
      source_system: "hairaudit",
      source_event_name: "hairaudit.upload.created",
      source_case_id: SAMPLE_CASE,
      source_upload_id: SAMPLE_UPLOAD,
      actor_type: "patient",
      upload_surface: "forensic_audit",
      storage_bucket: "case-files",
      storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
      canonical_photo_category: "patient_current_front",
      legacy_upload_type: "patient_photo:front",
      metadata_version: "1",
      occurred_at: "2026-06-17T13:55:00.000Z",
      ...overrides.input,
    },
    ...overrides,
  };
}

describe("upload phase 3d", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  describe("image fetch", () => {
    it("validates storage path belongs to case", async () => {
      const outcome = await fetchFiImageIntelligenceImage(
        {
          case_id: SAMPLE_CASE,
          storage_bucket: "case-files",
          storage_path: `cases/00000000-0000-4000-8000-000000000099/patient/front/1.jpg`,
        },
        { workerEnabled: true, fetchEnabled: true }
      );

      assert.strictEqual(outcome.ok, false);
      if (!outcome.ok) {
        assert.strictEqual(outcome.status, "failed");
        assert.ok(outcome.reason.includes("storage_path"));
      }
    });

    it("rejects mismatched storage bucket", async () => {
      const outcome = await fetchFiImageIntelligenceImage(
        {
          case_id: SAMPLE_CASE,
          storage_bucket: "wrong-bucket",
          storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
        },
        { workerEnabled: true, fetchEnabled: true }
      );

      assert.strictEqual(outcome.ok, false);
      if (!outcome.ok) {
        assert.strictEqual(outcome.status, "failed");
        assert.ok(outcome.reason.includes("storage_bucket"));
      }
    });

    it("skips fetch when worker is disabled", async () => {
      const outcome = await fetchFiImageIntelligenceImage(
        {
          case_id: SAMPLE_CASE,
          storage_bucket: "case-files",
          storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
        },
        { workerEnabled: false, fetchEnabled: true }
      );

      assert.strictEqual(outcome.ok, false);
      if (!outcome.ok) {
        assert.strictEqual(outcome.status, "skipped");
      }
    });

    it("fails safely on oversized image", async () => {
      const huge = minimalJpegBuffer(51 * 1024 * 1024);
      const outcome = await fetchFiImageIntelligenceImage(
        {
          case_id: SAMPLE_CASE,
          storage_bucket: "case-files",
          storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
        },
        {
          workerEnabled: true,
          fetchEnabled: true,
          maxBytes: 1024,
          downloadFn: async () => ({ ok: true, blob: new Blob([huge]) }),
        }
      );

      assert.strictEqual(outcome.ok, false);
      if (!outcome.ok) {
        assert.strictEqual(outcome.status, "failed");
        assert.ok(outcome.reason.includes("maximum"));
      }
    });

    it("fails safely on invalid content type", async () => {
      const pdfLike = Buffer.from("%PDF-1.4 fake content");
      const outcome = await fetchFiImageIntelligenceImage(
        {
          case_id: SAMPLE_CASE,
          storage_bucket: "case-files",
          storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
        },
        {
          workerEnabled: true,
          fetchEnabled: true,
          downloadFn: async () => ({ ok: true, blob: new Blob([pdfLike]) }),
        }
      );

      assert.strictEqual(outcome.ok, false);
      if (!outcome.ok) {
        assert.strictEqual(outcome.status, "failed");
        assert.ok(outcome.reason.includes("supported image"));
      }
    });

    it("returns metadata and buffer on successful fetch", async () => {
      const jpeg = minimalJpegBuffer(128);
      const outcome = await fetchFiImageIntelligenceImage(
        {
          case_id: SAMPLE_CASE,
          storage_bucket: "case-files",
          storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
        },
        {
          workerEnabled: true,
          fetchEnabled: true,
          downloadFn: async () => ({ ok: true, blob: new Blob([jpeg]) }),
        }
      );

      assert.strictEqual(outcome.ok, true);
      if (outcome.ok) {
        assert.strictEqual(outcome.status, "ok");
        assert.strictEqual(outcome.content_type, "image/jpeg");
        assert.strictEqual(outcome.size_bytes, jpeg.length);
        assert.ok(outcome.buffer.length > 0);
      }
    });
  });

  describe("classifier adapter", () => {
    it("defaults provider to dry_run", () => {
      delete process.env.HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER;
      assert.strictEqual(resolveFiImageClassifierProvider(), "dry_run");
    });

    it("dry_run returns placeholder without AI", async () => {
      const outcome = await classifyHairAuditImage(
        {
          idempotency_key: buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD),
          source_case_id: SAMPLE_CASE,
          source_upload_id: SAMPLE_UPLOAD,
          canonical_photo_category: "patient_current_front",
        },
        { provider: "dry_run" }
      );

      assert.strictEqual(outcome.ok, true);
      if (outcome.ok) {
        assert.strictEqual(outcome.result.classification_status, "dry_run");
        assert.strictEqual(outcome.result.dry_run, true);
        assert.strictEqual(outcome.result.classification_source, "dry_run");
        assert.strictEqual(outcome.result.image_fetch_status, "skipped");
      }
    });

    it("manual_stub returns category and confidence without AI", async () => {
      const outcome = await classifyHairAuditImage(
        {
          idempotency_key: buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD),
          source_case_id: SAMPLE_CASE,
          source_upload_id: SAMPLE_UPLOAD,
          canonical_photo_category: "other",
          legacy_upload_type: "patient_photo:front",
        },
        { provider: "manual_stub" }
      );

      assert.strictEqual(outcome.ok, true);
      if (outcome.ok) {
        assert.strictEqual(outcome.result.classification_status, "classified");
        assert.strictEqual(outcome.result.canonical_photo_category, "front");
        assert.strictEqual(outcome.result.classification_source, "manual_stub");
        assert.strictEqual(outcome.result.model_provider, "manual_stub");
        assert.ok(outcome.result.confidence != null);
        assert.ok(outcome.result.confidence >= 0.7 && outcome.result.confidence <= 0.95);
      }
    });

    it("manual_stub confidence is deterministic for a category", () => {
      const a = manualStubConfidenceForCategory("front");
      const b = manualStubConfidenceForCategory("front");
      assert.strictEqual(a, b);
    });

    it("fi_os fails safely when provider is not configured", async () => {
      const outcome = await classifyHairAuditImage(
        {
          idempotency_key: buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD),
          source_case_id: SAMPLE_CASE,
          source_upload_id: SAMPLE_UPLOAD,
          canonical_photo_category: "patient_current_front",
        },
        { provider: "fi_os" }
      );
      assert.strictEqual(outcome.ok, false);
      if (!outcome.ok) {
        assert.ok(outcome.reason.includes("not configured"));
      }
    });

    it("openai provider fails with not-implemented message", async () => {
      const outcome = await classifyHairAuditImage(
        {
          idempotency_key: buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD),
          source_case_id: SAMPLE_CASE,
          source_upload_id: SAMPLE_UPLOAD,
          canonical_photo_category: "patient_current_front",
        },
        { provider: "openai" }
      );
      assert.strictEqual(outcome.ok, false);
      if (!outcome.ok) {
        assert.ok(outcome.reason.includes("not implemented"));
      }
    });
  });

  describe("worker integration", () => {
    it("default dry-run still works without fetch", async () => {
      delete process.env.HAIRAUDIT_FI_IMAGE_FETCH_ENABLED;
      const persistence = createMemoryFiImageIntelligencePersistence();

      const outcome = await processFiImageIntelligenceJob(buildSampleJobPayload(), {
        workerEnabled: true,
        persistence,
        classifierProvider: "dry_run",
      });

      assert.strictEqual(outcome.status, "dry_run");
      assert.strictEqual(outcome.result?.classification_status, "dry_run");
      assert.strictEqual(outcome.result?.image_fetch_status, "skipped");
    });

    it("manual_stub persists classified result", async () => {
      const persistence = createMemoryFiImageIntelligencePersistence();
      const payload = buildSampleJobPayload();

      const outcome = await processFiImageIntelligenceJob(payload, {
        workerEnabled: true,
        persistence,
        classifierProvider: "manual_stub",
      });

      assert.strictEqual(outcome.status, "classified");
      assert.strictEqual(outcome.result?.classification_status, "classified");

      const record = await findProcessedJobByIdempotencyKey(payload.idempotency_key, persistence);
      assert.strictEqual(record?.status, "completed");
      assert.strictEqual(record?.result?.classification_source, "manual_stub");
    });

    it("persists fetched image metadata when fetch enabled", async () => {
      const jpeg = minimalJpegBuffer(64);
      const persistence = createMemoryFiImageIntelligencePersistence();
      const payload = buildSampleJobPayload();

      const outcome = await processFiImageIntelligenceJob(payload, {
        workerEnabled: true,
        imageFetchEnabled: true,
        persistence,
        classifierProvider: "dry_run",
        imageDownloadFn: async () => ({ ok: true, blob: new Blob([jpeg]) }),
      });

      assert.strictEqual(outcome.status, "dry_run");
      assert.strictEqual(outcome.result?.image_fetch_status, "ok");
      assert.strictEqual(outcome.result?.image_content_type, "image/jpeg");
      assert.strictEqual(outcome.result?.image_size_bytes, jpeg.length);

      const record = await findProcessedJobByIdempotencyKey(payload.idempotency_key, persistence);
      assert.strictEqual(record?.result?.image_fetch_status, "ok");
      assert.strictEqual(record?.result?.image_size_bytes, jpeg.length);
    });

    it("fetch failure persists failed job", async () => {
      const persistence = createMemoryFiImageIntelligencePersistence();
      const payload = buildSampleJobPayload();

      const outcome = await processFiImageIntelligenceJob(payload, {
        workerEnabled: true,
        imageFetchEnabled: true,
        persistence,
        imageDownloadFn: async () => ({ ok: false, error: "object not found" }),
      });

      assert.strictEqual(outcome.status, "failed");
      assert.ok(outcome.reason.includes("image fetch failed"));

      const record = await findProcessedJobByIdempotencyKey(payload.idempotency_key, persistence);
      assert.strictEqual(record?.status, "failed");
    });
  });

  describe("result contract", () => {
    it("includes Phase 3D fields on dry-run builder", () => {
      const result = buildDryRunFiImageIntelligenceResult({
        idempotency_key: buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD),
        source_case_id: SAMPLE_CASE,
        source_upload_id: SAMPLE_UPLOAD,
        canonical_photo_category: "patient_current_front",
      });

      assert.strictEqual(result.image_fetch_status, "skipped");
      assert.strictEqual(result.image_content_type, null);
      assert.strictEqual(result.image_size_bytes, null);
      assert.strictEqual(result.classification_source, "dry_run");
      assert.ok(result.classification_notes.length > 0);
    });
  });

  describe("readiness checker", () => {
    it("warns when fetch enabled without worker", () => {
      const lines = runHairAuditEventReadinessChecks({
        HAIRAUDIT_FI_IMAGE_FETCH_ENABLED: "true",
      });

      const line = lines.find((l) => l.id === "fi-image-fetch-without-worker");
      assert.ok(line);
      assert.strictEqual(line?.status, "WARN");
    });

    it("shows classifier provider", () => {
      const lines = runHairAuditEventReadinessChecks({
        HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER: "manual_stub",
      });

      const line = lines.find((l) => l.id === "fi-classifier-provider");
      assert.ok(line);
      assert.ok(line?.message.includes("manual_stub"));
    });

    it("fails when fi_os provider set without FI endpoint config", () => {
      const lines = runHairAuditEventReadinessChecks({
        HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER: "fi_os",
      });

      const line = lines.find((l) => l.id === "fi-classifier-ai-env");
      assert.ok(line);
      assert.strictEqual(line?.status, "FAIL");
      assert.ok(line?.message.includes("FI_OS_IMAGE_CLASSIFIER_URL"));
    });

    it("notes openai is still not implemented", () => {
      const lines = runHairAuditEventReadinessChecks({
        HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
      });
      const line = lines.find((l) => l.id === "fi-classifier-ai-env");
      assert.ok(line);
      assert.strictEqual(line?.status, "WARN");
      assert.ok(line?.message.includes("not implemented"));
    });
  });

  describe("fetch env flag", () => {
    it("is off by default", () => {
      delete process.env.HAIRAUDIT_FI_IMAGE_FETCH_ENABLED;
      assert.strictEqual(isFiImageIntelligenceImageFetchEnabled(), false);
    });
  });

  describe("no AI provider imports or calls", () => {
    const SOURCE_FILES = [
      "src/lib/hairaudit/fiImageIntelligenceWorker.ts",
      "src/lib/hairaudit/fiImageIntelligenceImageFetch.ts",
      "src/lib/hairaudit/fiImageClassifierAdapter.ts",
      "src/lib/hairaudit/fiOsImageClassifierClient.ts",
      "src/lib/hairaudit/fiImageIntelligencePersistence.ts",
      "src/lib/inngest/functions/fiImageIntelligenceWorker.ts",
    ];

    const FORBIDDEN_PATTERNS = [
      /\bfrom\s+["']openai["']/,
      /\bfrom\s+["']@anthropic-ai\//,
      /\bfrom\s+["']@google\/generative-ai["']/,
      /runAIAudit/,
      /from\s+["']@\/lib\/ai\//,
    ];

    for (const relPath of SOURCE_FILES) {
      it(`${relPath} has no AI provider imports or calls`, () => {
        const source = fs
          .readFileSync(path.join(process.cwd(), relPath), "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "");

        for (const pattern of FORBIDDEN_PATTERNS) {
          assert.ok(!pattern.test(source), `${relPath} must not match ${pattern}`);
        }
      });
    }
  });
});
