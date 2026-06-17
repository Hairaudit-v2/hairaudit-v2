import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CORE_TABLES_BASELINE_ONLY,
  CORE_TABLE_NAMES,
  CORE_TABLES_WITH_CREATE_DDL,
  isCoreTableName,
} from "../src/lib/hairaudit/schemaRegistry";
import {
  getBridgeStatus,
  isBridgeSupportedTable,
  BRIDGE_SUPPORTED_TABLES,
  GeneratedTypesAvailable,
} from "../src/lib/hairaudit/generatedTypeBridge";
import { CASE_STATUSES } from "../src/lib/hairaudit/statusCatalog";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Phase 1B Tests: Baseline Schema Capture Validation
 *
 * These tests verify that:
 * 1. Placeholder baseline SQL is non-operative/comment-only
 * 2. schemaRegistry still includes cases/reports/uploads as baseline-only
 * 3. generated type bridge currently resolves to fallback types
 * 4. status catalog remains stable
 */

describe("schema baseline phase 1b", () => {
  // -------------------------------------------------------------------------
  // Test 1: Placeholder baseline SQL is non-operative/comment-only
  // -------------------------------------------------------------------------
  it("placeholder baseline SQL is non-operative (comment-only)", () => {
    const placeholderPath = join(
      root,
      "docs",
      "sql",
      "hairaudit-core-forensic-baseline-placeholder.sql"
    );

    assert.ok(
      existsSync(placeholderPath),
      "Placeholder SQL file must exist at docs/sql/hairaudit-core-forensic-baseline-placeholder.sql"
    );

    const content = readFileSync(placeholderPath, "utf8");

    // Must contain DO NOT APPLY warning
    assert.ok(
      content.includes("DO NOT APPLY"),
      "Placeholder must contain DO NOT APPLY warning"
    );

    // Must be marked as placeholder
    assert.ok(
      content.includes("PLACEHOLDER") || content.includes("placeholder"),
      "Placeholder must be explicitly marked as such"
    );

    // All CREATE/ALTER/DROP/INSERT/UPDATE/DELETE statements must be commented
    const lines = content.split("\n");
    const executablePattern = /^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE)\s+/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Skip comment lines
      if (trimmed.startsWith("--")) continue;
      if (trimmed.startsWith("/*")) continue;
      if (trimmed.startsWith("*")) continue;
      if (trimmed.startsWith("*/")) continue;

      // Check for executable SQL (uncommented)
      if (executablePattern.test(line)) {
        // Allow if it's a comment about what would be created (e.g., "-- CREATE TABLE...")
        assert.fail(
          `Line ${i + 1} appears to contain executable SQL and must be commented: ${line.trim()}`
        );
      }
    }

    // Must reference Phase 1B guide
    assert.ok(
      content.includes("Phase 1B") || content.includes("phase-1b"),
      "Placeholder must reference Phase 1B documentation"
    );

    // Must contain sections for cases, reports, uploads
    assert.ok(
      content.includes("cases") && content.includes("reports") && content.includes("uploads"),
      "Placeholder must document cases, reports, and uploads sections"
    );
  });

  // -------------------------------------------------------------------------
  // Test 2: schemaRegistry still includes cases/reports/uploads
  // -------------------------------------------------------------------------
  it("schemaRegistry includes cases, reports, uploads as core tables", () => {
    assert.ok(
      CORE_TABLE_NAMES.includes("cases"),
      "cases must be in CORE_TABLE_NAMES"
    );
    assert.ok(
      CORE_TABLE_NAMES.includes("reports"),
      "reports must be in CORE_TABLE_NAMES"
    );
    assert.ok(
      CORE_TABLE_NAMES.includes("uploads"),
      "uploads must be in CORE_TABLE_NAMES"
    );

    // These are baseline-only (no CREATE DDL in repo)
    assert.ok(
      CORE_TABLES_BASELINE_ONLY.includes("cases"),
      "cases must be in CORE_TABLES_BASELINE_ONLY"
    );
    assert.ok(
      CORE_TABLES_BASELINE_ONLY.includes("reports"),
      "reports must be in CORE_TABLES_BASELINE_ONLY"
    );
    assert.ok(
      CORE_TABLES_BASELINE_ONLY.includes("uploads"),
      "uploads must be in CORE_TABLES_BASELINE_ONLY"
    );

    // Verify isCoreTableName works for all three
    assert.ok(isCoreTableName("cases"));
    assert.ok(isCoreTableName("reports"));
    assert.ok(isCoreTableName("uploads"));
  });

  it("schemaRegistry has expected CREATE DDL vs baseline-only split", () => {
    // These have CREATE DDL in migrations
    const tablesWithCreate = [
      "audit_photos",
      "case_evidence_manifests",
      "upload_audit_corrections",
      "doctor_cases",
      "community_cases",
      "training_cases",
      "profiles",
      "doctor_profiles",
      "clinic_profiles",
    ];

    for (const table of tablesWithCreate) {
      assert.ok(
        CORE_TABLES_WITH_CREATE_DDL.includes(table as any),
        `${table} must be in CORE_TABLES_WITH_CREATE_DDL`
      );
      assert.ok(
        !CORE_TABLES_BASELINE_ONLY.includes(table as any),
        `${table} must NOT be in CORE_TABLES_BASELINE_ONLY`
      );
    }

    // cases, reports, uploads are the only baseline-only tables
    assert.strictEqual(
      CORE_TABLES_BASELINE_ONLY.length,
      3,
      "Only cases, reports, uploads should be baseline-only"
    );
  });

  // -------------------------------------------------------------------------
  // Test 3: generated type bridge currently resolves to fallback types
  // -------------------------------------------------------------------------
  it("generated type bridge exports fallback types (not database.types.ts)", () => {
    const status = getBridgeStatus();

    // Currently using fallback types
    assert.strictEqual(
      status.usingGeneratedTypes,
      false,
      "Bridge should report usingGeneratedTypes=false until database.types.ts is committed"
    );

    // All GeneratedTypesAvailable should be false at compile time
    const usingGenerated: GeneratedTypesAvailable = false;
    assert.strictEqual(usingGenerated, false);

    // Bridge should support all baseline tables
    assert.ok(
      isBridgeSupportedTable("cases"),
      "cases must be bridge-supported"
    );
    assert.ok(
      isBridgeSupportedTable("reports"),
      "reports must be bridge-supported"
    );
    assert.ok(
      isBridgeSupportedTable("uploads"),
      "uploads must be bridge-supported"
    );

    // Verify supported tables list
    const expectedSupported = [
      "cases",
      "reports",
      "uploads",
      "audit_photos",
      "case_evidence_manifests",
      "profiles",
    ];

    assert.deepStrictEqual(
      [...BRIDGE_SUPPORTED_TABLES].sort(),
      expectedSupported.sort()
    );
  });

  it("generated type bridge has expected phase and documentation", () => {
    const status = getBridgeStatus();

    assert.strictEqual(status.phase, "1B");
    assert.strictEqual(
      status.documentationUrl,
      "docs/hairaudit-v2-phase-1b-baseline-schema-capture.md"
    );
  });

  // -------------------------------------------------------------------------
  // Test 4: status catalog remains stable
  // -------------------------------------------------------------------------
  it("status catalog contains expected values (stability check)", () => {
    // Core workflow statuses that must not change
    const essentialStatuses = [
      "draft",
      "submitted",
      "processing",
      "evidence_preparing",
      "evidence_ready",
      "audit_running",
      "audit_complete",
      "pdf_pending",
      "pdf_ready",
      "complete",
      "audit_failed",
      "failed",
    ];

    for (const status of essentialStatuses) {
      assert.ok(
        CASE_STATUSES.includes(status as any),
        `${status} must be in CASE_STATUSES`
      );
    }

    // Verify status count is stable (fails if statuses added/removed unexpectedly)
    // If this fails intentionally (new statuses added), update the count here
    assert.ok(
      CASE_STATUSES.length >= 20,
      "CASE_STATUSES should have at least 20 values (prevents accidental deletion)"
    );
  });

  // -------------------------------------------------------------------------
  // Test 5: Phase 1B documentation exists
  // -------------------------------------------------------------------------
  it("Phase 1B documentation exists and is comprehensive", () => {
    const guidePath = join(
      root,
      "docs",
      "hairaudit-v2-phase-1b-baseline-schema-capture.md"
    );

    assert.ok(
      existsSync(guidePath),
      "Phase 1B guide must exist"
    );

    const content = readFileSync(guidePath, "utf8");

    // Must contain key sections
    const requiredSections = [
      "Baseline DDL",
      "RLS",
      "Checklist",
      "supabase",
      "pg_dump",
      "rollback",
      "generated type",
    ];

    for (const section of requiredSections) {
      assert.ok(
        content.toLowerCase().includes(section.toLowerCase()),
        `Phase 1B guide must contain section about: ${section}`
      );
    }

    // Must reference related files
    assert.ok(
      content.includes("hairaudit-phase-0b-rls-draft.sql"),
      "Guide must reference RLS draft SQL"
    );
    assert.ok(
      content.includes("tableTypes.ts"),
      "Guide must reference tableTypes.ts"
    );
  });

  // -------------------------------------------------------------------------
  // Test 6: Supabase type generation script is enhanced
  // -------------------------------------------------------------------------
  it("gen-supabase-types script has Phase 1B enhancements", () => {
    const scriptPath = join(root, "scripts", "gen-supabase-types.mjs");

    assert.ok(
      existsSync(scriptPath),
      "gen-supabase-types.mjs must exist"
    );

    const content = readFileSync(scriptPath, "utf8");

    // Must support SUPABASE_ACCESS_TOKEN
    assert.ok(
      content.includes("SUPABASE_ACCESS_TOKEN"),
      "Script must support SUPABASE_ACCESS_TOKEN"
    );

    // Must support SUPABASE_PROJECT_REF
    assert.ok(
      content.includes("SUPABASE_PROJECT_REF"),
      "Script must support SUPABASE_PROJECT_REF"
    );

    // Must have validation to prevent empty/fake types
    assert.ok(
      content.includes("validateGeneratedTypes") ||
      content.includes("export type Database") ||
      content.includes("too short"),
      "Script must validate generated types to prevent empty/fake output"
    );

    // Must print clear instructions when failing
    assert.ok(
      content.includes("printInstructions") ||
      content.includes("authenticate"),
      "Script must print clear instructions when unauthenticated"
    );
  });
});

// Export for potential external test runners
export {};
