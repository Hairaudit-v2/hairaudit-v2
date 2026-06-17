import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  gateUploadCaseStoragePath,
  resolveCaseFilesBucketForRoute,
} from "../src/lib/hairaudit/uploadStorage";
import {
  findRouteConflicts,
  getUploadRouteById,
  validateRouteCompleteness,
  validateUniqueRouteIds,
} from "../src/lib/hairaudit/uploadRouteRegistry";
import { gateUploadSignedUrlStoragePath } from "../src/lib/uploads/caseFilesPath";
import { getErrorMessage } from "../src/lib/security/errorLogging";

const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const OTHER_CASE = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const SAMPLE_USER = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

const REPO_ROOT = process.cwd();

/** Routes migrated in Phase 2C — must use uploadStorage bucket helper, not inline fallback. */
const PHASE_2C_BUCKET_ROUTES = [
  "src/app/api/uploads/patient-photos/route.ts",
  "src/app/api/uploads/audit-photos/route.ts",
  "src/app/api/uploads/list/route.ts",
  "src/app/api/uploads/signed-url/route.ts",
  "src/app/api/surgery-upload/photos/route.ts",
  "src/app/api/uploads/delete/route.ts",
];

/** Legacy inline bucket pattern Phase 2C removes from active forensic upload routes. */
const INLINE_BUCKET_PATTERN = /process\.env\.CASE_FILES_BUCKET\s*\|\|\s*["']case-files["']/;

const DOCTOR_PHOTOS_ROUTE = path.join(REPO_ROOT, "src/app/api/uploads/doctor-photos/route.ts");

describe("upload phase 2c", () => {
  describe("central bucket resolution on target routes", () => {
    for (const rel of PHASE_2C_BUCKET_ROUTES) {
      it(`${rel} uses uploadStorage bucket helper`, () => {
        const abs = path.join(REPO_ROOT, rel);
        assert.ok(fs.existsSync(abs), `${rel} must exist`);
        const src = fs.readFileSync(abs, "utf8");
        assert.match(
          src,
          /resolveCaseFilesBucket(ForRoute)?\(/,
          `${rel} must call resolveCaseFilesBucket or resolveCaseFilesBucketForRoute`
        );
        assert.doesNotMatch(
          src,
          INLINE_BUCKET_PATTERN,
          `${rel} must not inline CASE_FILES_BUCKET fallback`
        );
      });
    }

    it("doctor-photos uses uploadStorage helper when not blocked (dev path)", () => {
      const src = fs.readFileSync(DOCTOR_PHOTOS_ROUTE, "utf8");
      assert.match(src, /resolveCaseFilesBucketForRoute\(/);
      assert.doesNotMatch(src, INLINE_BUCKET_PATTERN);
    });
  });

  describe("path generation accepted by gateUploadCaseStoragePath", () => {
    it("accepts patient upload path pattern", () => {
      const storagePath = `cases/${SAMPLE_CASE}/patient/front/${Date.now()}-photo.jpg`;
      const gate = gateUploadCaseStoragePath(SAMPLE_CASE, storagePath);
      assert.ok(gate.ok);
    });

    it("accepts audit-photos canonical path pattern", () => {
      const storagePath = `audit_photos/${SAMPLE_CASE}/doctor/img_front/${crypto.randomUUID()}.jpg`;
      const gate = gateUploadCaseStoragePath(SAMPLE_CASE, storagePath);
      assert.ok(gate.ok);
    });

    it("accepts surgery slot path pattern", () => {
      const storagePath = `cases/${SAMPLE_CASE}/surgery/pre-op/${Date.now()}-photo.jpg`;
      const gate = gateUploadCaseStoragePath(SAMPLE_CASE, storagePath);
      assert.ok(gate.ok);
      if (gate.ok) {
        assert.strictEqual(gate.normalizedPath, storagePath);
      }
    });

    it("accepts legacy doctor-photos path pattern (existing files)", () => {
      const storagePath = `cases/${SAMPLE_CASE}/doctor/img_front/${Date.now()}-photo.jpg`;
      const gate = gateUploadCaseStoragePath(SAMPLE_CASE, storagePath);
      assert.ok(gate.ok);
    });

    it("rejects legacy orphan {userId}/{caseId}/ layout", () => {
      const legacyPath = `${SAMPLE_USER}/${SAMPLE_CASE}/file.jpg`;
      const gate = gateUploadCaseStoragePath(SAMPLE_CASE, legacyPath);
      assert.strictEqual(gate.ok, false);
    });
  });

  describe("signed URL path hardening", () => {
    it("rejects traversal via gateUploadSignedUrlStoragePath", () => {
      const traversal = `cases/${SAMPLE_CASE}/../${OTHER_CASE}/patient/x.jpg`;
      const gate = gateUploadSignedUrlStoragePath(traversal, SAMPLE_CASE);
      assert.strictEqual(gate.ok, false);
    });

    it("rejects cross-case path when caseId query mismatches", () => {
      const p = `cases/${SAMPLE_CASE}/patient/x.jpg`;
      const gate = gateUploadSignedUrlStoragePath(p, OTHER_CASE);
      assert.strictEqual(gate.ok, false);
    });

    it("accepts valid surgery path for signing", () => {
      const p = `cases/${SAMPLE_CASE}/surgery/post-op-6mo/x.jpg`;
      const gate = gateUploadSignedUrlStoragePath(p, SAMPLE_CASE);
      assert.ok(gate.ok);
    });
  });

  describe("list route source guards", () => {
    const listRoute = path.join(REPO_ROOT, "src/app/api/uploads/list/route.ts");

    it("filters namespace and gates paths before signing", () => {
      const src = fs.readFileSync(listRoute, "utf8");
      assert.match(src, /filterUploadRowsToCaseStorageNamespace/);
      assert.match(src, /gateUploadCaseStoragePath/);
      assert.match(src, /requireCaseAccess/);
    });

    it("returns generic errors instead of raw Supabase messages", () => {
      const src = fs.readFileSync(listRoute, "utf8");
      assert.match(src, /Could not list uploads/);
      assert.match(src, /getErrorMessage/);
      assert.doesNotMatch(src, /error\.message/);
      assert.doesNotMatch(src, /signErr\.message/);
    });
  });

  describe("signed-url route source guards", () => {
    const signedRoute = path.join(REPO_ROOT, "src/app/api/uploads/signed-url/route.ts");

    it("requires auth and case access before signing", () => {
      const src = fs.readFileSync(signedRoute, "utf8");
      assert.match(src, /requireAuthenticatedUser/);
      assert.match(src, /requireCaseAccess/);
      assert.match(src, /gateUploadSignedUrlStoragePath/);
    });

    it("uses generic client-facing errors", () => {
      const src = fs.readFileSync(signedRoute, "utf8");
      assert.match(src, /Could not sign URL/);
      assert.match(src, /getErrorMessage/);
      assert.doesNotMatch(src, /error\?\.message/);
      assert.doesNotMatch(src, /error\.message/);
    });
  });

  describe("deprecated doctor-photos route", () => {
    it("returns 410 Gone in production before handler body", () => {
      const src = fs.readFileSync(DOCTOR_PHOTOS_ROUTE, "utf8");
      assert.match(src, /process\.env\.NODE_ENV === "production"/);
      assert.match(src, /status:\s*410/);
      assert.match(src, /audit-photos/);
    });

    it("registry marks doctor-photos as legacy with 410 mitigation", () => {
      const route = getUploadRouteById("doctor-photos-upload");
      assert.ok(route);
      assert.strictEqual(route.status, "legacy");
      assert.ok(route.notes?.includes("410"));
    });
  });

  describe("surgery upload Phase 2C scope", () => {
    const surgeryRoute = path.join(REPO_ROOT, "src/app/api/surgery-upload/photos/route.ts");

    it("gates generated surgery paths without forcing path migration", () => {
      const src = fs.readFileSync(surgeryRoute, "utf8");
      assert.match(src, /cases\/\$\{caseId\}\/surgery\//);
      assert.match(src, /gateUploadCaseStoragePath/);
    });
  });

  describe("resolveCaseFilesBucketForRoute", () => {
    const originalBucket = process.env.CASE_FILES_BUCKET;

    afterEach(() => {
      if (originalBucket === undefined) {
        delete process.env.CASE_FILES_BUCKET;
      } else {
        process.env.CASE_FILES_BUCKET = originalBucket;
      }
    });

    it("returns 503-safe message when bucket env is invalid", () => {
      process.env.CASE_FILES_BUCKET = "wrong-bucket";
      const result = resolveCaseFilesBucketForRoute();
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.status, 503);
        assert.strictEqual(result.error, "Storage is unavailable");
      }
    });

    it("returns bucket when env is valid", () => {
      process.env.CASE_FILES_BUCKET = "case-files";
      const result = resolveCaseFilesBucketForRoute();
      assert.ok(result.ok);
      if (result.ok) assert.strictEqual(result.bucket, "case-files");
    });
  });

  describe("getErrorMessage (upload route error logging)", () => {
    it("handles Error instance", () => {
      assert.strictEqual(getErrorMessage(new Error("db failed")), "db failed");
    });

    it("handles thrown string", () => {
      assert.strictEqual(getErrorMessage("oops"), "oops");
    });

    it("handles object without message", () => {
      assert.strictEqual(getErrorMessage({ code: "PGRST" }), "[object Object]");
    });

    it("handles Supabase-style error object with message", () => {
      assert.strictEqual(getErrorMessage({ message: "relation not found" }), "relation not found");
    });

    it("handles object with non-string message", () => {
      assert.strictEqual(getErrorMessage({ message: 42 }), "[object Object]");
    });
  });

  describe("upload route registry remains valid", () => {
    it("has unique route IDs", () => {
      assert.ok(validateUniqueRouteIds().valid);
    });

    it("has complete route entries", () => {
      assert.ok(validateRouteCompleteness().valid);
    });

    it("has no HTTP route conflicts", () => {
      assert.ok(!findRouteConflicts().hasConflicts);
    });
  });
});

export {};
