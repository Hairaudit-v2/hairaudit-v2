import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  buildFiImageIntelligenceIdempotencyKey,
  type FiImageIntelligenceJobPayload,
} from "../src/lib/hairaudit/fiImageIntelligenceQueue";
import {
  createMemoryFiImageIntelligencePersistence,
  findProcessedJobByIdempotencyKey,
  markJobCompleted,
  markJobFailed,
  markJobProcessing,
} from "../src/lib/hairaudit/fiImageIntelligencePersistence";
import { buildDryRunFiImageIntelligenceResult } from "../src/lib/hairaudit/fiImageIntelligenceResult";
import { processFiImageIntelligenceJob } from "../src/lib/hairaudit/fiImageIntelligenceWorker";
import { runHairAuditEventReadinessChecks } from "../scripts/check-hairaudit-event-readiness.mjs";

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

describe("upload phase 3c", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  describe("persistence helper", () => {
    it("first run creates processing then completed record", async () => {
      const persistence = createMemoryFiImageIntelligencePersistence();
      const key = buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD);

      const processing = await markJobProcessing(
        {
          idempotency_key: key,
          case_id: SAMPLE_CASE,
          upload_id: SAMPLE_UPLOAD,
          event_name: "hairaudit.upload.created",
        },
        persistence
      );
      assert.strictEqual(processing.ok, true);
      if (processing.ok) {
        assert.strictEqual(processing.created, true);
        assert.strictEqual(processing.record.status, "processing");
      }

      const result = buildDryRunFiImageIntelligenceResult({
        idempotency_key: key,
        source_case_id: SAMPLE_CASE,
        source_upload_id: SAMPLE_UPLOAD,
        canonical_photo_category: "patient_current_front",
        processed_at: "2026-06-17T14:01:00.000Z",
      });

      const completed = await markJobCompleted(
        { idempotency_key: key, result },
        persistence
      );
      assert.strictEqual(completed.ok, true);

      const record = await findProcessedJobByIdempotencyKey(key, persistence);
      assert.strictEqual(record?.status, "completed");
      assert.strictEqual(record?.result?.classification_status, "dry_run");
      assert.strictEqual(record?.processed_at, "2026-06-17T14:01:00.000Z");
    });

    it("duplicate idempotency key skips via persistence", async () => {
      const persistence = createMemoryFiImageIntelligencePersistence();
      const payload = buildSampleJobPayload();

      const first = await processFiImageIntelligenceJob(payload, {
        workerEnabled: true,
        persistence,
      });
      assert.strictEqual(first.status, "dry_run");

      const second = await processFiImageIntelligenceJob(payload, {
        workerEnabled: true,
        persistence,
      });
      assert.strictEqual(second.status, "skipped");
      assert.ok(second.reason.includes("already processed"));

      const record = await findProcessedJobByIdempotencyKey(payload.idempotency_key, persistence);
      assert.strictEqual(record?.status, "completed");
    });

    it("failed validation persists failed status", async () => {
      const persistence = createMemoryFiImageIntelligencePersistence();
      const payload = buildSampleJobPayload({
        input: {
          ...buildSampleJobPayload().input,
          storage_path: `cases/00000000-0000-4000-8000-000000000099/patient/front/1.jpg`,
        },
      });

      const outcome = await processFiImageIntelligenceJob(payload, {
        workerEnabled: true,
        persistence,
      });
      assert.strictEqual(outcome.status, "failed");

      const record = await findProcessedJobByIdempotencyKey(payload.idempotency_key, persistence);
      assert.strictEqual(record?.status, "failed");
      assert.ok(record?.error_message);
      assert.strictEqual(record?.result, null);
    });

    it("markJobFailed updates an existing processing row", async () => {
      const persistence = createMemoryFiImageIntelligencePersistence();
      const key = buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD);

      await markJobProcessing(
        {
          idempotency_key: key,
          case_id: SAMPLE_CASE,
          upload_id: SAMPLE_UPLOAD,
          event_name: "hairaudit.upload.created",
        },
        persistence
      );

      const failed = await markJobFailed(
        { idempotency_key: key, error_message: "validation failed" },
        persistence
      );
      assert.strictEqual(failed.ok, true);

      const record = await findProcessedJobByIdempotencyKey(key, persistence);
      assert.strictEqual(record?.status, "failed");
      assert.strictEqual(record?.error_message, "validation failed");
    });
  });

  describe("DB unavailable fallback", () => {
    it("returns failed non-throw when persistence insert fails", async () => {
      const failingPersistence = createMemoryFiImageIntelligencePersistence();
      const originalMark = failingPersistence.markJobProcessing.bind(failingPersistence);
      failingPersistence.markJobProcessing = async (args) => {
        void args;
        return { ok: false, error: "db_unavailable" };
      };
      void originalMark;

      const outcome = await processFiImageIntelligenceJob(buildSampleJobPayload(), {
        workerEnabled: true,
        persistence: failingPersistence,
      });

      assert.strictEqual(outcome.status, "failed");
      assert.ok(outcome.reason.includes("persist processing"));
      assert.ok(outcome.idempotency_key);
    });

    it("falls back to in-memory persistence when service role is unset", async () => {
      const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      try {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        const outcome = await processFiImageIntelligenceJob(buildSampleJobPayload(), {
          workerEnabled: true,
        });

        assert.strictEqual(outcome.status, "dry_run");
        assert.strictEqual(outcome.persistence_fallback, true);
      } finally {
        if (prevUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
        else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (prevKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
        else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
    });
  });

  describe("migration", () => {
    it("defines fi_image_intelligence_processed_jobs with required columns", () => {
      const migrationPath = path.join(
        process.cwd(),
        "supabase/migrations/20260617120000_fi_image_intelligence_processed_jobs.sql"
      );
      assert.ok(fs.existsSync(migrationPath));
      const sql = fs.readFileSync(migrationPath, "utf8");

      for (const fragment of [
        "fi_image_intelligence_processed_jobs",
        "idempotency_key TEXT NOT NULL UNIQUE",
        "case_id UUID NOT NULL",
        "upload_id UUID NOT NULL",
        "event_name TEXT NOT NULL",
        "source_system TEXT NOT NULL DEFAULT 'hairaudit'",
        "status TEXT NOT NULL",
        "result JSONB",
        "error_message TEXT",
        "processed_at TIMESTAMPTZ",
        "idx_fi_image_intelligence_processed_jobs_case_id",
        "idx_fi_image_intelligence_processed_jobs_upload_id",
        "idx_fi_image_intelligence_processed_jobs_status",
        "ENABLE ROW LEVEL SECURITY",
        "service_role",
      ]) {
        assert.ok(sql.includes(fragment), `migration should include ${fragment}`);
      }
    });
  });

  describe("readiness checker", () => {
    it("warns when worker enabled but SUPABASE_SERVICE_ROLE_KEY is missing", () => {
      const lines = runHairAuditEventReadinessChecks({
        HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED: "true",
      });

      const workerPersist = lines.find((l) => l.id === "fi-worker-persistence");
      assert.ok(workerPersist);
      assert.strictEqual(workerPersist?.status, "WARN");
      assert.ok(workerPersist?.message.includes("SUPABASE_SERVICE_ROLE_KEY"));
    });

    it("confirms AI execution is still not implemented", () => {
      const lines = runHairAuditEventReadinessChecks({
        HAIRAUDIT_FI_IMAGE_INTELLIGENCE_WORKER_ENABLED: "true",
        SUPABASE_SERVICE_ROLE_KEY: "test-key",
      });

      const aiLine = lines.find((l) => l.id === "fi-ai-execution-phase3c");
      assert.ok(aiLine);
      assert.strictEqual(aiLine?.status, "PASS");
      assert.ok(aiLine?.message.includes("not implemented"));
    });
  });

  describe("no AI provider imports or calls", () => {
    const SOURCE_FILES = [
      "src/lib/hairaudit/fiImageIntelligenceWorker.ts",
      "src/lib/hairaudit/fiImageIntelligencePersistence.ts",
      "src/lib/inngest/functions/fiImageIntelligenceWorker.ts",
    ];

    const FORBIDDEN_PATTERNS = [
      /\bopenai\b/i,
      /\banthropic\b/i,
      /\bclaude\b/i,
      /\bgemini\b/i,
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
