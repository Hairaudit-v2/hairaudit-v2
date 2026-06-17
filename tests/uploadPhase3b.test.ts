import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  buildFiImageIntelligenceIdempotencyKey,
  type FiImageIntelligenceJobPayload,
} from "../src/lib/hairaudit/fiImageIntelligenceQueue";
import {
  decideFiImageIntelligenceProcessedKey,
  markFiImageIntelligenceKeyProcessed,
} from "../src/lib/hairaudit/fiImageIntelligenceIdempotency";
import {
  isFiImageIntelligenceWorkerEnabled,
  processFiImageIntelligenceJob,
  validateFiImageIntelligenceJobPayload,
  validateFiImageIntelligenceStorageMetadata,
} from "../src/lib/hairaudit/fiImageIntelligenceWorker";

const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

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

describe("upload phase 3b", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  describe("worker disabled", () => {
    it("skips when HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED is off", () => {
      delete process.env.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED;

      const outcome = processFiImageIntelligenceJob(buildSampleJobPayload());
      assert.strictEqual(outcome.status, "skipped");
      assert.ok(outcome.reason.includes("HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED"));
      assert.strictEqual(isFiImageIntelligenceWorkerEnabled(), false);
    });
  });

  describe("invalid payload", () => {
    it("fails safely on missing idempotency_key", () => {
      const outcome = processFiImageIntelligenceJob(
        { enqueued_at: "2026-06-17T14:00:00.000Z", input: {} },
        { workerEnabled: true }
      );
      assert.strictEqual(outcome.status, "failed");
      assert.ok(outcome.reason.includes("idempotency_key"));
    });

    it("fails safely when idempotency_key does not match case/upload", () => {
      const payload = buildSampleJobPayload({
        idempotency_key: "hairaudit:image-intelligence:wrong:wrong:v1",
      });

      const validation = validateFiImageIntelligenceJobPayload(payload);
      assert.strictEqual(validation.valid, false);
      if (!validation.valid) {
        assert.ok(validation.reason.includes("idempotency_key"));
      }

      const outcome = processFiImageIntelligenceJob(payload, { workerEnabled: true });
      assert.strictEqual(outcome.status, "failed");
    });

    it("fails safely when storage path does not belong to case", () => {
      const payload = buildSampleJobPayload({
        input: {
          ...buildSampleJobPayload().input,
          storage_path: `cases/00000000-0000-4000-8000-000000000099/patient/front/1.jpg`,
        },
      });

      const outcome = processFiImageIntelligenceJob(payload, { workerEnabled: true });
      assert.strictEqual(outcome.status, "failed");
      assert.ok(outcome.reason.includes("storage_path"));
    });
  });

  describe("dry-run enabled", () => {
    it("returns placeholder result when worker enabled", () => {
      process.env.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED = "true";

      const outcome = processFiImageIntelligenceJob(buildSampleJobPayload(), {
        workerEnabled: true,
      });

      assert.strictEqual(outcome.status, "dry_run");
      assert.strictEqual(outcome.storage_metadata_validated, true);
      assert.ok(outcome.reason.includes("dry-run"));
      assert.strictEqual(outcome.result?.dry_run, true);
      assert.strictEqual(outcome.result?.classification_status, "dry_run");
      assert.strictEqual(outcome.result?.canonical_photo_category, "patient_current_front");
      assert.strictEqual(outcome.result?.confidence, null);
      assert.strictEqual(outcome.result?.model_provider, null);
      assert.strictEqual(outcome.result?.model_version, null);
      assert.strictEqual(outcome.result?.quality_status, "not_evaluated");
      assert.strictEqual(outcome.result?.protocol_status, "not_evaluated");
      assert.ok(outcome.result?.processed_at);
    });

    it("validates storage metadata without fetching bytes", () => {
      const input = buildSampleJobPayload().input;
      const validation = validateFiImageIntelligenceStorageMetadata(input);
      assert.strictEqual(validation.valid, true);
      if (validation.valid) {
        assert.ok(validation.normalized_path.includes(SAMPLE_CASE));
      }
    });
  });

  describe("idempotency key", () => {
    it("is stable for the same case and upload", () => {
      const keyA = buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD);
      const keyB = buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD);
      assert.strictEqual(keyA, keyB);
      assert.strictEqual(
        keyA,
        `hairaudit:image-intelligence:${SAMPLE_CASE}:${SAMPLE_UPLOAD}:v1`
      );
    });

    it("skips duplicate jobs via processed-key decision", () => {
      const processedKeys = new Set<string>();
      const payload = buildSampleJobPayload();
      const key = payload.idempotency_key;

      const first = processFiImageIntelligenceJob(payload, {
        workerEnabled: true,
        processedKeys,
      });
      assert.strictEqual(first.status, "dry_run");

      const decision = decideFiImageIntelligenceProcessedKey(key, processedKeys);
      assert.strictEqual(decision.action, "skip");

      const second = processFiImageIntelligenceJob(payload, {
        workerEnabled: true,
        processedKeys,
      });
      assert.strictEqual(second.status, "skipped");
      assert.ok(second.reason.includes("already processed"));
    });

    it("markFiImageIntelligenceKeyProcessed records keys for future persistence parity", () => {
      const processedKeys = new Set<string>();
      const key = buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD);

      markFiImageIntelligenceKeyProcessed(processedKeys, key);
      const decision = decideFiImageIntelligenceProcessedKey(key, processedKeys);
      assert.strictEqual(decision.action, "skip");
    });
  });

  describe("no AI provider imports or calls", () => {
    const WORKER_SOURCE_FILES = [
      "src/lib/hairaudit/fiImageIntelligenceWorker.ts",
      "src/lib/hairaudit/fiImageIntelligenceResult.ts",
      "src/lib/hairaudit/fiImageIntelligenceIdempotency.ts",
      "src/lib/inngest/functions/fiImageIntelligenceWorker.ts",
    ];

    const FORBIDDEN_PATTERNS = [
      /\bopenai\b/i,
      /\banthropic\b/i,
      /\bclaude\b/i,
      /\bgemini\b/i,
      /runAIAudit/,
      /runGraftIntegrityModelEstimate/,
      /from\s+["']@\/lib\/ai\//,
    ];

    for (const relPath of WORKER_SOURCE_FILES) {
      it(`${relPath} has no AI provider imports or calls`, () => {
        const absPath = path.join(process.cwd(), relPath);
        assert.ok(fs.existsSync(absPath), `${relPath} should exist`);
        const source = fs
          .readFileSync(absPath, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "");

        for (const pattern of FORBIDDEN_PATTERNS) {
          assert.ok(
            !pattern.test(source),
            `${relPath} must not match ${pattern}`
          );
        }
      });
    }
  });

  describe("Inngest registration", () => {
    it("registers fi-image-intelligence-v1 on the enqueue event", () => {
      const routeSource = fs.readFileSync(
        path.join(process.cwd(), "src/app/api/inngest/route.ts"),
        "utf8"
      );
      const fnSource = fs.readFileSync(
        path.join(process.cwd(), "src/lib/inngest/functions/fiImageIntelligenceWorker.ts"),
        "utf8"
      );

      assert.ok(routeSource.includes("runFiImageIntelligenceWorker"));
      assert.ok(fnSource.includes('id: "fi-image-intelligence-v1"'));
      assert.ok(fnSource.includes("FI_IMAGE_INTELLIGENCE_INNGEST_EVENT"));
    });
  });
});
