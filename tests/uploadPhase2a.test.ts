import { describe, it } from "node:test";
import assert from "node:assert";
import {
  UPLOAD_ACTOR_TYPES,
  UPLOAD_SURFACES,
  SOURCE_CASE_TABLES,
  CANONICAL_PHOTO_CATEGORIES,
  SURGERY_SLOTS,
  AI_CLASSIFICATION_STATUSES,
  PHOTO_QUALITY_STATUSES,
  QUALITY_CHECK_TYPES,
  PHOTO_PROTOCOL_STATUSES,
  PROTOCOL_STANDARDS,
  STORAGE_BUCKETS,
  PATH_CONVENTIONS,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  CURRENT_METADATA_VERSION,
  HISTORICAL_METADATA_VERSIONS,
  LEGACY_UPLOAD_TYPE_PREFIXES,
  isValidUploadActorType,
  isValidUploadSurface,
  isValidCanonicalPhotoCategory,
  isValidContentType,
  getSourceTableForSurface,
  getPathConventionForSurface,
  isDeprecatedPathConvention,
  parseLegacyUploadType,
  generateLegacyUploadType,
} from "../src/lib/hairaudit/uploadContract";
import {
  UPLOAD_ROUTE_REGISTRY,
  UPLOAD_ROUTE_STATUSES,
  RISK_LEVELS,
  getAllUploadRoutes,
  getUploadRoutesByStatus,
  getUploadRoutesBySurface,
  getUploadRoutesByActor,
  getUploadRouteById,
  hasUploadRouteId,
  getAllUploadRouteIds,
  getRoutesWithRiskLevel,
  validateUniqueRouteIds,
  validateRouteCompleteness,
  findRouteConflicts,
  getRegistrySummary,
} from "../src/lib/hairaudit/uploadRouteRegistry";

/**
 * Phase 2A Tests: Upload Architecture and FI-Compatible Contract
 *
 * These tests verify:
 * 1. Upload contract allowed values are stable
 * 2. UploadRouteRegistry includes all known upload APIs
 * 3. Orphan upload-panel.tsx removed in Phase 2B (see uploadPhase2b.test.ts)
 * 4. No duplicate route IDs
 * 5. Every route has actor/surface/status
 */

describe("upload phase 2a", () => {
  // ========================================================================
  // Contract Constants Tests
  // ========================================================================
  describe("upload contract constants", () => {
    it("has stable actor types", () => {
      const expectedActors = [
        "patient",
        "doctor",
        "clinic",
        "auditor",
        "community",
        "system",
      ];
      assert.deepStrictEqual([...UPLOAD_ACTOR_TYPES].sort(), expectedActors.sort());
    });

    it("has stable upload surfaces", () => {
      const expectedSurfaces = [
        "forensic_audit",
        "surgery_evidence",
        "doctor_portal",
        "community",
        "training",
        "bulk_admin",
      ];
      assert.deepStrictEqual([...UPLOAD_SURFACES].sort(), expectedSurfaces.sort());
    });

    it("has stable source case tables", () => {
      const expectedTables = [
        "cases",
        "doctor_cases",
        "training_cases",
        "community_cases",
      ];
      assert.deepStrictEqual([...SOURCE_CASE_TABLES].sort(), expectedTables.sort());
    });

    it("has stable canonical photo categories", () => {
      const expectedCategories = [
        "front",
        "top",
        "crown",
        "left",
        "right",
        "donor",
        "recipient",
        "hairline",
        "temporal",
        "vertex",
        "other",
      ];
      assert.deepStrictEqual(
        [...CANONICAL_PHOTO_CATEGORIES].sort(),
        expectedCategories.sort()
      );
    });

    it("has stable surgery slots", () => {
      assert.ok(SURGERY_SLOTS.includes("pre-op"));
      assert.ok(SURGERY_SLOTS.includes("post-op-12mo"));
      assert.ok(SURGERY_SLOTS.length >= 9);
    });

    it("has stable AI classification statuses", () => {
      const expectedStatuses = [
        "pending",
        "processing",
        "complete",
        "failed",
        "not_required",
      ];
      assert.deepStrictEqual(
        [...AI_CLASSIFICATION_STATUSES].sort(),
        expectedStatuses.sort()
      );
    });

    it("has stable photo quality statuses", () => {
      const expectedStatuses = ["unknown", "pass", "warn", "fail"];
      assert.deepStrictEqual(
        [...PHOTO_QUALITY_STATUSES].sort(),
        expectedStatuses.sort()
      );
    });

    it("has stable quality check types", () => {
      const expectedChecks = [
        "resolution",
        "focus",
        "lighting",
        "angle",
        "coverage",
        "consistency",
      ];
      assert.deepStrictEqual([...QUALITY_CHECK_TYPES].sort(), expectedChecks.sort());
    });

    it("has stable protocol statuses", () => {
      const expectedStatuses = [
        "not_assessed",
        "compliant",
        "minor_deviation",
        "major_deviation",
        "non_compliant",
      ];
      assert.deepStrictEqual(
        [...PHOTO_PROTOCOL_STATUSES].sort(),
        expectedStatuses.sort()
      );
    });

    it("has stable protocol standards", () => {
      assert.ok(PROTOCOL_STANDARDS.includes("ishrs_guidelines"));
      assert.ok(PROTOCOL_STANDARDS.includes("fi_os_standard"));
    });

    it("has stable storage buckets", () => {
      assert.ok(STORAGE_BUCKETS.includes("case-files"));
    });

    it("has stable path conventions", () => {
      const expectedConventions = [
        "forensic_patient",
        "forensic_doctor",
        "forensic_clinic",
        "surgery_slot",
        "audit_canonical",
        "bulk_staging",
        "academy_isolated",
        "doctor_portal",
        "legacy_orphan",
      ];
      assert.deepStrictEqual(
        [...PATH_CONVENTIONS].sort(),
        expectedConventions.sort()
      );
    });

    it("has legacy_orphan as deprecated path convention", () => {
      assert.ok(isDeprecatedPathConvention("legacy_orphan"));
      assert.ok(!isDeprecatedPathConvention("forensic_patient"));
      assert.ok(!isDeprecatedPathConvention("audit_canonical"));
    });

    it("has stable supported content types", () => {
      const expectedTypes = ["image/jpeg", "image/png", "image/webp"];
      assert.deepStrictEqual(
        [...SUPPORTED_IMAGE_CONTENT_TYPES].sort(),
        expectedTypes.sort()
      );
    });

    it("has current metadata version 2.0", () => {
      assert.strictEqual(CURRENT_METADATA_VERSION, "2.0");
    });

    it("has legacy upload type prefixes", () => {
      const expectedPrefixes = [
        "patient_photo",
        "doctor_photo",
        "clinic_photo",
        "surgery_photo",
        "audit_photo",
        "admin_photo",
        "bulk_photo",
      ];
      assert.deepStrictEqual(
        [...LEGACY_UPLOAD_TYPE_PREFIXES].sort(),
        expectedPrefixes.sort()
      );
    });
  });

  // ========================================================================
  // Contract Validation Helper Tests
  // ========================================================================
  describe("upload contract validation helpers", () => {
    it("validates upload actor types", () => {
      assert.ok(isValidUploadActorType("patient"));
      assert.ok(isValidUploadActorType("auditor"));
      assert.ok(!isValidUploadActorType("invalid_actor"));
    });

    it("validates upload surfaces", () => {
      assert.ok(isValidUploadSurface("forensic_audit"));
      assert.ok(isValidUploadSurface("surgery_evidence"));
      assert.ok(!isValidUploadSurface("invalid_surface"));
    });

    it("validates canonical photo categories", () => {
      assert.ok(isValidCanonicalPhotoCategory("front"));
      assert.ok(isValidCanonicalPhotoCategory("donor"));
      assert.ok(!isValidCanonicalPhotoCategory("invalid_category"));
    });

    it("validates content types", () => {
      assert.ok(isValidContentType("image/jpeg"));
      assert.ok(isValidContentType("image/webp"));
      assert.ok(!isValidContentType("image/gif"));
    });

    it("maps surface to source table correctly", () => {
      assert.strictEqual(getSourceTableForSurface("forensic_audit"), "cases");
      assert.strictEqual(getSourceTableForSurface("surgery_evidence"), "cases");
      assert.strictEqual(getSourceTableForSurface("doctor_portal"), "doctor_cases");
      assert.strictEqual(getSourceTableForSurface("training"), "training_cases");
    });

    it("maps surface to path convention correctly", () => {
      assert.strictEqual(
        getPathConventionForSurface("forensic_audit"),
        "audit_canonical"
      );
      assert.strictEqual(
        getPathConventionForSurface("surgery_evidence"),
        "surgery_slot"
      );
      assert.strictEqual(
        getPathConventionForSurface("doctor_portal"),
        "doctor_portal"
      );
    });
  });

  // ========================================================================
  // Legacy Type Parser Tests
  // ========================================================================
  describe("legacy upload type parsing", () => {
    it("parses patient_photo:front correctly", () => {
      const parsed = parseLegacyUploadType("patient_photo:front");
      assert.strictEqual(parsed.prefix, "patient_photo");
      assert.strictEqual(parsed.category, "front");
      assert.strictEqual(parsed.actor, "patient");
    });

    it("parses surgery_photo:pre-op correctly", () => {
      const parsed = parseLegacyUploadType("surgery_photo:pre-op");
      assert.strictEqual(parsed.prefix, "surgery_photo");
      assert.strictEqual(parsed.category, "pre-op");
      assert.strictEqual(parsed.actor, "patient");
    });

    it("parses audit_photo:top correctly", () => {
      const parsed = parseLegacyUploadType("audit_photo:top");
      assert.strictEqual(parsed.prefix, "audit_photo");
      assert.strictEqual(parsed.category, "top");
      assert.strictEqual(parsed.actor, "auditor");
    });

    it("handles invalid prefixes gracefully", () => {
      const parsed = parseLegacyUploadType("invalid:category");
      assert.strictEqual(parsed.prefix, null);
      assert.strictEqual(parsed.actor, null);
      assert.strictEqual(parsed.category, "category");
    });

    it("generates legacy type from actor/surface/category", () => {
      assert.strictEqual(
        generateLegacyUploadType("patient", "forensic_audit", "front"),
        "patient_photo:front"
      );
      assert.strictEqual(
        generateLegacyUploadType("auditor", "forensic_audit", "donor"),
        "audit_photo:donor"
      );
      assert.strictEqual(
        generateLegacyUploadType("patient", "surgery_evidence", "front"),
        "surgery_photo:front"
      );
    });
  });

  // ========================================================================
  // Route Registry Tests
  // ========================================================================
  describe("upload route registry", () => {
    it("includes all known upload APIs", () => {
      const routeIds = getAllUploadRouteIds();

      // Core forensic audit routes
      assert.ok(routeIds.includes("patient-photos-upload"));
      assert.ok(routeIds.includes("audit-photos-upload"));
      assert.ok(routeIds.includes("clinic-photos-upload"));

      // Surgery routes
      assert.ok(routeIds.includes("surgery-upload-photos"));

      // Academy routes
      assert.ok(routeIds.includes("academy-uploads"));

      // Bulk admin routes
      assert.ok(routeIds.includes("bulk-upload-images"));

      // Supporting routes
      assert.ok(routeIds.includes("uploads-signed-url"));
      assert.ok(routeIds.includes("uploads-list"));
      assert.ok(routeIds.includes("uploads-delete"));
      assert.ok(routeIds.includes("auditor-patient-uploads"));
      assert.ok(routeIds.includes("academy-signed-url"));
      assert.ok(routeIds.includes("bulk-signed-url"));
    });

    it("has uploads-delete route in registry", () => {
      const deleteRoute = getUploadRouteById("uploads-delete");
      assert.ok(deleteRoute, "uploads-delete route must exist");
      assert.strictEqual(deleteRoute.route, "/api/uploads/delete");
      assert.strictEqual(deleteRoute.method, "DELETE");
    });

    it("has no duplicate route IDs", () => {
      const validation = validateUniqueRouteIds();
      assert.ok(
        validation.valid,
        `Duplicate route IDs found: ${validation.duplicates.join(", ")}`
      );
      assert.deepStrictEqual(validation.duplicates, []);
    });

    it("has no HTTP route+method conflicts", () => {
      const conflicts = findRouteConflicts();
      assert.ok(
        !conflicts.hasConflicts,
        `Route conflicts found: ${JSON.stringify(conflicts.conflicts)}`
      );
    });

    it("has all routes with required fields populated", () => {
      const validation = validateRouteCompleteness();
      assert.ok(
        validation.valid,
        `Incomplete routes: ${JSON.stringify(validation.incomplete)}`
      );
      assert.deepStrictEqual(validation.incomplete, []);
    });

    it("has every route with valid actor types", () => {
      for (const route of getAllUploadRoutes()) {
        assert.ok(
          route.actor_types.length > 0,
          `Route ${route.id} must have at least one actor type`
        );
        for (const actor of route.actor_types) {
          assert.ok(
            isValidUploadActorType(actor),
            `Route ${route.id} has invalid actor type: ${actor}`
          );
        }
      }
    });

    it("has every route with valid surface", () => {
      for (const route of getAllUploadRoutes()) {
        assert.ok(
          isValidUploadSurface(route.surface),
          `Route ${route.id} has invalid surface: ${route.surface}`
        );
      }
    });

    it("has every route with valid status", () => {
      for (const route of getAllUploadRoutes()) {
        assert.ok(
          UPLOAD_ROUTE_STATUSES.includes(route.status),
          `Route ${route.id} has invalid status: ${route.status}`
        );
      }
    });

    it("has every route with known_risks array", () => {
      for (const route of getAllUploadRoutes()) {
        assert.ok(
          Array.isArray(route.known_risks),
          `Route ${route.id} must have known_risks array`
        );
      }
    });

    it("can retrieve routes by status", () => {
      const keepRoutes = getUploadRoutesByStatus("keep");
      const deleteRoutes = getUploadRoutesByStatus("delete");
      const legacyRoutes = getUploadRoutesByStatus("legacy");

      assert.strictEqual(deleteRoutes.length, 0);

      assert.ok(keepRoutes.some((r) => r.id === "uploads-delete"));

      // doctor-photos-upload is marked legacy
      assert.ok(legacyRoutes.some((r) => r.id === "doctor-photos-upload"));

      // Most routes should be keep
      assert.ok(keepRoutes.length >= 8);
    });

    it("can retrieve routes by surface", () => {
      const forensicRoutes = getUploadRoutesBySurface("forensic_audit");
      const surgeryRoutes = getUploadRoutesBySurface("surgery_evidence");
      const trainingRoutes = getUploadRoutesBySurface("training");

      assert.ok(forensicRoutes.length >= 4);
      assert.strictEqual(surgeryRoutes.length, 1);
      assert.strictEqual(surgeryRoutes[0].id, "surgery-upload-photos");
      assert.strictEqual(trainingRoutes.length, 2);
    });

    it("can retrieve routes by actor", () => {
      const patientRoutes = getUploadRoutesByActor("patient");
      const auditorRoutes = getUploadRoutesByActor("auditor");
      const systemRoutes = getUploadRoutesByActor("system");

      assert.ok(patientRoutes.length >= 3);
      assert.ok(auditorRoutes.length >= 2);
      assert.ok(systemRoutes.length >= 1);
    });

    it("has registry summary with expected counts", () => {
      const summary = getRegistrySummary();

      // Should have at least 10 routes
      assert.ok(summary.totalRoutes >= 10);

      assert.strictEqual(summary.markedForDeletion.length, 0);

      // Surface breakdown should account for all routes
      const surfaceSum =
        summary.bySurface.forensic_audit +
        summary.bySurface.surgery_evidence +
        summary.bySurface.doctor_portal +
        summary.bySurface.community +
        summary.bySurface.training +
        summary.bySurface.bulk_admin;
      assert.strictEqual(surfaceSum, summary.totalRoutes);
    });
  });
});

// Export for potential external test runners
export {};
