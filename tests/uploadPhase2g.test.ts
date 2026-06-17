import { describe, it, afterEach, beforeEach } from "node:test";
import assert from "node:assert";
import {
  buildHairAuditUploadCreatedEvent,
  buildHairAuditUploadDeletedEvent,
  flattenUploadEventForSink,
  HAIRAUDIT_UPLOAD_EVENT_NAMES,
  uploadEventPayloadIsSafe,
} from "../src/lib/hairaudit/uploadEvents";
import {
  deliverIntegrationEvent,
  isUploadEventSinkDeliveryEnabled,
  parseIntegrationEventHeaders,
  validateIntegrationSinkConfig,
} from "../src/lib/hairaudit/integrationEventSink";
import {
  evaluateFiImageIntelligenceEnqueue,
  mapUploadEventToFiImageIntelligenceInput,
} from "../src/lib/hairaudit/fiImageIntelligenceBridge";
import { resetEventSinkInjection, setEventSink } from "../src/lib/integrations/sink";
import { emitHairAuditEvent } from "../src/lib/integrations/emit";
import {
  runHairAuditEventReadinessChecks,
  validateIntegrationHeadersJson,
} from "../scripts/check-hairaudit-event-readiness.mjs";

const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

describe("upload phase 2g", () => {
  describe("integration event sink", () => {
    const envBackup = { ...process.env };

    afterEach(() => {
      process.env = { ...envBackup };
      setEventSink({ async emit() {} });
    });

    it("sink disabled by default", async () => {
      delete process.env.HAIRAUDIT_UPLOAD_EVENTS_ENABLED;
      delete process.env.INTEGRATION_EVENTS_ENABLED;
      delete process.env.INTEGRATION_EVENTS_SINK_URL;

      let called = false;
      const summary = await deliverIntegrationEvent(
        "hairaudit.upload.created",
        { case_id: SAMPLE_CASE },
        {
          fetchImpl: async () => {
            called = true;
            return { ok: true, status: 200 };
          },
        }
      );

      assert.strictEqual(called, false);
      assert.strictEqual(summary.delivered, false);
      assert.strictEqual(summary.skippedReason, "integration-events-disabled");
    });

    it("upload delivery requires both HAIRAUDIT_UPLOAD_EVENTS_ENABLED and INTEGRATION_EVENTS_ENABLED", () => {
      process.env.HAIRAUDIT_UPLOAD_EVENTS_ENABLED = "true";
      delete process.env.INTEGRATION_EVENTS_ENABLED;
      assert.strictEqual(isUploadEventSinkDeliveryEnabled(), false);

      process.env.INTEGRATION_EVENTS_ENABLED = "true";
      assert.strictEqual(isUploadEventSinkDeliveryEnabled(), true);
    });

    it("rejects unsafe service-role header in sink config", () => {
      const serviceRole = "super-secret-service-role-key";
      const validation = validateIntegrationSinkConfig({
        NODE_ENV: "development",
        INTEGRATION_EVENTS_ENABLED: "true",
        INTEGRATION_EVENTS_SINK_URL: "https://sink.example/events",
        INTEGRATION_EVENTS_HEADERS: JSON.stringify({
          Authorization: `Bearer ${serviceRole}`,
        }),
        SUPABASE_SERVICE_ROLE_KEY: serviceRole,
      });

      assert.strictEqual(validation.valid, false);
      if (!validation.valid) {
        assert.strictEqual(validation.error, "service_role_key_reused");
      }
    });

    it("rejects non-HTTPS sink URL in production", () => {
      const validation = validateIntegrationSinkConfig({
        NODE_ENV: "production",
        INTEGRATION_EVENTS_ENABLED: "true",
        INTEGRATION_EVENTS_SINK_URL: "http://sink.example/events",
      });

      assert.strictEqual(validation.valid, false);
      if (!validation.valid) {
        assert.strictEqual(validation.error, "non_https_in_production");
      }
    });

    it("HTTP sink timeout does not throw to caller", async () => {
      process.env.INTEGRATION_EVENTS_ENABLED = "true";
      process.env.INTEGRATION_EVENTS_SINK_URL = "https://sink.example/events";
      process.env.INTEGRATION_EVENTS_TIMEOUT_MS = "1500";

      const summary = await deliverIntegrationEvent(
        HAIRAUDIT_UPLOAD_EVENT_NAMES.CREATED,
        { upload_id: SAMPLE_UPLOAD },
        {
          fetchImpl: (_url, init) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                const err = new Error("Aborted");
                err.name = "AbortError";
                reject(err);
              });
            }),
        }
      );

      assert.strictEqual(summary.delivered, false);
      assert.ok(summary.error);
    });

    it("HTTP sink non-2xx does not throw to caller", async () => {
      process.env.INTEGRATION_EVENTS_ENABLED = "true";
      process.env.INTEGRATION_EVENTS_SINK_URL = "https://sink.example/events";

      const summary = await deliverIntegrationEvent(
        HAIRAUDIT_UPLOAD_EVENT_NAMES.CREATED,
        { upload_id: SAMPLE_UPLOAD },
        {
          fetchImpl: async () => ({ ok: false, status: 503 }),
        }
      );

      assert.strictEqual(summary.delivered, false);
      assert.strictEqual(summary.status, 503);
      assert.strictEqual(summary.error, "non-2xx-response");
    });

    it("emitHairAuditEvent uses HTTP sink when configured and never throws on failure", async () => {
      process.env.INTEGRATION_EVENTS_ENABLED = "true";
      process.env.INTEGRATION_EVENTS_SINK_URL = "https://sink.example/events";
      resetEventSinkInjection();

      let fetchCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        fetchCount += 1;
        throw new Error("network down");
      }) as typeof fetch;

      try {
        await assert.doesNotReject(async () => {
          await emitHairAuditEvent("hairaudit.upload.created", { upload_id: SAMPLE_UPLOAD });
        });
        assert.ok(fetchCount >= 1);
      } finally {
        globalThis.fetch = originalFetch;
        resetEventSinkInjection();
        setEventSink({ async emit() {} });
      }
    });

    it("parses INTEGRATION_EVENTS_HEADERS JSON", () => {
      const parsed = parseIntegrationEventHeaders(
        JSON.stringify({ Authorization: "Bearer test-token" })
      );
      assert.strictEqual(parsed.ok, true);
      if (parsed.ok) {
        assert.strictEqual(parsed.headers.Authorization, "Bearer test-token");
      }
    });
  });

  describe("FI image intelligence bridge", () => {
    const envBackup = { ...process.env };

    afterEach(() => {
      process.env = { ...envBackup };
    });

    it("maps upload.created to FI-compatible input", () => {
      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "patient",
        upload_surface: "forensic_audit",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
        legacy_upload_type: "patient_photo:front",
        occurred_at: "2026-06-17T12:00:00.000Z",
      });

      const input = mapUploadEventToFiImageIntelligenceInput(event);

      assert.strictEqual(input.source_system, "hairaudit");
      assert.strictEqual(input.source_event_name, HAIRAUDIT_UPLOAD_EVENT_NAMES.CREATED);
      assert.strictEqual(input.source_case_id, SAMPLE_CASE);
      assert.strictEqual(input.source_upload_id, SAMPLE_UPLOAD);
      assert.strictEqual(input.actor_type, "patient");
      assert.strictEqual(input.upload_surface, "forensic_audit");
      assert.strictEqual(input.storage_bucket, "case-files");
      assert.strictEqual(input.canonical_photo_category, "front");
      assert.strictEqual(input.metadata_version, "2.0");
      assert.strictEqual(input.occurred_at, "2026-06-17T12:00:00.000Z");
    });

    it("excludes upload.deleted from enqueue", () => {
      const event = buildHairAuditUploadDeletedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
        legacy_upload_type: "patient_photo:front",
        deleted_at: "2026-06-17T13:00:00.000Z",
      });

      const result = evaluateFiImageIntelligenceEnqueue(event);

      assert.strictEqual(result.should_enqueue_image_intelligence, false);
      assert.ok(result.reason?.includes("deleted") || result.reason?.includes("suppression"));
      assert.strictEqual(result.input.deleted_at, "2026-06-17T13:00:00.000Z");
    });

    it("excludes training surface with explicit reason", () => {
      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "doctor",
        upload_surface: "training",
        source_case_table: "training_cases",
        storage_bucket: "academy-assets",
        storage_path: `academy/training-cases/${SAMPLE_CASE}/x.jpg`,
      });

      const result = evaluateFiImageIntelligenceEnqueue(event);

      assert.strictEqual(result.should_enqueue_image_intelligence, false);
      assert.ok(result.reason?.includes("training"));
    });

    it("excludes bulk_admin surface with explicit reason", () => {
      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "system",
        upload_surface: "bulk_admin",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `cases/bulk/batch/x.jpg`,
      });

      const result = evaluateFiImageIntelligenceEnqueue(event);
      assert.strictEqual(result.should_enqueue_image_intelligence, false);
      assert.ok(result.reason?.includes("bulk_admin"));
    });

    it("handles unknown category safely on forensic created events", () => {
      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "patient",
        upload_surface: "forensic_audit",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/weird/1.jpg`,
        legacy_upload_type: "patient_photo:not_a_real_category",
        canonical_photo_category: "other",
      });

      const result = evaluateFiImageIntelligenceEnqueue(event);

      assert.strictEqual(result.input.canonical_photo_category, "other");
      assert.strictEqual(result.should_enqueue_image_intelligence, false);
      assert.ok(result.reason?.includes("HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED"));
    });

    it("would enqueue forensic created only when FI flag enabled (plan only)", () => {
      process.env.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED = "true";

      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "patient",
        upload_surface: "forensic_audit",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
        legacy_upload_type: "patient_photo:front",
      });

      const result = evaluateFiImageIntelligenceEnqueue(event);
      assert.strictEqual(result.should_enqueue_image_intelligence, true);
      assert.ok(result.reason?.includes("not implemented"));
    });
  });

  describe("payload safety", () => {
    it("FI bridge input and flattened upload events contain no sensitive keys", () => {
      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "patient",
        upload_surface: "forensic_audit",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
      });

      const flat = flattenUploadEventForSink(event);
      assert.strictEqual(uploadEventPayloadIsSafe(flat).safe, true);

      const bridge = mapUploadEventToFiImageIntelligenceInput(event);
      assert.strictEqual(uploadEventPayloadIsSafe(bridge as unknown as Record<string, unknown>).safe, true);

      const forbiddenKeys = [
        "signed_url",
        "signedUrl",
        "public_url",
        "token",
        "access_token",
        "api_key",
        "secret",
      ];
      for (const key of forbiddenKeys) {
        assert.strictEqual(key in flat, false);
        assert.strictEqual(key in bridge, false);
      }
    });
  });

  describe("readiness checker phase 2g", () => {
    it("fails when delivery enabled without sink URL", () => {
      const lines = runHairAuditEventReadinessChecks({
        HAIRAUDIT_UPLOAD_EVENTS_ENABLED: "true",
        INTEGRATION_EVENTS_ENABLED: "true",
      });

      assert.ok(
        lines.some(
          (l) => l.status === "FAIL" && l.id === "INTEGRATION_EVENTS_SINK_URL"
        )
      );
    });

    it("fails on invalid headers JSON when set", () => {
      const lines = runHairAuditEventReadinessChecks({
        INTEGRATION_EVENTS_HEADERS: "{not-json",
      });

      assert.ok(
        lines.some((l) => l.status === "FAIL" && l.id === "INTEGRATION_EVENTS_HEADERS")
      );
      assert.strictEqual(validateIntegrationHeadersJson("{bad").ok, false);
    });

    it("warns that FI AI execution is not implemented when flag enabled", () => {
      const lines = runHairAuditEventReadinessChecks({
        HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED: "true",
      });

      assert.ok(lines.some((l) => l.id === "fi-ai-execution" && l.status === "WARN"));
    });
  });
});
