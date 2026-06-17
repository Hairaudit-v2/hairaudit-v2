import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  buildFiImageIntelligenceIdempotencyKey,
  type FiImageIntelligenceJobPayload,
} from "../src/lib/hairaudit/fiImageIntelligenceQueue";
import { classifyHairAuditImage } from "../src/lib/hairaudit/fiImageClassifierAdapter";
import {
  classifyWithFiOsImageClassifier,
  mapFiCategoryToCanonical,
  parseFiOsClassifierResponseBody,
  validateFiOsClassifierConfig,
} from "../src/lib/hairaudit/fiOsImageClassifierClient";
import { createMemoryFiImageIntelligencePersistence } from "../src/lib/hairaudit/fiImageIntelligencePersistence";
import { processFiImageIntelligenceJob } from "../src/lib/hairaudit/fiImageIntelligenceWorker";
import { runHairAuditEventReadinessChecks } from "../scripts/check-hairaudit-event-readiness.mjs";

const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const FI_OS_URL = "https://fi.example.com/api/hli/classify-image";

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

function mockFetchJson(status: number, body: unknown, delayMs = 0) {
  return async () => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

describe("upload phase 3e", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  describe("validateFiOsClassifierConfig", () => {
    it("fails when URL and token are missing", () => {
      const result = validateFiOsClassifierConfig({});
      assert.strictEqual(result.valid, false);
      if (!result.valid) {
        assert.strictEqual(result.error, "url_missing");
      }
    });

    it("fails on invalid URL", () => {
      const result = validateFiOsClassifierConfig({
        FI_OS_IMAGE_CLASSIFIER_URL: "not-a-url",
        FI_OS_IMAGE_CLASSIFIER_TOKEN: "fi-token",
      });
      assert.strictEqual(result.valid, false);
      if (!result.valid) {
        assert.strictEqual(result.error, "invalid_url");
      }
    });

    it("fails on non-HTTPS URL in production", () => {
      const result = validateFiOsClassifierConfig({
        NODE_ENV: "production",
        FI_OS_IMAGE_CLASSIFIER_URL: "http://fi.example.com/classify",
        FI_OS_IMAGE_CLASSIFIER_TOKEN: "fi-token",
      });
      assert.strictEqual(result.valid, false);
      if (!result.valid) {
        assert.strictEqual(result.error, "non_https_in_production");
      }
    });

    it("rejects service role token reuse", () => {
      const result = validateFiOsClassifierConfig({
        SUPABASE_SERVICE_ROLE_KEY: "shared-secret",
        FI_OS_IMAGE_CLASSIFIER_URL: FI_OS_URL,
        FI_OS_IMAGE_CLASSIFIER_TOKEN: "shared-secret",
      });
      assert.strictEqual(result.valid, false);
      if (!result.valid) {
        assert.strictEqual(result.error, "service_role_key_reused");
      }
    });

    it("accepts valid HTTPS config", () => {
      const result = validateFiOsClassifierConfig({
        FI_OS_IMAGE_CLASSIFIER_URL: FI_OS_URL,
        FI_OS_IMAGE_CLASSIFIER_TOKEN: "fi-classifier-token",
      });
      assert.strictEqual(result.valid, true);
      if (result.valid) {
        assert.strictEqual(result.config.url, FI_OS_URL);
        assert.strictEqual(result.config.timeoutMs, 5000);
      }
    });
  });

  describe("classifyWithFiOsImageClassifier", () => {
    const baseInput = {
      idempotency_key: buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD),
      source_case_id: SAMPLE_CASE,
      source_upload_id: SAMPLE_UPLOAD,
      canonical_photo_category: "patient_current_front",
    };

    it("fails safely when provider is not configured", async () => {
      const outcome = await classifyWithFiOsImageClassifier(baseInput, { env: {} });
      assert.strictEqual(outcome.ok, false);
      if (!outcome.ok) {
        assert.ok(outcome.reason.includes("not configured"));
      }
    });

    it("maps a successful mocked FI response", async () => {
      const outcome = await classifyWithFiOsImageClassifier(baseInput, {
        env: {
          FI_OS_IMAGE_CLASSIFIER_URL: FI_OS_URL,
          FI_OS_IMAGE_CLASSIFIER_TOKEN: "fi-token",
        },
        fetchImpl: mockFetchJson(200, {
          category: "left_profile",
          category_confidence: 0.91,
          quality_status: "acceptable",
          protocol_status: "compliant",
          classifier_version: "hli-image-classifier@1.0.0",
          notes: "FI OS classification complete",
        }),
      });

      assert.strictEqual(outcome.ok, true);
      if (outcome.ok) {
        assert.strictEqual(outcome.result.classification_status, "classified");
        assert.strictEqual(outcome.result.canonical_photo_category, "left");
        assert.strictEqual(outcome.result.confidence, 0.91);
        assert.strictEqual(outcome.result.quality_status, "acceptable");
        assert.strictEqual(outcome.result.protocol_status, "compliant");
        assert.strictEqual(outcome.result.model_provider, "fi_os");
        assert.strictEqual(outcome.result.model_version, "hli-image-classifier@1.0.0");
        assert.strictEqual(outcome.result.classification_source, "fi_os");
        assert.ok(outcome.result.classification_notes.includes("FI OS"));
      }
    });

    it("returns safe failure on non-2xx response", async () => {
      const outcome = await classifyWithFiOsImageClassifier(baseInput, {
        env: {
          FI_OS_IMAGE_CLASSIFIER_URL: FI_OS_URL,
          FI_OS_IMAGE_CLASSIFIER_TOKEN: "fi-token",
        },
        fetchImpl: mockFetchJson(503, { error: "unavailable" }),
      });

      assert.strictEqual(outcome.ok, false);
      if (!outcome.ok) {
        assert.ok(outcome.reason.includes("503"));
      }
    });

    it("returns safe failure on timeout", async () => {
      const outcome = await classifyWithFiOsImageClassifier(baseInput, {
        env: {
          FI_OS_IMAGE_CLASSIFIER_URL: FI_OS_URL,
          FI_OS_IMAGE_CLASSIFIER_TOKEN: "fi-token",
          FI_OS_IMAGE_CLASSIFIER_TIMEOUT_MS: "3000",
        },
        fetchImpl: async (_input, init) => {
          await new Promise((_resolve, reject) => {
            const timer = setTimeout(() => {
              reject(new Error("fetch should have aborted"));
            }, 10_000);
            init?.signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          });
          return new Response("{}");
        },
      });

      assert.strictEqual(outcome.ok, false);
      if (!outcome.ok) {
        assert.ok(outcome.reason.toLowerCase().includes("timed out"));
      }
    });
  });

  describe("response parsing helpers", () => {
    it("maps FI categories to HairAudit canonical categories", () => {
      assert.strictEqual(mapFiCategoryToCanonical("left_profile"), "left");
      assert.strictEqual(mapFiCategoryToCanonical("donor"), "donor");
      assert.strictEqual(mapFiCategoryToCanonical("unknown"), "other");
    });

    it("parses camelCase and snake_case FI payloads", () => {
      const parsed = parseFiOsClassifierResponseBody({
        category: "front",
        categoryConfidence: 0.88,
        classifierVersion: "hli-image-classifier@1.0.0",
        notes: "ok",
      });

      assert.ok(parsed);
      assert.strictEqual(parsed?.canonical_photo_category, "front");
      assert.strictEqual(parsed?.confidence, 0.88);
      assert.strictEqual(parsed?.model_version, "hli-image-classifier@1.0.0");
    });
  });

  describe("classifier adapter fi_os wiring", () => {
    it("returns not configured when fi_os env is missing", async () => {
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

    it("openai provider remains not implemented", async () => {
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
    it("persists fi_os classified result when endpoint is configured", async () => {
      process.env.FI_OS_IMAGE_CLASSIFIER_URL = FI_OS_URL;
      process.env.FI_OS_IMAGE_CLASSIFIER_TOKEN = "fi-token";

      const persistence = createMemoryFiImageIntelligencePersistence();
      const payload = buildSampleJobPayload();

      const outcome = await processFiImageIntelligenceJob(payload, {
        workerEnabled: true,
        persistence,
        classifierProvider: "fi_os",
        fiOsFetchImpl: mockFetchJson(200, {
          category: "donor",
          category_confidence: 0.95,
          quality_status: "acceptable",
          protocol_status: "compliant",
          classifier_version: "hli-image-classifier@1.0.0",
          notes: "donor view",
        }) as typeof fetch,
      });

      assert.strictEqual(outcome.status, "classified");
      assert.strictEqual(outcome.result?.model_provider, "fi_os");
      assert.strictEqual(outcome.result?.canonical_photo_category, "donor");
    });
  });

  describe("readiness checker", () => {
    it("fails when fi_os provider is set without FI endpoint config", () => {
      const lines = runHairAuditEventReadinessChecks({
        HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER: "fi_os",
      });

      const line = lines.find((l) => l.id === "fi-classifier-ai-env");
      assert.ok(line);
      assert.strictEqual(line?.status, "FAIL");
      assert.ok(line?.message.includes("FI_OS_IMAGE_CLASSIFIER_URL"));
    });

    it("warns when fi_os endpoint config is present", () => {
      const lines = runHairAuditEventReadinessChecks({
        HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER: "fi_os",
        FI_OS_IMAGE_CLASSIFIER_URL: FI_OS_URL,
        FI_OS_IMAGE_CLASSIFIER_TOKEN: "fi-token",
      });

      const line = lines.find((l) => l.id === "fi-classifier-ai-env");
      assert.ok(line);
      assert.strictEqual(line?.status, "WARN");
      assert.ok(line?.message.includes("fi_os adapter"));
    });

    it("documents fi_os adapter-only execution", () => {
      const lines = runHairAuditEventReadinessChecks({
        HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER: "fi_os",
        FI_OS_IMAGE_CLASSIFIER_URL: FI_OS_URL,
        FI_OS_IMAGE_CLASSIFIER_TOKEN: "fi-token",
      });

      const line = lines.find((l) => l.id === "fi-ai-execution-phase3e");
      assert.ok(line);
      assert.strictEqual(line?.status, "PASS");
      assert.ok(line?.message.includes("internal FI HTTP adapter"));
    });
  });

  describe("no direct AI provider imports or calls", () => {
    const SOURCE_FILES = [
      "src/lib/hairaudit/fiImageClassifierAdapter.ts",
      "src/lib/hairaudit/fiOsImageClassifierClient.ts",
      "src/lib/hairaudit/fiImageIntelligenceWorker.ts",
      "src/lib/hairaudit/fiImageIntelligenceImageFetch.ts",
      "src/lib/inngest/functions/fiImageIntelligenceWorker.ts",
    ];

    const FORBIDDEN_PATTERNS = [
      /\bfrom\s+["']openai["']/,
      /\bfrom\s+["']@anthropic-ai\//,
      /\bfrom\s+["']@google\/generative-ai["']/,
      /\banthropic\b/i,
      /\bclaude\b/i,
      /\bgemini\b/i,
      /runAIAudit/,
      /from\s+["']@\/lib\/ai\//,
    ];

    for (const relPath of SOURCE_FILES) {
      it(`${relPath} has no direct AI provider imports or calls`, () => {
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
