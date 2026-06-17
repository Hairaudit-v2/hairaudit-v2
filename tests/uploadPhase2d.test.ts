import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  APPROVED_INLINE_BUCKET_SRC_EXCEPTIONS,
  gateUploadCaseStoragePath,
  getCaseFilesBucketNameForReadOnlyUse,
  resolveCaseFilesBucketForReportRender,
  resolveCaseFilesBucketForServerJob,
  resolveCaseFilesBucketForRoute,
} from "../src/lib/hairaudit/uploadStorage";
import {
  findRouteConflicts,
  getUploadRouteById,
  validateRouteCompleteness,
  validateUniqueRouteIds,
} from "../src/lib/hairaudit/uploadRouteRegistry";
import { PATH_CONVENTIONS, type PathConvention } from "../src/lib/hairaudit/uploadContract";

const REPO_ROOT = process.cwd();
const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_USER = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

const INLINE_BUCKET_PATTERN = /process\.env\.CASE_FILES_BUCKET\s*\|\|\s*["']case-files["']/;

/** Forensic upload routes migrated in Phase 2D (includes 2C set + clinic-photos). */
const PHASE_2D_BUCKET_ROUTES = [
  "src/app/api/uploads/patient-photos/route.ts",
  "src/app/api/uploads/audit-photos/route.ts",
  "src/app/api/uploads/clinic-photos/route.ts",
  "src/app/api/uploads/list/route.ts",
  "src/app/api/uploads/signed-url/route.ts",
  "src/app/api/surgery-upload/photos/route.ts",
  "src/app/api/uploads/delete/route.ts",
];

/** Infra / pipeline files migrated to uploadStorage helpers in Phase 2D. */
const PHASE_2D_INFRA_FILES = [
  "src/lib/inngest/functions.ts",
  "src/lib/inngest/functions/caseSubmitted.ts",
  "src/lib/inngest/functions/surgeryUploadEvidenceReviewReport.ts",
  "src/lib/reports/renderPdfInternal.ts",
  "src/lib/reports/reportAccess.ts",
  "src/app/api/print/report/route.ts",
  "src/app/api/print/legacy-report/route.ts",
  "src/app/api/reports/signed-url/route.ts",
  "src/app/reports/[caseId]/html/page.tsx",
  "src/app/api/auditor/patient-uploads/route.ts",
  "src/app/cases/[caseId]/actions.ts",
  "src/app/api/surgery-upload/cases/[caseId]/photo-export/route.ts",
  "src/app/api/academy/uploads/route.ts",
  "src/app/api/academy/signed-url/route.ts",
  "src/app/api/academy/uploads/[uploadId]/route.ts",
  "src/app/api/admin/hair-audit/bulk-upload/images/route.ts",
  "src/app/api/admin/hair-audit/bulk-upload/signed-url/route.ts",
  "src/app/api/admin/hair-audit/bulk-upload/images/[imageId]/route.ts",
  "src/lib/academy/trainingCaseReviews/aiDrafts.ts",
  "src/lib/academy/trainingCaseCorrections/service.ts",
];

/** Non-src paths allowed to keep inline bucket fallback (harness / scripts). */
const APPROVED_NON_SRC_INLINE_EXCEPTIONS = [
  "tests/audit-harness/runner.ts",
  "tests/audit-harness/helpers/uploads.ts",
  "tests/audit-harness/helpers/db.ts",
  "scripts/run-test-audits.ts",
  "scripts/lib/testCaseFactory.ts",
];

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkTsFiles(abs, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

function relFromRoot(abs: string): string {
  return path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
}

type PathConventionSample = { convention: PathConvention; sample: string; gated: boolean };

const PATH_CONVENTION_SAMPLES: PathConventionSample[] = [
  {
    convention: "forensic_patient",
    sample: `cases/${SAMPLE_CASE}/patient/front/photo.jpg`,
    gated: true,
  },
  {
    convention: "forensic_clinic",
    sample: `cases/${SAMPLE_CASE}/clinic/facilities/photo.jpg`,
    gated: true,
  },
  {
    convention: "forensic_doctor",
    sample: `cases/${SAMPLE_CASE}/doctor/img_front/photo.jpg`,
    gated: true,
  },
  {
    convention: "surgery_slot",
    sample: `cases/${SAMPLE_CASE}/surgery/pre-op/photo.jpg`,
    gated: true,
  },
  {
    convention: "audit_canonical",
    sample: `audit_photos/${SAMPLE_CASE}/auditor/front/photo.jpg`,
    gated: true,
  },
  {
    convention: "bulk_staging",
    sample: `cases/bulk/b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22/photo.jpg`,
    gated: false,
  },
  {
    convention: "academy_isolated",
    sample: `academy/training-cases/${SAMPLE_CASE}/front/photo.jpg`,
    gated: false,
  },
  {
    convention: "legacy_orphan",
    sample: `${SAMPLE_USER}/${SAMPLE_CASE}/photo.jpg`,
    gated: false,
  },
];

describe("upload phase 2d", () => {
  describe("clinic-photos route", () => {
    const clinicRoute = path.join(REPO_ROOT, "src/app/api/uploads/clinic-photos/route.ts");

    it("uses uploadStorage bucket helper and path gate", () => {
      const src = fs.readFileSync(clinicRoute, "utf8");
      assert.match(src, /resolveCaseFilesBucketForRoute\(/);
      assert.match(src, /gateUploadCaseStoragePath/);
      assert.match(src, /cases\/\$\{caseId\}\/clinic\//);
      assert.doesNotMatch(src, INLINE_BUCKET_PATTERN);
    });

    it("returns generic errors for storage failures", () => {
      const src = fs.readFileSync(clinicRoute, "utf8");
      assert.match(src, /Upload failed/);
      assert.doesNotMatch(src, /upErr\.message/);
    });

    it("registry marks clinic-photos as active (not deprecated)", () => {
      const route = getUploadRouteById("clinic-photos-upload");
      assert.ok(route);
      assert.strictEqual(route.status, "keep");
      assert.ok(route.notes?.includes("audit-photos") || route.notes?.includes("clinic"));
    });
  });

  describe("central bucket resolution on forensic routes", () => {
    for (const rel of PHASE_2D_BUCKET_ROUTES) {
      it(`${rel} uses uploadStorage bucket helper`, () => {
        const abs = path.join(REPO_ROOT, rel);
        const src = fs.readFileSync(abs, "utf8");
        assert.match(
          src,
          /resolveCaseFilesBucket(ForRoute)?\(/,
          `${rel} must call resolveCaseFilesBucket or resolveCaseFilesBucketForRoute`
        );
        assert.doesNotMatch(src, INLINE_BUCKET_PATTERN);
      });
    }
  });

  describe("infra bucket helpers on pipeline files", () => {
    for (const rel of PHASE_2D_INFRA_FILES) {
      it(`${rel} uses uploadStorage helper (no inline fallback)`, () => {
        const abs = path.join(REPO_ROOT, rel);
        const src = fs.readFileSync(abs, "utf8");
        assert.doesNotMatch(src, INLINE_BUCKET_PATTERN);
        assert.match(
          src,
          /uploadStorage/,
          `${rel} must import from uploadStorage`
        );
      });
    }
  });

  describe("server-job and report render helpers", () => {
    const originalBucket = process.env.CASE_FILES_BUCKET;

    afterEach(() => {
      if (originalBucket === undefined) {
        delete process.env.CASE_FILES_BUCKET;
      } else {
        process.env.CASE_FILES_BUCKET = originalBucket;
      }
    });

    it("resolveCaseFilesBucketForServerJob mirrors env validation", () => {
      process.env.CASE_FILES_BUCKET = "wrong-bucket";
      const result = resolveCaseFilesBucketForServerJob();
      assert.strictEqual(result.ok, false);

      process.env.CASE_FILES_BUCKET = "case-files";
      const ok = resolveCaseFilesBucketForServerJob();
      assert.ok(ok.ok);
      if (ok.ok) assert.strictEqual(ok.bucket, "case-files");
    });

    it("resolveCaseFilesBucketForReportRender returns bucket for valid env", () => {
      process.env.CASE_FILES_BUCKET = "case-files";
      const result = resolveCaseFilesBucketForReportRender();
      assert.ok(result.ok);
      if (result.ok) assert.strictEqual(result.bucket, "case-files");
    });

    it("getCaseFilesBucketNameForReadOnlyUse throws on invalid env", () => {
      process.env.CASE_FILES_BUCKET = "wrong-bucket";
      assert.throws(() => getCaseFilesBucketNameForReadOnlyUse(), /Storage is not configured correctly/);
    });

    it("getCaseFilesBucketNameForReadOnlyUse returns default when env unset", () => {
      delete process.env.CASE_FILES_BUCKET;
      assert.strictEqual(getCaseFilesBucketNameForReadOnlyUse(), "case-files");
    });
  });

  describe("path convention classification", () => {
    for (const { convention, sample, gated } of PATH_CONVENTION_SAMPLES) {
      it(`${convention} sample is ${gated ? "accepted" : "not accepted"} by gateUploadCaseStoragePath`, () => {
        assert.ok(PATH_CONVENTIONS.includes(convention));
        const gate = gateUploadCaseStoragePath(SAMPLE_CASE, sample);
        assert.strictEqual(gate.ok, gated, `path: ${sample}`);
      });
    }
  });

  describe("src inline bucket audit", () => {
    it("no unapproved inline CASE_FILES_BUCKET fallbacks under src/", () => {
      const srcFiles = walkTsFiles(path.join(REPO_ROOT, "src"));
      const approved = new Set<string>([...APPROVED_INLINE_BUCKET_SRC_EXCEPTIONS]);
      const violations: string[] = [];

      for (const abs of srcFiles) {
        const rel = relFromRoot(abs);
        if (approved.has(rel)) continue;
        const src = fs.readFileSync(abs, "utf8");
        if (INLINE_BUCKET_PATTERN.test(src)) {
          violations.push(rel);
        }
      }

      assert.deepStrictEqual(
        violations,
        [],
        `Unapproved inline bucket usage:\n${violations.join("\n")}`
      );
    });
  });

  describe("approved non-src inline exceptions", () => {
    for (const rel of APPROVED_NON_SRC_INLINE_EXCEPTIONS) {
      it(`${rel} is listed as approved harness/script exception`, () => {
        const abs = path.join(REPO_ROOT, rel);
        assert.ok(fs.existsSync(abs), `${rel} should exist`);
      });
    }
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
