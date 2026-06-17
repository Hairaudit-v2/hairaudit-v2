/**
 * Upload Route Registry — Phase 2A
 *
 * Central inventory of all known upload routes, components, and their metadata.
 * Supports future migration planning and consistency validation.
 *
 * Each route entry includes:
 * - id: unique identifier
 * - route: API endpoint path
 * - component: frontend component using this route
 * - surface: upload surface type (forensic_audit, surgery_evidence, etc.)
 * - actor_type: who can perform the upload
 * - storage_convention: path pattern used
 * - status: keep/refactor/delete/legacy
 * - known_risks: documented security/operational concerns
 *
 * See: docs/hairaudit-v2-phase-2a-upload-architecture-map.md
 */

import type {
  UploadActorType,
  UploadSurface,
  PathConvention,
  SourceCaseTable,
} from "./uploadContract";

// ============================================================================
// Route Status Types
// ============================================================================

/** Migration status for upload routes/components */
export const UPLOAD_ROUTE_STATUSES = [
  "keep", // Active and correct — no changes needed
  "refactor", // Active but needs consolidation/improvement
  "delete", // Should be removed
  "legacy", // Superseded but still present
] as const;

export type UploadRouteStatus = (typeof UPLOAD_ROUTE_STATUSES)[number];

/** Risk severity levels */
export const RISK_LEVELS = ["none", "low", "medium", "high", "critical"] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

// ============================================================================
// Route Entry Interface
// ============================================================================

/**
 * Metadata about an upload route and its associated frontend component.
 */
export interface UploadRouteEntry {
  /** Unique identifier for this route entry */
  readonly id: string;

  /** HTTP API route path */
  readonly route: string;

  /** HTTP method */
  readonly method: "POST" | "GET" | "DELETE" | "PATCH";

  /** Primary frontend component using this route */
  readonly component: string;

  /** Component file path (relative to src/) */
  readonly component_path: string;

  /** Upload surface classification */
  readonly surface: UploadSurface;

  /** Allowed actor types for this route */
  readonly actor_types: readonly UploadActorType[];

  /** Storage path convention used */
  readonly storage_convention: PathConvention;

  /** Database table receiving the upload metadata */
  readonly database_table: SourceCaseTable | "uploads" | "training_case_uploads" | "doctor_case_uploads" | "hair_audit_case_images";

  /** Migration status */
  readonly status: UploadRouteStatus;

  /** Known risks */
  readonly known_risks: ReadonlyArray<{
    level: RiskLevel;
    description: string;
    mitigation?: string;
  }>;

  /** Notes for future migration */
  readonly notes?: string;

  /** Related route IDs */
  readonly related_routes?: readonly string[];
}

// ============================================================================
// Route Registry
// ============================================================================

/**
 * All known upload routes in the HairAudit application.
 *
 * This registry is used for:
 * - Architecture documentation
 * - Consistency validation
 * - Migration planning
 * - Security audit verification
 */
export const UPLOAD_ROUTE_REGISTRY: readonly UploadRouteEntry[] = [
  // ============================================================================
  // Patient Forensic Audit Uploads
  // ============================================================================
  {
    id: "patient-photos-upload",
    route: "/api/uploads/patient-photos",
    method: "POST",
    component: "UnifiedPatientUploader",
    component_path: "components/patient/UnifiedPatientUploader.tsx",
    surface: "forensic_audit",
    actor_types: ["patient"],
    storage_convention: "forensic_patient",
    database_table: "uploads",
    status: "keep",
    known_risks: [
      {
        level: "low",
        description: "No client-side compression (Vercel 4.5MB limit)",
        mitigation: "Consider adding compression or raise limit",
      },
    ],
    notes: "Primary patient upload — keep and consolidate with audit-photos",
    related_routes: ["audit-photos-upload"],
  },

  // ============================================================================
  // Auditor/Generic Audit Uploads
  // ============================================================================
  {
    id: "audit-photos-upload",
    route: "/api/uploads/audit-photos",
    method: "POST",
    component: "PhotoUploader",
    component_path: "components/photos/PhotoUploader.tsx",
    surface: "forensic_audit",
    actor_types: ["patient", "doctor", "clinic", "auditor"],
    storage_convention: "audit_canonical",
    database_table: "uploads",
    status: "keep",
    known_risks: [
      {
        level: "low",
        description: "Dual-write to uploads + audit_photos tables",
        mitigation: "Ensure transaction consistency",
      },
    ],
    notes: "Generic photo upload — dual-writes to audit_photos for evidence canonicalization",
    related_routes: ["patient-photos-upload", "clinic-photos-upload", "doctor-photos-upload"],
  },

  // ============================================================================
  // Doctor Uploads (Deprecated in favor of audit-photos)
  // ============================================================================
  {
    id: "doctor-photos-upload",
    route: "/api/uploads/doctor-photos",
    method: "POST",
    component: "PhotoUploader",
    component_path: "components/photos/PhotoUploader.tsx",
    surface: "forensic_audit",
    actor_types: ["doctor"],
    storage_convention: "forensic_doctor",
    database_table: "uploads",
    status: "legacy",
    known_risks: [
      {
        level: "low",
        description: "Deprecated route — returns 410 Gone in production (Phase 2C)",
        mitigation: "Use audit-photos with submitterType=doctor",
      },
    ],
    notes: "DEPRECATED (2C): 410 in production. Dev/test only — use audit-photos with submitterType=doctor",
    related_routes: ["audit-photos-upload"],
  },

  // ============================================================================
  // Clinic Uploads
  // ============================================================================
  {
    id: "clinic-photos-upload",
    route: "/api/uploads/clinic-photos",
    method: "POST",
    component: "PhotoUploader",
    component_path: "components/photos/PhotoUploader.tsx",
    surface: "forensic_audit",
    actor_types: ["clinic"],
    storage_convention: "forensic_clinic",
    database_table: "uploads",
    status: "keep",
    known_risks: [
      {
        level: "none",
        description: "Bucket + path gate via uploadStorage (Phase 2D)",
      },
    ],
    notes: "Clinic contribution uploads — bucket/path gates via uploadStorage (Phase 2D); consolidate with audit-photos in 2E",
    related_routes: ["audit-photos-upload"],
  },

  // ============================================================================
  // Surgery Evidence Uploads
  // ============================================================================
  {
    id: "surgery-upload-photos",
    route: "/api/surgery-upload/photos",
    method: "POST",
    component: "SurgeryUploadFlowClient",
    component_path: "app/dashboard/surgery-upload/[caseId]/",
    surface: "surgery_evidence",
    actor_types: ["patient", "doctor", "clinic"],
    storage_convention: "surgery_slot",
    database_table: "uploads",
    status: "keep",
    known_risks: [
      {
        level: "low",
        description: "Different storage layout (surgery/{slot}/) vs forensic",
        mitigation: "Consider aligning with forensic convention",
      },
      {
        level: "low",
        description: "Client compression only in this flow",
        mitigation: "Consider standardizing compression across all flows",
      },
    ],
    notes: "Mobile-optimized surgery portal — bucket/path gates via uploadStorage (Phase 2C); path alignment deferred to 2D",
  },

  // ============================================================================
  // Academy Uploads
  // ============================================================================
  {
    id: "academy-uploads",
    route: "/api/academy/uploads",
    method: "POST",
    component: "AcademyCasePhotosPanel",
    component_path: "components/academy/AcademyCasePhotosPanel.tsx",
    surface: "training",
    actor_types: ["doctor"], // training_doctor
    storage_convention: "academy_isolated",
    database_table: "training_case_uploads",
    status: "keep",
    known_risks: [
      {
        level: "low",
        description: "Uses separate table (training_case_uploads) from main uploads",
      },
    ],
    notes: "Isolated academy domain — separate table is intentional",
  },

  // ============================================================================
  // Bulk Admin Uploads
  // ============================================================================
  {
    id: "bulk-upload-images",
    route: "/api/admin/hair-audit/bulk-upload/images",
    method: "POST",
    component: "BulkUploadWizardClient",
    component_path: "components/admin/hair-audit/bulk-upload/",
    surface: "bulk_admin",
    actor_types: ["system"],
    storage_convention: "bulk_staging",
    database_table: "hair_audit_case_images",
    status: "keep",
    known_risks: [
      {
        level: "low",
        description: "Staging table pattern — syncs to uploads later",
      },
    ],
    notes: "Admin batch operations — staging table before main pipeline",
  },

  // ============================================================================
  // Supporting Routes (Signed URLs, List, Delete)
  // ============================================================================
  {
    id: "uploads-signed-url",
    route: "/api/uploads/signed-url",
    method: "GET",
    component: "UploadedThumb",
    component_path: "components/uploads/UploadedThumb.tsx",
    surface: "forensic_audit",
    actor_types: ["patient", "doctor", "clinic", "auditor"],
    storage_convention: "audit_canonical",
    database_table: "uploads",
    status: "keep",
    known_risks: [
      {
        level: "none",
        description: "Auth + case access + path gate + env bucket via uploadStorage (Phase 2C)",
      },
    ],
    notes: "Secure signed URL generation for preview",
  },
  {
    id: "uploads-list",
    route: "/api/uploads/list",
    method: "GET",
    component: "UnifiedPatientUploader",
    component_path: "components/patient/UnifiedPatientUploader.tsx",
    surface: "forensic_audit",
    actor_types: ["patient", "doctor", "clinic", "auditor"],
    storage_convention: "audit_canonical",
    database_table: "uploads",
    status: "keep",
    known_risks: [
      {
        level: "none",
        description: "Auth + case access + namespace filter + path gate before sign (Phase 2C)",
      },
    ],
    notes: "Lists uploads with signed URLs for gallery display",
  },
  {
    id: "uploads-delete",
    route: "/api/uploads/delete",
    method: "DELETE",
    component: "UnifiedPatientUploader",
    component_path: "components/patient/UnifiedPatientUploader.tsx",
    surface: "forensic_audit",
    actor_types: ["patient", "doctor", "clinic", "auditor"],
    storage_convention: "audit_canonical",
    database_table: "uploads",
    status: "keep",
    known_risks: [
      {
        level: "none",
        description: "Auth + case access + case-scoped path gate + env bucket resolution (Phase 2B)",
      },
    ],
    notes: "Hardened in Phase 2B via uploadStorage.ts",
  },
  {
    id: "auditor-patient-uploads",
    route: "/api/auditor/patient-uploads",
    method: "GET",
    component: "PhotoUploader",
    component_path: "components/photos/PhotoUploader.tsx",
    surface: "forensic_audit",
    actor_types: ["auditor"],
    storage_convention: "audit_canonical",
    database_table: "uploads",
    status: "keep",
    known_risks: [
      {
        level: "none",
        description: "Auditor-only read endpoint with case access validation",
      },
    ],
    notes: "Auditor gallery view for review",
  },
  {
    id: "academy-signed-url",
    route: "/api/academy/signed-url",
    method: "GET",
    component: "AcademyCasePhotosPanel",
    component_path: "components/academy/AcademyCasePhotosPanel.tsx",
    surface: "training",
    actor_types: ["doctor"],
    storage_convention: "academy_isolated",
    database_table: "training_case_uploads",
    status: "keep",
    known_risks: [
      {
        level: "none",
        description: "Isolated domain with academy membership validation",
      },
    ],
    notes: "Academy-specific signed URL generation",
  },
  {
    id: "bulk-signed-url",
    route: "/api/admin/hair-audit/bulk-upload/signed-url",
    method: "GET",
    component: "BulkUploadWizardClient",
    component_path: "components/admin/hair-audit/bulk-upload/",
    surface: "bulk_admin",
    actor_types: ["system"],
    storage_convention: "bulk_staging",
    database_table: "hair_audit_case_images",
    status: "keep",
    known_risks: [
      {
        level: "low",
        description: "Admin-only endpoint with auditor role check",
      },
    ],
    notes: "Bulk admin signed URL generation",
  },

] as const;

// ============================================================================
// Registry Queries
// ============================================================================

/** Get all route entries */
export function getAllUploadRoutes(): readonly UploadRouteEntry[] {
  return UPLOAD_ROUTE_REGISTRY;
}

/** Get routes by status */
export function getUploadRoutesByStatus(
  status: UploadRouteStatus
): readonly UploadRouteEntry[] {
  return UPLOAD_ROUTE_REGISTRY.filter((r) => r.status === status);
}

/** Get routes by surface */
export function getUploadRoutesBySurface(
  surface: UploadSurface
): readonly UploadRouteEntry[] {
  return UPLOAD_ROUTE_REGISTRY.filter((r) => r.surface === surface);
}

/** Get routes by actor type */
export function getUploadRoutesByActor(
  actor: UploadActorType
): readonly UploadRouteEntry[] {
  return UPLOAD_ROUTE_REGISTRY.filter((r) => r.actor_types.includes(actor));
}

/** Get a route by its ID */
export function getUploadRouteById(id: string): UploadRouteEntry | undefined {
  return UPLOAD_ROUTE_REGISTRY.find((r) => r.id === id);
}

/** Check if a route ID exists */
export function hasUploadRouteId(id: string): boolean {
  return UPLOAD_ROUTE_REGISTRY.some((r) => r.id === id);
}

/** Get all unique route IDs */
export function getAllUploadRouteIds(): readonly string[] {
  return UPLOAD_ROUTE_REGISTRY.map((r) => r.id);
}

/** Get all unique HTTP routes */
export function getAllHttpRoutes(): readonly string[] {
  return [...new Set(UPLOAD_ROUTE_REGISTRY.map((r) => r.route))];
}

/** Get routes with risks at or above a given level */
export function getRoutesWithRiskLevel(
  minLevel: RiskLevel
): readonly UploadRouteEntry[] {
  const levelPriority: Record<RiskLevel, number> = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  return UPLOAD_ROUTE_REGISTRY.filter((r) =>
    r.known_risks.some((risk) => levelPriority[risk.level] >= levelPriority[minLevel])
  );
}

/** Get routes that need deletion */
export function getRoutesMarkedForDeletion(): readonly UploadRouteEntry[] {
  return getUploadRoutesByStatus("delete");
}

/** Get routes that need refactoring */
export function getRoutesMarkedForRefactor(): readonly UploadRouteEntry[] {
  return getUploadRoutesByStatus("refactor");
}

/** Get critical risk routes */
export function getCriticalRiskRoutes(): readonly UploadRouteEntry[] {
  return getRoutesWithRiskLevel("critical");
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that all route IDs are unique.
 * Returns duplicates if found.
 */
export function validateUniqueRouteIds(): { valid: boolean; duplicates: string[] } {
  const ids = UPLOAD_ROUTE_REGISTRY.map((r) => r.id);
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.push(id);
    } else {
      seen.add(id);
    }
  }

  return { valid: duplicates.length === 0, duplicates };
}

/**
 * Validate that all routes have required fields populated.
 */
export function validateRouteCompleteness(): {
  valid: boolean;
  incomplete: Array<{ id: string; missing: string[] }>;
} {
  const required: Array<keyof UploadRouteEntry> = [
    "id",
    "route",
    "method",
    "component",
    "component_path",
    "surface",
    "actor_types",
    "storage_convention",
    "database_table",
    "status",
    "known_risks",
  ];

  const incomplete: Array<{ id: string; missing: string[] }> = [];

  for (const route of UPLOAD_ROUTE_REGISTRY) {
    const missing = required.filter(
      (field) =>
        route[field] === undefined ||
        (Array.isArray(route[field]) && route[field].length === 0)
    );

    if (missing.length > 0) {
      incomplete.push({ id: route.id, missing: missing as string[] });
    }
  }

  return { valid: incomplete.length === 0, incomplete };
}

/**
 * Check for routes with the same HTTP route+method (potential conflicts).
 */
export function findRouteConflicts(): {
  hasConflicts: boolean;
  conflicts: Record<string, string[]>;
} {
  const routeMethods = UPLOAD_ROUTE_REGISTRY.map((r) => `${r.method}:${r.route}`);
  const counts: Record<string, string[]> = {};

  for (let i = 0; i < routeMethods.length; i++) {
    const key = routeMethods[i];
    if (!counts[key]) {
      counts[key] = [];
    }
    counts[key].push(UPLOAD_ROUTE_REGISTRY[i].id);
  }

  const conflicts: Record<string, string[]> = {};
  for (const [key, ids] of Object.entries(counts)) {
    if (ids.length > 1) {
      conflicts[key] = ids;
    }
  }

  return { hasConflicts: Object.keys(conflicts).length > 0, conflicts };
}

// ============================================================================
// Registry Summary
// ============================================================================

/**
 * Get a summary of the upload route registry.
 */
export function getRegistrySummary(): {
  totalRoutes: number;
  byStatus: Record<UploadRouteStatus, number>;
  bySurface: Record<UploadSurface, number>;
  criticalRiskCount: number;
  markedForDeletion: string[];
  markedForRefactor: string[];
} {
  const byStatus: Record<UploadRouteStatus, number> = {
    keep: 0,
    refactor: 0,
    delete: 0,
    legacy: 0,
  };

  const bySurface: Record<UploadSurface, number> = {
    forensic_audit: 0,
    surgery_evidence: 0,
    doctor_portal: 0,
    community: 0,
    training: 0,
    bulk_admin: 0,
  };

  for (const route of UPLOAD_ROUTE_REGISTRY) {
    byStatus[route.status]++;
    bySurface[route.surface]++;
  }

  return {
    totalRoutes: UPLOAD_ROUTE_REGISTRY.length,
    byStatus,
    bySurface,
    criticalRiskCount: getCriticalRiskRoutes().length,
    markedForDeletion: getRoutesMarkedForDeletion().map((r) => r.id),
    markedForRefactor: getRoutesMarkedForRefactor().map((r) => r.id),
  };
}
