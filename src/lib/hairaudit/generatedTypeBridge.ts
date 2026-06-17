/**
 * Generated Type Bridge — Phase 1B
 *
 * This module provides an adapter layer between the fallback types in tableTypes.ts
 * and the generated Supabase types in database.types.ts.
 *
 * Purpose:
 * - Detect whether generated Database types are available
 * - Export aliases that currently fall back to tableTypes.ts
 * - Provide a migration path to switch to generated types
 *
 * Migration Path (when database.types.ts is generated):
 * 1. Update the Generated* types below to import from database.types.ts
 * 2. Keep fallback exports for gradual migration
 * 3. Once all consumers updated, remove this bridge and use Database types directly
 *
 * See: docs/hairaudit-v2-phase-1b-baseline-schema-capture.md
 */

// ---------------------------------------------------------------------------
// Fallback imports (from Phase 1A tableTypes.ts)
// These are the current source of truth until generated types are committed
// ---------------------------------------------------------------------------
import type {
  CaseRow as FallbackCaseRow,
  ReportRow as FallbackReportRow,
  UploadRow as FallbackUploadRow,
  AuditPhotoRow as FallbackAuditPhotoRow,
  CaseEvidenceManifestRow as FallbackCaseEvidenceManifestRow,
  ProfileRow as FallbackProfileRow,
} from "./tableTypes";

// ---------------------------------------------------------------------------
// Generated type detection
// ---------------------------------------------------------------------------

/**
 * Detect if generated Database types are available.
 * This is a compile-time check that becomes true when database.types.ts exists.
 */
export type GeneratedTypesAvailable = false;

// ---------------------------------------------------------------------------
// Core table row types (fallback aliases)
// These are the public API of this bridge module
// ---------------------------------------------------------------------------

/** Case row type — fallback to tableTypes.ts until generated types committed */
export type GeneratedCaseRow = FallbackCaseRow;

/** Report row type — fallback to tableTypes.ts until generated types committed */
export type GeneratedReportRow = FallbackReportRow;

/** Upload row type — fallback to tableTypes.ts until generated types committed */
export type GeneratedUploadRow = FallbackUploadRow;

/** Audit photo row type — fallback to tableTypes.ts */
export type GeneratedAuditPhotoRow = FallbackAuditPhotoRow;

/** Evidence manifest row type — fallback to tableTypes.ts */
export type GeneratedCaseEvidenceManifestRow = FallbackCaseEvidenceManifestRow;

/** Profile row type — fallback to tableTypes.ts */
export type GeneratedProfileRow = FallbackProfileRow;

// ---------------------------------------------------------------------------
// Migration helpers (for when database.types.ts is available)
// ---------------------------------------------------------------------------

/**
 * TODO: When database.types.ts is generated, replace the above with:
 *
 * import type { Database } from '@/lib/supabase/database.types';
 *
 * export type GeneratedCaseRow = Database['public']['Tables']['cases']['Row'];
 * export type GeneratedReportRow = Database['public']['Tables']['reports']['Row'];
 * export type GeneratedUploadRow = Database['public']['Tables']['uploads']['Row'];
 * export type GeneratedAuditPhotoRow = Database['public']['Tables']['audit_photos']['Row'];
 * export type GeneratedCaseEvidenceManifestRow = Database['public']['Tables']['case_evidence_manifests']['Row'];
 * export type GeneratedProfileRow = Database['public']['Tables']['profiles']['Row'];
 *
 * export type GeneratedTypesAvailable = true;
 */

/**
 * Type assertion helper for migrating components incrementally.
 *
 * Usage:
 * ```typescript
 * import { GeneratedCaseRow, assertGeneratedType } from './generatedTypeBridge';
 *
 * // Old code (fallback type)
 * const case: GeneratedCaseRow = await fetchCase();
 *
 * // New code (once database.types.ts generated)
 * import type { Database } from '@/lib/supabase/database.types';
 * type DBCase = Database['public']['Tables']['cases']['Row'];
 * const case: DBCase = assertGeneratedType<DBCase>(await fetchCase());
 * ```
 */
export function assertGeneratedType<T>(_value: unknown): T {
  // Runtime no-op; compile-time type assertion only
  return _value as T;
}

// ---------------------------------------------------------------------------
// Table name constants for safe dynamic access
// ---------------------------------------------------------------------------

/** Core table names that have fallback types available */
export const BRIDGE_SUPPORTED_TABLES = [
  "cases",
  "reports",
  "uploads",
  "audit_photos",
  "case_evidence_manifests",
  "profiles",
] as const;

export type BridgeSupportedTable = (typeof BRIDGE_SUPPORTED_TABLES)[number];

/**
 * Check if a table name is supported by the bridge.
 * Use this for safe dynamic table access during migration.
 */
export function isBridgeSupportedTable(
  tableName: string
): tableName is BridgeSupportedTable {
  return (BRIDGE_SUPPORTED_TABLES as readonly string[]).includes(tableName);
}

// ---------------------------------------------------------------------------
// Bridge status for diagnostic purposes
// ---------------------------------------------------------------------------

export interface BridgeStatus {
  /** Whether generated types from database.types.ts are being used */
  usingGeneratedTypes: GeneratedTypesAvailable;

  /** Tables supported by this bridge */
  supportedTables: readonly BridgeSupportedTable[];

  /** Phase marker */
  phase: "1B";

  /** Documentation reference */
  documentationUrl: "docs/hairaudit-v2-phase-1b-baseline-schema-capture.md";
}

/** Current bridge status */
export function getBridgeStatus(): BridgeStatus {
  return {
    usingGeneratedTypes: false,
    supportedTables: BRIDGE_SUPPORTED_TABLES,
    phase: "1B",
    documentationUrl: "docs/hairaudit-v2-phase-1b-baseline-schema-capture.md",
  };
}
