import { describe, it, afterEach, beforeEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  buildHairAuditUploadDeletedEvent,
  flattenUploadEventForSink,
  HAIRAUDIT_UPLOAD_EVENT_NAMES,
  inferActorTypeFromLegacyType,
  inferUploadSurfaceFromLegacyType,
  uploadEventPayloadIsSafe,
} from "../src/lib/hairaudit/uploadEvents";
import {
  dispatchHairAuditUploadEvent,
  notifyHairAuditUploadDeleted,
} from "../src/lib/hairaudit/uploadEventDispatcher";
import { setEventSink } from "../src/lib/integrations/sink";
import type { HairAuditEventSink } from "../src/lib/integrations/types";
import {
  printReadinessReport,
  runHairAuditEventReadinessChecks,
} from "../scripts/check-hairaudit-event-readiness.mjs";

const REPO_ROOT = process.cwd();
const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const DELETE_ROUTE = "src/app/api/uploads/delete/route.ts";

describe("upload phase 2f", () => {
  describe("upload deleted event builder", () => {
    it("infers actor and surface from legacy patient_photo type", () => {
      assert.strictEqual(inferActorTypeFromLegacyType("patient_photo:front"), "patient");
      assert.strictEqual(inferUploadSurfaceFromLegacyType("patient_photo:front"), "forensic_audit");
    });

    it("infers surgery_evidence surface from surgery_photo type", () => {
      assert.strictEqual(inferUploadSurfaceFromLegacyType("surgery_photo:preop_donor"), "surgery_evidence");
    });

    it("buildHairAuditUploadDeletedEvent includes required contract fields", () => {
      const event = buildHairAuditUploadDeletedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
        legacy_upload_type: "patient_photo:front",
        deleted_at: "2026-06-17T13:00:00.000Z",
        occurred_at: "2026-06-17T12:00:00.000Z",
      });

      assert.strictEqual(event.event_name, HAIRAUDIT_UPLOAD_EVENT_NAMES.DELETED);
      assert.strictEqual(event.event_version, "1.0");
      assert.strictEqual(event.case_id, SAMPLE_CASE);
      assert.strictEqual(event.upload_id, SAMPLE_UPLOAD);
      assert.strictEqual(event.actor_type, "patient");
      assert.strictEqual(event.upload_surface, "forensic_audit");
      assert.strictEqual(event.canonical_photo_category, "front");
      assert.strictEqual(event.legacy_upload_type, "patient_photo:front");
      assert.strictEqual(event.metadata_version, "2.0");
      assert.strictEqual(event.deleted_at, "2026-06-17T13:00:00.000Z");
      assert.strictEqual(event.occurred_at, "2026-06-17T12:00:00.000Z");
    });
  });

  describe("deleted payload safety", () => {
    it("rejects signed URL fields in flattened deleted payload", () => {
      const event = buildHairAuditUploadDeletedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
      });
      const flat = flattenUploadEventForSink(event);
      assert.strictEqual(flat.deleted_at, event.deleted_at);
      assert.strictEqual(uploadEventPayloadIsSafe(flat).safe, true);

      const unsafe = { ...flat, access_token: "abc123" };
      const check = uploadEventPayloadIsSafe(unsafe);
      assert.strictEqual(check.safe, false);
      if (!check.safe) {
        assert.ok(check.violations.length > 0);
      }
    });
  });

  describe("dispatcher deleted path non-blocking", () => {
    const noopSink: HairAuditEventSink = { async emit() {} };
    const envBackup = { ...process.env };

    beforeEach(() => {
      setEventSink(noopSink);
      process.env = { ...envBackup };
    });

    afterEach(() => {
      setEventSink(noopSink);
      process.env = { ...envBackup };
    });

    it("notifyHairAuditUploadDeleted does not throw when sink throws", () => {
      setEventSink({
        async emit() {
          throw new Error("sink failure");
        },
      });
      process.env.HAIRAUDIT_UPLOAD_EVENTS_ENABLED = "true";
      process.env.INTEGRATION_EVENTS_ENABLED = "true";

      assert.doesNotThrow(() => {
        notifyHairAuditUploadDeleted({
          upload_id: SAMPLE_UPLOAD,
          case_id: SAMPLE_CASE,
          storage_bucket: "case-files",
          storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
          legacy_upload_type: "patient_photo:front",
        });
      });
    });

    it("forwards deleted event to integration sink when flags enabled", async () => {
      const received: Array<{ name: string; payload: Record<string, unknown> }> = [];
      setEventSink({
        async emit(name, payload) {
          received.push({ name, payload });
        },
      });
      process.env.HAIRAUDIT_UPLOAD_EVENTS_ENABLED = "true";
      process.env.INTEGRATION_EVENTS_ENABLED = "true";

      const event = buildHairAuditUploadDeletedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
        legacy_upload_type: "patient_photo:front",
        deleted_at: "2026-06-17T13:00:00.000Z",
      });

      dispatchHairAuditUploadEvent(event);
      await new Promise((r) => setTimeout(r, 25));

      assert.strictEqual(received.length, 1);
      assert.strictEqual(received[0]?.name, HAIRAUDIT_UPLOAD_EVENT_NAMES.DELETED);
      assert.strictEqual(received[0]?.payload.upload_id, SAMPLE_UPLOAD);
      assert.strictEqual(received[0]?.payload.deleted_at, "2026-06-17T13:00:00.000Z");
    });
  });

  describe("delete route emission placement", () => {
    it("calls notifyHairAuditUploadDeleted only after successful DB delete", () => {
      const abs = path.join(REPO_ROOT, DELETE_ROUTE);
      const src = fs.readFileSync(abs, "utf8");

      assert.match(src, /notifyHairAuditUploadDeleted\s*\(/);
      const notifyIdx = src.indexOf("notifyHairAuditUploadDeleted({");
      const dbDeleteIdx = src.indexOf('.from("uploads").delete()');
      assert.ok(notifyIdx >= 0, "delete route must call notifyHairAuditUploadDeleted");
      assert.ok(dbDeleteIdx >= 0, "delete route must delete uploads row");
      assert.ok(notifyIdx > dbDeleteIdx, "notify must run after DB delete");
    });

    it("does not emit before storage delete error return", () => {
      const abs = path.join(REPO_ROOT, DELETE_ROUTE);
      const src = fs.readFileSync(abs, "utf8");
      const storageErrIdx = src.indexOf("if (storageErr)");
      const notifyIdx = src.indexOf("notifyHairAuditUploadDeleted({");
      assert.ok(storageErrIdx >= 0);
      assert.ok(notifyIdx > storageErrIdx, "notify must run after storage error handling");
    });
  });

  describe("readiness checker", () => {
    it("flags unsafe service-role secret reuse", () => {
      const lines = runHairAuditEventReadinessChecks({
        SUPABASE_SERVICE_ROLE_KEY: "shared-secret-value",
        INTEGRATION_EVENTS_HEADERS: "Bearer shared-secret-value",
        HAIRAUDIT_UPLOAD_EVENTS_ENABLED: "false",
        INTEGRATION_EVENTS_ENABLED: "false",
      });

      assert.ok(lines.some((l) => l.status === "FAIL" && l.message.includes("SERVICE_ROLE")));
    });

    it("passes with safe defaults", () => {
      const lines = runHairAuditEventReadinessChecks({
        HAIRAUDIT_UPLOAD_EVENTS_ENABLED: "false",
        INTEGRATION_EVENTS_ENABLED: "false",
      });

      assert.ok(lines.some((l) => l.status === "PASS" && l.id === "delivery-gates"));
      assert.strictEqual(lines.some((l) => l.status === "FAIL"), false);
    });

    it("printReadinessReport exits non-zero on FAIL", () => {
      const code = printReadinessReport([
        { id: "test", status: "FAIL", message: "example failure" },
      ]);
      assert.strictEqual(code, 1);
    });
  });
});
