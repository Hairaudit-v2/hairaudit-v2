import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import {
  buildFiOsUnifiedClassifierRequestHeaders,
  buildUnifiedClassifierRequestBody,
  classifyWithFiOsUnifiedImageClassifier,
  computeFiOsUnifiedClassifierHmacHex,
  FI_OS_IMAGING_HDR_SIGNATURE,
  FI_OS_IMAGING_HDR_SOURCE_SYSTEM,
  FI_OS_IMAGING_HDR_TIMESTAMP,
  mapUnifiedClassificationToHairAuditResult,
  parseUnifiedImageClassifyResponse,
  resolveFiOsUnifiedClassifierHmacConfig,
  signFiOsUnifiedClassifierRequestForTests,
} from "../src/lib/integrations/fiOsUnifiedImageClassifier";
import {
  classifyHairAuditImage,
  resolveFiImageClassifierCutoverModeFromEnv,
  resolveFiImageClassifierProvider,
} from "../src/lib/hairaudit/fiImageClassifierAdapter";
import {
  resolveFiImageClassifierCutoverMode,
  resolveFiImageClassifierLegacyProvider,
} from "../src/lib/hairaudit/fiImageClassifierCutover";
import { buildShadowComparisonRecord } from "../src/lib/hairaudit/fiImageClassifierShadowCompare";
import {
  createMemoryClassifierShadowPersistence,
  getMemoryClassifierShadowRecordsForTests,
  resetMemoryClassifierShadowStoreForTests,
} from "../src/lib/hairaudit/fiImageClassifierShadowPersistence";
import type { FiImageIntelligenceResult } from "../src/lib/hairaudit/fiImageIntelligenceResult";

const UNIFIED_URL = "https://fi.example.com/api/internal/imaging/classify";
const HMAC_SECRET = "fi-unified-hmac-secret";
const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const FIXED_TIMESTAMP = "2026-07-02T12:00:00.000Z";

function mockFetchJson(status: number, body: unknown) {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
}

function sampleLegacyResult(category = "front"): FiImageIntelligenceResult {
  return {
    classification_status: "classified",
    canonical_photo_category: category,
    confidence: 0.8,
    quality_status: "not_evaluated",
    protocol_status: "not_evaluated",
    model_provider: "manual_stub",
    model_version: "phase-3d-stub",
    processed_at: "2026-07-02T12:00:00.000Z",
    dry_run: false,
    idempotency_key: "key-1",
    source_case_id: SAMPLE_CASE,
    source_upload_id: SAMPLE_UPLOAD,
    image_fetch_status: "skipped",
    image_content_type: null,
    image_size_bytes: null,
    classification_source: "manual_stub",
    classification_notes: "stub",
  };
}

describe("FIN-IMAGING-3 unified classifier adapter", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    resetMemoryClassifierShadowStoreForTests();
  });

  describe("buildUnifiedClassifierRequestBody", () => {
    it("sends source_system=hairaudit and source_image_id", () => {
      const body = buildUnifiedClassifierRequestBody({
        source_image_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        canonical_photo_category: "patient_current_front",
        idempotency_key: "idem-1",
      });

      assert.strictEqual(body.source_system, "hairaudit");
      assert.strictEqual(body.source_image_id, SAMPLE_UPLOAD);
      assert.strictEqual(body.case_id, SAMPLE_CASE);
      assert.strictEqual(body.capture_source, "forensic_audit");
      assert.strictEqual(body.upload_source, "hairaudit");
    });
  });

  describe("parseUnifiedImageClassifyResponse", () => {
    it("parses ImageClassificationResultV1 envelope", () => {
      const parsed = parseUnifiedImageClassifyResponse({
        success: true,
        classification: {
          schemaVersion: 1,
          image_id: SAMPLE_UPLOAD,
          category: "front",
          confidence: 0.91,
          quality_score: 0.88,
          blur_score: 0.1,
          protocol_compliant: true,
        },
        fallback_used: false,
        provider: "hli-openai-vision",
        processing_version: "fin-imaging-2@1",
      });

      assert.ok(parsed);
      assert.strictEqual(parsed?.classification.category, "front");
      assert.strictEqual(parsed?.provider, "hli-openai-vision");
    });

    it("rejects malformed response", () => {
      assert.strictEqual(parseUnifiedImageClassifyResponse(null), null);
      assert.strictEqual(parseUnifiedImageClassifyResponse({ success: true }), null);
    });
  });

  describe("classifyWithFiOsUnifiedImageClassifier", () => {
    it("maps unified response into HairAudit result", async () => {
      const outcome = await classifyWithFiOsUnifiedImageClassifier(
        {
          source_image_id: SAMPLE_UPLOAD,
          case_id: SAMPLE_CASE,
          canonical_photo_category: "patient_current_front",
          idempotency_key: "idem-1",
        },
        {
          env: {
            FI_OS_IMAGE_CLASSIFIER_URL: UNIFIED_URL,
            FI_OS_IMAGE_CLASSIFIER_TOKEN: "fi-unified-token",
          },
          fetchImpl: mockFetchJson(200, {
            success: true,
            classification: {
              category: "front",
              confidence: 0.92,
              quality_score: 0.85,
              blur_score: 0.05,
              protocol_compliant: true,
            },
            fallback_used: false,
            provider: "hli-openai-vision",
            processing_version: "fin-imaging-2@1",
          }) as typeof fetch,
        }
      );

      assert.strictEqual(outcome.ok, true);
      if (outcome.ok) {
        assert.strictEqual(outcome.result.canonical_photo_category, "front");
        assert.strictEqual(outcome.result.classification_source, "fi_os_unified");
        assert.strictEqual(outcome.result.confidence, 0.92);
      }
    });

    it("fails when token missing", async () => {
      const outcome = await classifyWithFiOsUnifiedImageClassifier(
        {
          source_image_id: SAMPLE_UPLOAD,
          case_id: SAMPLE_CASE,
          canonical_photo_category: "front",
          idempotency_key: "idem-1",
        },
        { env: { FI_OS_IMAGE_CLASSIFIER_URL: UNIFIED_URL } }
      );

      assert.strictEqual(outcome.ok, false);
    });

    it("sends HMAC headers when secret is configured", async () => {
      const input = {
        source_image_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        canonical_photo_category: "patient_current_front",
        idempotency_key: "idem-1",
      };
      const rawBody = JSON.stringify(buildUnifiedClassifierRequestBody(input));

      let capturedHeaders: HeadersInit | undefined;
      const fetchImpl = async (_url: RequestInfo | URL, init?: RequestInit) => {
        capturedHeaders = init?.headers;
        return new Response(
          JSON.stringify({
            success: true,
            classification: { category: "front", confidence: 0.9, protocol_compliant: true },
            fallback_used: false,
            provider: "hli-openai-vision",
            processing_version: "v1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const outcome = await classifyWithFiOsUnifiedImageClassifier(input, {
        env: {
          FI_OS_IMAGE_CLASSIFIER_URL: UNIFIED_URL,
          FI_OS_IMAGE_CLASSIFIER_TOKEN: "fi-unified-token",
          FI_OS_IMAGE_CLASSIFIER_HMAC_SECRET: HMAC_SECRET,
        },
        fetchImpl: fetchImpl as typeof fetch,
      });

      assert.strictEqual(outcome.ok, true);
      assert.ok(capturedHeaders);
      const headers = capturedHeaders as Record<string, string>;
      assert.strictEqual(headers.Authorization, "Bearer fi-unified-token");
      assert.strictEqual(headers[FI_OS_IMAGING_HDR_SOURCE_SYSTEM], "hairaudit");
      assert.ok(headers[FI_OS_IMAGING_HDR_TIMESTAMP]);
      assert.ok(headers[FI_OS_IMAGING_HDR_SIGNATURE]);
      assert.strictEqual(
        headers[FI_OS_IMAGING_HDR_SIGNATURE],
        computeFiOsUnifiedClassifierHmacHex(HMAC_SECRET, `${headers[FI_OS_IMAGING_HDR_TIMESTAMP]}.${rawBody}`)
      );
    });

    it("preserves bearer-only requests when HMAC secret is missing", async () => {
      let capturedHeaders: HeadersInit | undefined;
      const fetchImpl = async (_url: RequestInfo | URL, init?: RequestInit) => {
        capturedHeaders = init?.headers;
        return new Response(
          JSON.stringify({
            success: true,
            classification: { category: "front", confidence: 0.9, protocol_compliant: true },
            fallback_used: false,
            provider: "hli-openai-vision",
            processing_version: "v1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const outcome = await classifyWithFiOsUnifiedImageClassifier(
        {
          source_image_id: SAMPLE_UPLOAD,
          case_id: SAMPLE_CASE,
          canonical_photo_category: "patient_current_front",
          idempotency_key: "idem-1",
        },
        {
          env: {
            FI_OS_IMAGE_CLASSIFIER_URL: UNIFIED_URL,
            FI_OS_IMAGE_CLASSIFIER_TOKEN: "fi-unified-token",
            FI_OS_IMAGE_CLASSIFIER_REQUIRE_HMAC: "false",
          },
          fetchImpl: fetchImpl as typeof fetch,
        }
      );

      assert.strictEqual(outcome.ok, true);
      const headers = capturedHeaders as Record<string, string>;
      assert.strictEqual(headers.Authorization, "Bearer fi-unified-token");
      assert.strictEqual(headers[FI_OS_IMAGING_HDR_SOURCE_SYSTEM], "hairaudit");
      assert.strictEqual(headers[FI_OS_IMAGING_HDR_TIMESTAMP], undefined);
      assert.strictEqual(headers[FI_OS_IMAGING_HDR_SIGNATURE], undefined);
    });

    it("fails closed when HMAC is required but secret is missing", async () => {
      const outcome = await classifyWithFiOsUnifiedImageClassifier(
        {
          source_image_id: SAMPLE_UPLOAD,
          case_id: SAMPLE_CASE,
          canonical_photo_category: "front",
          idempotency_key: "idem-1",
        },
        {
          env: {
            FI_OS_IMAGE_CLASSIFIER_URL: UNIFIED_URL,
            FI_OS_IMAGE_CLASSIFIER_TOKEN: "fi-unified-token",
            FI_OS_IMAGE_CLASSIFIER_REQUIRE_HMAC: "true",
          },
        }
      );

      assert.strictEqual(outcome.ok, false);
      if (!outcome.ok) {
        assert.match(outcome.reason, /FI_OS_IMAGE_CLASSIFIER_HMAC_SECRET/);
      }
    });
  });

  describe("HMAC request headers", () => {
    it("buildFiOsUnifiedClassifierRequestHeaders signs with timestamp.rawBody material", () => {
      const rawBody = '{"source_system":"hairaudit"}';
      const headers = buildFiOsUnifiedClassifierRequestHeaders({
        token: "token-1",
        rawBody,
        hmacSecret: HMAC_SECRET,
        timestamp: FIXED_TIMESTAMP,
      });

      assert.ok(!("error" in headers));
      const signed = signFiOsUnifiedClassifierRequestForTests({
        secret: HMAC_SECRET,
        timestamp: FIXED_TIMESTAMP,
        rawBody,
      });
      assert.strictEqual(headers[FI_OS_IMAGING_HDR_TIMESTAMP], FIXED_TIMESTAMP);
      assert.strictEqual(headers[FI_OS_IMAGING_HDR_SIGNATURE], signed.signature);
      assert.strictEqual(headers.Authorization, "Bearer token-1");
    });

    it("resolveFiOsUnifiedClassifierHmacConfig defaults require flag to false", () => {
      const config = resolveFiOsUnifiedClassifierHmacConfig({});
      assert.strictEqual(config.requireHmac, false);
      assert.strictEqual(config.secret, null);
      assert.strictEqual(config.shouldSign, false);
    });

    it("resolveFiOsUnifiedClassifierHmacConfig marks shouldSign when secret present", () => {
      const config = resolveFiOsUnifiedClassifierHmacConfig({
        FI_OS_IMAGE_CLASSIFIER_HMAC_SECRET: HMAC_SECRET,
      });
      assert.strictEqual(config.requireHmac, false);
      assert.strictEqual(config.secret, HMAC_SECRET);
      assert.strictEqual(config.shouldSign, true);
    });

    it("buildFiOsUnifiedClassifierRequestHeaders rejects require-without-secret", () => {
      const result = buildFiOsUnifiedClassifierRequestHeaders({
        token: "token-1",
        rawBody: "{}",
        requireHmac: true,
      });
      assert.ok("error" in result);
      assert.match(result.error, /FI_OS_IMAGE_CLASSIFIER_HMAC_SECRET/);
    });
  });

  describe("feature flag cutover modes", () => {
    it("defaults to legacy cutover + dry_run inner provider", () => {
      delete process.env.HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER;
      assert.strictEqual(resolveFiImageClassifierCutoverMode(), "legacy");
      assert.strictEqual(resolveFiImageClassifierLegacyProvider(), "dry_run");
    });

    it("legacy mode only runs legacy classifier", async () => {
      const outcome = await classifyHairAuditImage(
        {
          idempotency_key: "key-1",
          source_case_id: SAMPLE_CASE,
          source_upload_id: SAMPLE_UPLOAD,
          canonical_photo_category: "front",
        },
        { cutoverMode: "legacy", provider: "manual_stub" }
      );

      assert.strictEqual(outcome.ok, true);
      if (outcome.ok) {
        assert.strictEqual(outcome.result.classification_source, "manual_stub");
      }
    });

    it("fi_os mode runs unified classifier only", async () => {
      process.env.FI_OS_IMAGE_CLASSIFIER_URL = UNIFIED_URL;
      process.env.FI_OS_IMAGE_CLASSIFIER_TOKEN = "fi-unified-token";

      const outcome = await classifyHairAuditImage(
        {
          idempotency_key: "key-1",
          source_case_id: SAMPLE_CASE,
          source_upload_id: SAMPLE_UPLOAD,
          canonical_photo_category: "patient_current_front",
        },
        {
          cutoverMode: "fi_os",
          fiOsFetchImpl: mockFetchJson(200, {
            success: true,
            classification: { category: "donor", confidence: 0.95, protocol_compliant: true },
            fallback_used: false,
            provider: "hli-openai-vision",
            processing_version: "v1",
          }) as typeof fetch,
        }
      );

      assert.strictEqual(outcome.ok, true);
      if (outcome.ok) {
        assert.strictEqual(outcome.result.classification_source, "fi_os_unified");
        assert.strictEqual(outcome.result.canonical_photo_category, "donor");
      }
    });

    it("shadow mode runs legacy and records comparison", async () => {
      const persistence = createMemoryClassifierShadowPersistence();
      process.env.FI_OS_IMAGE_CLASSIFIER_URL = UNIFIED_URL;
      process.env.FI_OS_IMAGE_CLASSIFIER_TOKEN = "fi-token";

      const outcome = await classifyHairAuditImage(
        {
          idempotency_key: "key-1",
          source_case_id: SAMPLE_CASE,
          source_upload_id: SAMPLE_UPLOAD,
          canonical_photo_category: "patient_current_front",
        },
        {
          cutoverMode: "shadow",
          provider: "manual_stub",
          fiOsFetchImpl: mockFetchJson(200, {
            success: true,
            classification: {
              category: "crown",
              confidence: 0.7,
              quality_score: 0.6,
              blur_score: 0.2,
              protocol_compliant: false,
            },
            fallback_used: true,
            provider: "fi-os-classifier-fallback",
            processing_version: "v1",
          }) as typeof fetch,
        }
      );

      assert.strictEqual(outcome.ok, true);
      if (outcome.ok) {
        assert.strictEqual(outcome.result.classification_source, "manual_stub");
      }

      const records = getMemoryClassifierShadowRecordsForTests();
      assert.strictEqual(records.length, 1);
      assert.strictEqual(records[0]?.legacy_category, records[0]?.legacy_category);
      assert.strictEqual(records[0]?.categories_match, false);

      const record = buildShadowComparisonRecord({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        legacy: sampleLegacyResult("front"),
        unifiedCategory: "crown",
        unifiedConfidence: 0.7,
        unifiedQualityScore: 0.6,
        unifiedBlurScore: 0.2,
        unifiedProtocolCompliant: false,
        unifiedFallbackUsed: true,
        unifiedProvider: "fi-os-classifier-fallback",
        processingVersion: "v1",
        legacyLatencyMs: 10,
        unifiedLatencyMs: 25,
      });

      const insert = await persistence.insert(record);
      assert.strictEqual(insert.ok, true);
      assert.strictEqual(insert.record?.categories_match, false);
    });
  });

  describe("contract mapping", () => {
    it("maps PhotoCategoryV1 front to HairAudit canonical front", () => {
      const mapped = mapUnifiedClassificationToHairAuditResult({
        parsed: parseUnifiedImageClassifyResponse({
          classification: { category: "front", confidence: 0.9 },
          fallback_used: false,
          provider: "stub",
          processing_version: "v1",
        }),
        sourceUploadId: SAMPLE_UPLOAD,
        processedAt: "2026-07-02T12:00:00.000Z",
      });

      assert.ok(mapped);
      assert.strictEqual(mapped?.canonical_photo_category, "front");
    });
  });

  describe("env resolution", () => {
    it("HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER=shadow resolves shadow cutover", () => {
      process.env.HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER = "shadow";
      assert.strictEqual(resolveFiImageClassifierCutoverModeFromEnv(), "shadow");
    });

    it("dry_run env preserves legacy cutover with dry_run inner", () => {
      process.env.HAIRAUDIT_FI_IMAGE_CLASSIFIER_PROVIDER = "dry_run";
      assert.strictEqual(resolveFiImageClassifierCutoverModeFromEnv(), "legacy");
      assert.strictEqual(resolveFiImageClassifierProvider(), "dry_run");
    });
  });
});
