import { describe, it, afterEach, beforeEach } from "node:test";
import assert from "node:assert";
import {
  buildHairAuditUploadCreatedEvent,
  buildHairAuditUploadDeletedEvent,
  HAIRAUDIT_UPLOAD_EVENT_NAMES,
} from "../src/lib/hairaudit/uploadEvents";
import {
  maybeEnqueueFiImageIntelligenceFromUploadEvent,
  planFiImageIntelligenceEnqueue,
} from "../src/lib/hairaudit/fiImageIntelligenceEnqueue";
import {
  buildFiImageIntelligenceIdempotencyKey,
  FI_IMAGE_INTELLIGENCE_IDEMPOTENCY_VERSION,
  resetFiImageIntelligenceQueueInjection,
  setFiImageIntelligenceQueue,
  type FiImageIntelligenceJobPayload,
} from "../src/lib/hairaudit/fiImageIntelligenceQueue";
import { notifyHairAuditUploadCreated } from "../src/lib/hairaudit/uploadEventDispatcher";
import { setEventSink } from "../src/lib/integrations/sink";

const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

describe("upload phase 3a", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    resetFiImageIntelligenceQueueInjection();
    setEventSink({ async emit() {} });
  });

  describe("idempotency key", () => {
    it("uses hairaudit:image-intelligence:{case_id}:{upload_id}:v1 format", () => {
      const key = buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD);
      assert.strictEqual(
        key,
        `hairaudit:image-intelligence:${SAMPLE_CASE}:${SAMPLE_UPLOAD}:${FI_IMAGE_INTELLIGENCE_IDEMPOTENCY_VERSION}`
      );
    });

    it("trims case and upload ids", () => {
      const key = buildFiImageIntelligenceIdempotencyKey(
        `  ${SAMPLE_CASE}  `,
        `  ${SAMPLE_UPLOAD}  `
      );
      assert.strictEqual(
        key,
        `hairaudit:image-intelligence:${SAMPLE_CASE}:${SAMPLE_UPLOAD}:v1`
      );
    });
  });

  describe("enabled / disabled", () => {
    it("does not enqueue when HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED is off", async () => {
      delete process.env.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED;

      let called = false;
      setFiImageIntelligenceQueue({
        async enqueue() {
          called = true;
          return { enqueued: true };
        },
      });

      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "patient",
        upload_surface: "forensic_audit",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
      });

      const plan = planFiImageIntelligenceEnqueue(event);
      assert.strictEqual(plan.should_enqueue_image_intelligence, false);
      assert.ok(plan.reason?.includes("HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED"));

      const summary = await maybeEnqueueFiImageIntelligenceFromUploadEvent(event);
      assert.strictEqual(called, false);
      assert.strictEqual(summary.enqueued, false);
    });

    it("enqueues forensic_audit created when FI flag enabled", async () => {
      process.env.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED = "true";

      const payloads: FiImageIntelligenceJobPayload[] = [];
      setFiImageIntelligenceQueue({
        async enqueue(payload) {
          payloads.push(payload);
          return { enqueued: true, idempotency_key: payload.idempotency_key };
        },
      });

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

      const plan = planFiImageIntelligenceEnqueue(event);
      assert.strictEqual(plan.should_enqueue_image_intelligence, true);
      assert.strictEqual(
        plan.idempotency_key,
        buildFiImageIntelligenceIdempotencyKey(SAMPLE_CASE, SAMPLE_UPLOAD)
      );

      const summary = await maybeEnqueueFiImageIntelligenceFromUploadEvent(event);
      assert.strictEqual(summary.enqueued, true);
      assert.strictEqual(payloads.length, 1);
      assert.strictEqual(payloads[0]?.idempotency_key, plan.idempotency_key);
      assert.strictEqual(payloads[0]?.input.source_upload_id, SAMPLE_UPLOAD);
      assert.strictEqual(payloads[0]?.input.upload_surface, "forensic_audit");
    });

    it("enqueues surgery_evidence created when FI flag enabled", async () => {
      process.env.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED = "true";

      let enqueued = false;
      setFiImageIntelligenceQueue({
        async enqueue(payload) {
          enqueued = true;
          assert.strictEqual(payload.input.upload_surface, "surgery_evidence");
          return { enqueued: true, idempotency_key: payload.idempotency_key };
        },
      });

      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "doctor",
        upload_surface: "surgery_evidence",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/surgery/x.jpg`,
        legacy_upload_type: "surgery_photo:preop_donor",
      });

      const summary = await maybeEnqueueFiImageIntelligenceFromUploadEvent(event);
      assert.strictEqual(enqueued, true);
      assert.strictEqual(summary.enqueued, true);
    });
  });

  describe("ineligible surfaces and events", () => {
    beforeEach(() => {
      process.env.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED = "true";
    });

    it("skips upload.deleted with explicit reason", async () => {
      let called = false;
      setFiImageIntelligenceQueue({
        async enqueue() {
          called = true;
          return { enqueued: true };
        },
      });

      const event = buildHairAuditUploadDeletedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
        deleted_at: "2026-06-17T13:00:00.000Z",
      });

      const summary = await maybeEnqueueFiImageIntelligenceFromUploadEvent(event);
      assert.strictEqual(called, false);
      assert.strictEqual(summary.enqueued, false);
      assert.ok(summary.skippedReason?.includes("upload.created"));
    });

    it("excludes training with explicit reason", async () => {
      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "doctor",
        upload_surface: "training",
        source_case_table: "training_cases",
        storage_bucket: "academy-assets",
        storage_path: `academy/training-cases/${SAMPLE_CASE}/x.jpg`,
      });

      const plan = planFiImageIntelligenceEnqueue(event);
      assert.strictEqual(plan.should_enqueue_image_intelligence, false);
      assert.ok(plan.reason?.includes("training"));
    });

    it("excludes community with explicit reason", async () => {
      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "community",
        upload_surface: "community",
        source_case_table: "community_cases",
        storage_bucket: "case-files",
        storage_path: `community/${SAMPLE_CASE}/x.jpg`,
      });

      const plan = planFiImageIntelligenceEnqueue(event);
      assert.strictEqual(plan.should_enqueue_image_intelligence, false);
      assert.ok(plan.reason?.includes("community"));
    });

    it("excludes bulk_admin with explicit reason", async () => {
      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "system",
        upload_surface: "bulk_admin",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `cases/bulk/batch/x.jpg`,
      });

      const plan = planFiImageIntelligenceEnqueue(event);
      assert.strictEqual(plan.should_enqueue_image_intelligence, false);
      assert.ok(plan.reason?.includes("bulk_admin"));
    });

    it("excludes doctor_portal with explicit reason", async () => {
      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "doctor",
        upload_surface: "doctor_portal",
        source_case_table: "doctor_cases",
        storage_bucket: "case-files",
        storage_path: `doctor/${SAMPLE_CASE}/x.jpg`,
      });

      const plan = planFiImageIntelligenceEnqueue(event);
      assert.strictEqual(plan.should_enqueue_image_intelligence, false);
      assert.ok(plan.reason?.includes("doctor_portal"));
    });
  });

  describe("non-blocking failure", () => {
    it("does not throw when queue adapter rejects", async () => {
      process.env.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED = "true";

      setFiImageIntelligenceQueue({
        async enqueue() {
          throw new Error("queue unavailable");
        },
      });

      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "patient",
        upload_surface: "forensic_audit",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
      });

      await assert.doesNotReject(async () => {
        const summary = await maybeEnqueueFiImageIntelligenceFromUploadEvent(event);
        assert.strictEqual(summary.enqueued, false);
        assert.ok(summary.error);
      });
    });

    it("notifyHairAuditUploadCreated does not throw when enqueue fails", () => {
      process.env.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED = "true";

      setFiImageIntelligenceQueue({
        async enqueue() {
          throw new Error("queue down");
        },
      });

      assert.doesNotThrow(() => {
        notifyHairAuditUploadCreated({
          upload_id: SAMPLE_UPLOAD,
          case_id: SAMPLE_CASE,
          actor_type: "patient",
          upload_surface: "forensic_audit",
          source_case_table: "cases",
          storage_bucket: "case-files",
          storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
        });
      });
    });

    it("FI enqueue is independent of HAIRAUDIT_UPLOAD_EVENTS_ENABLED", async () => {
      process.env.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED = "true";
      delete process.env.HAIRAUDIT_UPLOAD_EVENTS_ENABLED;
      delete process.env.INTEGRATION_EVENTS_ENABLED;

      let sinkCalled = false;
      let queueCalled = false;

      setEventSink({
        async emit() {
          sinkCalled = true;
        },
      });
      setFiImageIntelligenceQueue({
        async enqueue() {
          queueCalled = true;
          return { enqueued: true };
        },
      });

      notifyHairAuditUploadCreated({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "patient",
        upload_surface: "forensic_audit",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      assert.strictEqual(sinkCalled, false);
      assert.strictEqual(queueCalled, true);
    });
  });
});
