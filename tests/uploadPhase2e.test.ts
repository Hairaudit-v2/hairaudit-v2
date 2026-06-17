import { describe, it, afterEach, beforeEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  buildHairAuditUploadCreatedEvent,
  flattenUploadEventForSink,
  HAIRAUDIT_UPLOAD_EVENT_NAMES,
  resolveCanonicalCategoryForUploadEvent,
  uploadEventPayloadIsSafe,
} from "../src/lib/hairaudit/uploadEvents";
import {
  dispatchHairAuditUploadEvent,
  notifyHairAuditUploadCreated,
} from "../src/lib/hairaudit/uploadEventDispatcher";
import { setEventSink } from "../src/lib/integrations/sink";
import type { HairAuditEventSink } from "../src/lib/integrations/types";
import {
  compareUploadContractToManifestInput,
  identifyManifestCoverageGaps,
  normalizeLegacyUploadForManifest,
} from "../src/lib/hairaudit/evidenceManifestParity";

const REPO_ROOT = process.cwd();
const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

const UPLOAD_EMIT_ROUTES = [
  "src/app/api/uploads/patient-photos/route.ts",
  "src/app/api/uploads/audit-photos/route.ts",
  "src/app/api/uploads/clinic-photos/route.ts",
  "src/app/api/surgery-upload/photos/route.ts",
  "src/app/api/academy/uploads/route.ts",
  "src/app/api/admin/hair-audit/bulk-upload/images/route.ts",
];

describe("upload phase 2e", () => {
  describe("upload event builder", () => {
    it("maps patient_photo:front legacy type to canonical front category", () => {
      const category = resolveCanonicalCategoryForUploadEvent({
        legacy_upload_type: "patient_photo:front",
      });
      assert.strictEqual(category, "front");
    });

    it("maps surgery_photo slot to other when not a canonical category", () => {
      const category = resolveCanonicalCategoryForUploadEvent({
        legacy_upload_type: "surgery_photo:preop_donor",
        metadata_category: "preop_donor",
      });
      assert.strictEqual(category, "other");
    });

    it("buildHairAuditUploadCreatedEvent includes required contract fields", () => {
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

      assert.strictEqual(event.event_name, HAIRAUDIT_UPLOAD_EVENT_NAMES.CREATED);
      assert.strictEqual(event.event_version, "1.0");
      assert.strictEqual(event.case_id, SAMPLE_CASE);
      assert.strictEqual(event.upload_id, SAMPLE_UPLOAD);
      assert.strictEqual(event.canonical_photo_category, "front");
      assert.strictEqual(event.legacy_upload_type, "patient_photo:front");
      assert.strictEqual(event.metadata_version, "2.0");
    });
  });

  describe("payload safety", () => {
    it("rejects signed URL fields in flattened payload", () => {
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

      const unsafe = { ...flat, signed_url: "https://example.com/x?token=secret" };
      const check = uploadEventPayloadIsSafe(unsafe);
      assert.strictEqual(check.safe, false);
      if (!check.safe) {
        assert.ok(check.violations.length > 0);
      }
    });
  });

  describe("dispatcher non-blocking behaviour", () => {
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

    it("notifyHairAuditUploadCreated does not throw when sink throws", () => {
      setEventSink({
        async emit() {
          throw new Error("sink failure");
        },
      });
      process.env.HAIRAUDIT_UPLOAD_EVENTS_ENABLED = "true";
      process.env.INTEGRATION_EVENTS_ENABLED = "true";

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

    it("does not call integration sink when HAIRAUDIT_UPLOAD_EVENTS_ENABLED is off", async () => {
      let called = false;
      setEventSink({
        async emit() {
          called = true;
        },
      });
      delete process.env.HAIRAUDIT_UPLOAD_EVENTS_ENABLED;
      delete process.env.INTEGRATION_EVENTS_ENABLED;

      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "patient",
        upload_surface: "forensic_audit",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
      });

      dispatchHairAuditUploadEvent(event);
      await new Promise((r) => setTimeout(r, 25));
      assert.strictEqual(called, false);
    });

    it("forwards to integration sink when upload + integration flags enabled", async () => {
      const received: Array<{ name: string; payload: Record<string, unknown> }> = [];
      setEventSink({
        async emit(name, payload) {
          received.push({ name, payload });
        },
      });
      process.env.HAIRAUDIT_UPLOAD_EVENTS_ENABLED = "true";
      process.env.INTEGRATION_EVENTS_ENABLED = "true";

      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "clinic",
        upload_surface: "forensic_audit",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: `audit_photos/${SAMPLE_CASE}/clinic/front/x.jpg`,
        legacy_upload_type: "clinic_photo:front",
      });

      dispatchHairAuditUploadEvent(event);
      await new Promise((r) => setTimeout(r, 25));

      assert.strictEqual(received.length, 1);
      assert.strictEqual(received[0]?.name, HAIRAUDIT_UPLOAD_EVENT_NAMES.CREATED);
      assert.strictEqual(received[0]?.payload.upload_id, SAMPLE_UPLOAD);
    });
  });

  describe("upload routes emit after successful insert", () => {
    for (const rel of UPLOAD_EMIT_ROUTES) {
      it(`${rel} calls notifyHairAuditUploadCreated after DB success path`, () => {
        const abs = path.join(REPO_ROOT, rel);
        const src = fs.readFileSync(abs, "utf8");
        assert.match(src, /notifyHairAuditUploadCreated\s*\(/);
        assert.match(src, /upload_id:/);
        const notifyIdx = src.indexOf("notifyHairAuditUploadCreated({");
        assert.ok(notifyIdx >= 0, `${rel} must call notifyHairAuditUploadCreated with payload`);
        const insertIdx = src.indexOf('.insert(');
        assert.ok(notifyIdx > insertIdx, `${rel} should notify after insert`);
      });
    }
  });

  describe("evidence manifest parity helpers", () => {
    it("normalizeLegacyUploadForManifest classifies patient_photo rows", () => {
      const normalized = normalizeLegacyUploadForManifest({
        id: SAMPLE_UPLOAD,
        type: "patient_photo:top",
        storage_path: `cases/${SAMPLE_CASE}/patient/top/1.jpg`,
        metadata: { category: "top" },
      });
      assert.strictEqual(normalized.canonical_photo_category, "top");
      assert.strictEqual(normalized.actor_type, "patient");
      assert.strictEqual(normalized.source, "uploads");
    });

    it("identifyManifestCoverageGaps flags upload without audit_photos dual-write", () => {
      const gaps = identifyManifestCoverageGaps({
        uploads: [
          {
            id: SAMPLE_UPLOAD,
            type: "patient_photo:front",
            storage_path: `audit_photos/${SAMPLE_CASE}/patient/front/x.jpg`,
          },
        ],
        auditPhotos: [],
      });
      assert.ok(gaps.some((g) => g.kind === "upload_without_audit_photo"));
    });

    it("compareUploadContractToManifestInput matches aligned event and legacy row", () => {
      const legacy = normalizeLegacyUploadForManifest({
        id: SAMPLE_UPLOAD,
        type: "patient_photo:front",
        storage_path: `audit_photos/${SAMPLE_CASE}/patient/front/x.jpg`,
        metadata: { category: "front" },
      });
      const event = buildHairAuditUploadCreatedEvent({
        upload_id: SAMPLE_UPLOAD,
        case_id: SAMPLE_CASE,
        actor_type: "patient",
        upload_surface: "forensic_audit",
        source_case_table: "cases",
        storage_bucket: "case-files",
        storage_path: legacy.storage_path!,
        legacy_upload_type: legacy.legacy_upload_type!,
        canonical_photo_category: "front",
      });
      const cmp = compareUploadContractToManifestInput(event, legacy);
      assert.strictEqual(cmp.matches, true);
    });
  });
});
