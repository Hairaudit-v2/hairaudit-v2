import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_CASE_FILES_BUCKET,
  gateUploadCaseStoragePath,
  isWellFormedUploadId,
  requireConfiguredCaseFilesBucket,
  resolveCaseFilesBucket,
  storagePathMatchesUploadCase,
} from "../src/lib/hairaudit/uploadStorage";
import {
  findRouteConflicts,
  getRegistrySummary,
  getUploadRouteById,
  getUploadRoutesByStatus,
  validateRouteCompleteness,
  validateUniqueRouteIds,
} from "../src/lib/hairaudit/uploadRouteRegistry";

const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const OTHER_CASE = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const SAMPLE_USER = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

const UPLOAD_PANEL_PATH = path.join(
  process.cwd(),
  "src/app/cases/[caseId]/upload-panel.tsx"
);

describe("upload phase 2b", () => {
  describe("orphan upload-panel removal", () => {
    it("upload-panel.tsx no longer exists on disk", () => {
      assert.strictEqual(
        fs.existsSync(UPLOAD_PANEL_PATH),
        false,
        "upload-panel.tsx must be deleted in Phase 2B"
      );
    });

    it("upload-panel is not importable from the removed path", () => {
      assert.throws(
        () => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("../src/app/cases/[caseId]/upload-panel.tsx");
        },
        (err: NodeJS.ErrnoException) => err?.code === "MODULE_NOT_FOUND" || err?.code === "ENOENT"
      );
    });

    it("upload-panel-legacy registry entry removed after deletion", () => {
      assert.strictEqual(getUploadRouteById("upload-panel-legacy"), undefined);
    });
  });

  describe("uploadStorage path gates", () => {
    it("accepts cases/{caseId}/ patient paths", () => {
      const storagePath = `cases/${SAMPLE_CASE}/patient/front/photo.jpg`;
      const gate = gateUploadCaseStoragePath(SAMPLE_CASE, storagePath);
      assert.ok(gate.ok);
      if (gate.ok) {
        assert.strictEqual(gate.caseId, SAMPLE_CASE);
        assert.strictEqual(gate.normalizedPath, storagePath);
      }
    });

    it("accepts audit_photos/{caseId}/ paths", () => {
      const storagePath = `audit_photos/${SAMPLE_CASE}/auditor/front/photo.jpg`;
      const gate = gateUploadCaseStoragePath(SAMPLE_CASE, storagePath);
      assert.ok(gate.ok);
    });

    it("rejects legacy orphan {userId}/{caseId}/ paths", () => {
      const legacyPath = `${SAMPLE_USER}/${SAMPLE_CASE}/file.jpg`;
      const gate = gateUploadCaseStoragePath(SAMPLE_CASE, legacyPath);
      assert.strictEqual(gate.ok, false);
      if (!gate.ok) {
        assert.strictEqual(gate.status, 403);
        assert.strictEqual(gate.error, "Invalid storage path");
      }
    });

    it("rejects path traversal segments", () => {
      const traversalPath = `cases/${SAMPLE_CASE}/../${OTHER_CASE}/patient/x.jpg`;
      const gate = gateUploadCaseStoragePath(SAMPLE_CASE, traversalPath);
      assert.strictEqual(gate.ok, false);
      if (!gate.ok) assert.strictEqual(gate.status, 403);
    });

    it("rejects encoded path traversal", () => {
      const encoded = `cases/${SAMPLE_CASE}/%2e%2e/${OTHER_CASE}/x.jpg`;
      const gate = gateUploadCaseStoragePath(SAMPLE_CASE, encoded);
      assert.strictEqual(gate.ok, false);
    });

    it("rejects storage paths for a different case id", () => {
      const otherPath = `cases/${OTHER_CASE}/patient/front/x.jpg`;
      const gate = gateUploadCaseStoragePath(SAMPLE_CASE, otherPath);
      assert.strictEqual(gate.ok, false);
      if (!gate.ok) assert.strictEqual(gate.status, 403);
    });

    it("rejects empty storage path", () => {
      const gate = gateUploadCaseStoragePath(SAMPLE_CASE, "");
      assert.strictEqual(gate.ok, false);
      if (!gate.ok) assert.strictEqual(gate.status, 400);
    });

    it("storagePathMatchesUploadCase aligns with gate", () => {
      const okPath = `cases/${SAMPLE_CASE}/patient/front/x.jpg`;
      assert.strictEqual(storagePathMatchesUploadCase(SAMPLE_CASE, okPath), true);
      assert.strictEqual(storagePathMatchesUploadCase(OTHER_CASE, okPath), false);
    });
  });

  describe("upload delete access prerequisites", () => {
    it("requires well-formed uploadId before DB lookup", () => {
      assert.strictEqual(isWellFormedUploadId("not-a-uuid"), false);
      assert.strictEqual(isWellFormedUploadId(""), false);
      assert.strictEqual(isWellFormedUploadId(SAMPLE_CASE), true);
    });

    it("path gate requires case id on upload row to match storage namespace", () => {
      const pathForCase = `cases/${SAMPLE_CASE}/patient/front/x.jpg`;
      assert.ok(gateUploadCaseStoragePath(SAMPLE_CASE, pathForCase).ok);
      assert.strictEqual(gateUploadCaseStoragePath(OTHER_CASE, pathForCase).ok, false);
    });
  });

  describe("case-files bucket resolver", () => {
    const originalBucket = process.env.CASE_FILES_BUCKET;

    afterEach(() => {
      if (originalBucket === undefined) {
        delete process.env.CASE_FILES_BUCKET;
      } else {
        process.env.CASE_FILES_BUCKET = originalBucket;
      }
    });

    it("uses CASE_FILES_BUCKET when set to case-files", () => {
      process.env.CASE_FILES_BUCKET = "case-files";
      const result = resolveCaseFilesBucket();
      assert.ok(result.ok);
      if (result.ok) {
        assert.strictEqual(result.bucket, "case-files");
        assert.strictEqual(result.source, "env");
      }
    });

    it("defaults safely when env unset (dev fallback)", () => {
      delete process.env.CASE_FILES_BUCKET;
      const result = resolveCaseFilesBucket();
      assert.ok(result.ok);
      if (result.ok) {
        assert.strictEqual(result.bucket, DEFAULT_CASE_FILES_BUCKET);
        assert.strictEqual(result.source, "default");
      }
    });

    it("fails safely when env is an unknown bucket name", () => {
      process.env.CASE_FILES_BUCKET = "wrong-bucket";
      const result = resolveCaseFilesBucket();
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.ok(result.error.length > 0);
      }
    });

    it("strict resolver fails safely when env missing", () => {
      delete process.env.CASE_FILES_BUCKET;
      const result = requireConfiguredCaseFilesBucket();
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.error, "Storage bucket is not configured");
      }
    });
  });

  describe("upload route registry post-2b", () => {
    it("uploads-delete is marked keep after hardening", () => {
      const route = getUploadRouteById("uploads-delete");
      assert.ok(route);
      assert.strictEqual(route.status, "keep");
    });

    it("has no routes marked for deletion", () => {
      assert.deepStrictEqual(getUploadRoutesByStatus("delete"), []);
    });

    it("registry validation still passes", () => {
      assert.ok(validateUniqueRouteIds().valid);
      assert.ok(validateRouteCompleteness().valid);
      assert.ok(!findRouteConflicts().hasConflicts);
    });

    it("registry summary has zero critical-risk routes after orphan removal", () => {
      const summary = getRegistrySummary();
      assert.strictEqual(summary.markedForDeletion.length, 0);
      assert.strictEqual(summary.criticalRiskCount, 0);
    });
  });
});

export {};
