import { describe, it } from "node:test";
import assert from "node:assert";
import { PATIENT_UPLOAD_CATEGORY_DEFS } from "../src/lib/patientPhotoCategoryConfig";
import { PATIENT_PHOTO_SCHEMA } from "../src/lib/auditPhotoSchemas";

describe("Patient upload category validation", () => {
  const allPatientCategoryKeys = new Set(PATIENT_UPLOAD_CATEGORY_DEFS.map((d) => d.key));
  const schemaCategoryKeys = new Set(PATIENT_PHOTO_SCHEMA.map((c) => c.key));

  describe("Category set coverage", () => {
    it("should include standard upload categories in schema", () => {
      // PATIENT_PHOTO_SCHEMA includes audit bucket keys (patient_current_*, any_*)
      // which are different from upload keys (preop_*, day0_*)
      // The schemas map to each other via mapsToAuditEvidenceKey
      const standardUploadKeys = [
        "preop_front", "preop_left", "preop_right", "preop_top", "preop_crown", "preop_donor_rear",
        "day0_recipient", "day0_donor", "intraop", "postop_day0"
      ];
      for (const key of standardUploadKeys) {
        assert.ok(
          allPatientCategoryKeys.has(key),
          `Standard upload key ${key} should be in PATIENT_UPLOAD_CATEGORY_DEFS`
        );
      }
    });

    it("should have more extended categories than schema", () => {
      assert.ok(
        PATIENT_UPLOAD_CATEGORY_DEFS.length > PATIENT_PHOTO_SCHEMA.length,
        "Extended categories should exist beyond schema"
      );
    });

    it("should include graft tray categories in upload defs", () => {
      const graftTrayCats = [
        "graft_tray_overview",
        "graft_tray_closeup",
        "graft_sorting",
        "graft_hydration_solution",
        "graft_count_board",
      ];

      for (const cat of graftTrayCats) {
        assert.ok(
          allPatientCategoryKeys.has(cat),
          `Graft tray category ${cat} should be valid`
        );
      }
    });

    it("should include milestone follow-up categories", () => {
      const milestoneCats = [
        "postop_month3_front",
        "postop_month3_top",
        "postop_month6_front",
        "postop_month6_top",
        "postop_month12_front",
        "postop_month12_top",
      ];

      for (const cat of milestoneCats) {
        assert.ok(
          allPatientCategoryKeys.has(cat),
          `Milestone category ${cat} should be valid`
        );
      }
    });

    it("should include donor monitoring categories", () => {
      const donorCats = [
        "postop_month3_donor",
        "postop_month6_donor",
        "postop_month9_donor",
        "postop_month12_donor",
      ];

      for (const cat of donorCats) {
        assert.ok(
          allPatientCategoryKeys.has(cat),
          `Donor monitoring category ${cat} should be valid`
        );
      }
    });
  });

  describe("Category configuration", () => {
    it("should have valid maxFiles for all categories", () => {
      for (const cat of PATIENT_UPLOAD_CATEGORY_DEFS) {
        assert.ok(cat.maxFiles > 0, `${cat.key} should have positive maxFiles`);
        assert.ok(cat.maxFiles <= 50, `${cat.key} maxFiles should be reasonable`);
      }
    });

    it("should have valid accept types", () => {
      for (const cat of PATIENT_UPLOAD_CATEGORY_DEFS) {
        assert.ok(cat.accept, `${cat.key} should have accept type`);
        assert.ok(cat.accept.includes("image"), `${cat.key} should accept images`);
      }
    });

    it("should have required flag for standard categories", () => {
      const requiredCats = PATIENT_UPLOAD_CATEGORY_DEFS.filter((c) => c.required);
      assert.ok(requiredCats.length > 0, "Should have required categories");

      // Standard required categories
      const standardRequired = ["preop_front", "preop_left", "preop_right", "preop_top", "preop_crown", "preop_donor_rear"];
      for (const cat of standardRequired) {
        const def = PATIENT_UPLOAD_CATEGORY_DEFS.find((d) => d.key === cat);
        assert.ok(def?.required, `${cat} should be required`);
      }
    });

    it("should have extended categories as optional", () => {
      const extendedCats = [
        "graft_tray_overview",
        "postop_month3_front",
        "postop_month6_front",
        "intraop_extraction",
      ];

      for (const cat of extendedCats) {
        const def = PATIENT_UPLOAD_CATEGORY_DEFS.find((d) => d.key === cat);
        assert.ok(def, `${cat} should exist`);
        assert.strictEqual(def?.required, false, `${cat} should be optional`);
      }
    });
  });

  describe("Unified category set for API validation", () => {
    it("audit-photos route should accept all upload defs", () => {
      // This mirrors the logic in audit-photos/route.ts
      const PATIENT_AUDIT_PHOTO_KEYS = new Set([
        ...PATIENT_PHOTO_SCHEMA.map((c) => c.key),
        ...PATIENT_UPLOAD_CATEGORY_DEFS.map((d) => d.key),
      ]);

      for (const cat of PATIENT_UPLOAD_CATEGORY_DEFS) {
        assert.ok(
          PATIENT_AUDIT_PHOTO_KEYS.has(cat.key),
          `${cat.key} should be valid in audit-photos route`
        );
      }
    });

    it("patient-photos route should accept all upload defs", () => {
      // This mirrors the validation in patient-photos/route.ts
      const { PatientPhotoCategorySchema } = require("../src/lib/photoCategories");

      for (const cat of PATIENT_UPLOAD_CATEGORY_DEFS) {
        const result = PatientPhotoCategorySchema.safeParse(cat.key);
        assert.ok(
          result.success,
          `${cat.key} should be valid in patient-photos route`
        );
      }
    });
  });

  describe("Graft tray categories", () => {
    it("should have correct configuration for graft tray overview", () => {
      const def = PATIENT_UPLOAD_CATEGORY_DEFS.find((d) => d.key === "graft_tray_overview");
      assert.ok(def);
      assert.ok(def.maxFiles >= 4, "graft_tray_overview should allow multiple files");
      assert.strictEqual(def.visibleInUi, false, "Should be Stage 2 (hidden by default)");
      assert.strictEqual(def.phase, "intraoperative");
    });

    it("should have correct configuration for graft tray closeup", () => {
      const def = PATIENT_UPLOAD_CATEGORY_DEFS.find((d) => d.key === "graft_tray_closeup");
      assert.ok(def);
      assert.ok(def.maxFiles >= 8, "graft_tray_closeup should allow many files");
      assert.strictEqual(def.visibleInUi, false);
      assert.strictEqual(def.phase, "intraoperative");
    });

    it("should map to graft_handling evidence group", () => {
      const graftTrayKeys = [
        "graft_tray_overview",
        "graft_tray_closeup",
        "graft_sorting",
        "graft_hydration_solution",
        "graft_count_board",
      ];

      // These should all be in the extended upload groups
      const { getPatientExtendedUploadGroupsResolved } = require("../src/lib/patientExtendedUploadUi");
      const groups = getPatientExtendedUploadGroupsResolved();
      const graftHandlingGroup = groups.find((g: any) => g.id === "graft_handling_evidence");

      assert.ok(graftHandlingGroup, "Should have graft_handling_evidence group");

      for (const key of graftTrayKeys) {
        assert.ok(
          graftHandlingGroup.categories.some((c: any) => c.key === key),
          `${key} should be in graft_handling_evidence group`
        );
      }
    });
  });
});

describe("Upload limits enforcement", () => {
  it("MAX_FILES_PER_REQUEST should be 10", () => {
    const { UPLOAD_LIMITS } = require("../src/lib/uploads/safeUpload");
    assert.strictEqual(UPLOAD_LIMITS.MAX_FILES_PER_REQUEST, 10);
  });

  it("MAX_CONCURRENT_UPLOADS should be 3", () => {
    const { UPLOAD_LIMITS } = require("../src/lib/uploads/safeUpload");
    assert.strictEqual(UPLOAD_LIMITS.MAX_CONCURRENT_UPLOADS, 3);
  });
});
