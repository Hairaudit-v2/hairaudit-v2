/**
 * FI-Compatible Upload Contract — Phase 2A
 *
 * This module defines a future-compatible metadata contract for HairAudit uploads
 * that supports:
 * - All current upload surfaces (forensic_audit, surgery_evidence, etc.)
 * - Future FI OS image intelligence delegation
 * - AI classification, photo protocol validation, and quality assessment
 *
 * IMPORTANT: This is a type-only / pure constants contract.
 * No database schema changes yet. No forced writes.
 * Use these types for new code and gradual migration.
 *
 * See: docs/hairaudit-v2-phase-2a-upload-architecture-map.md
 */

// ============================================================================
// Actor Types — Who is uploading
// ============================================================================

/** The entity performing the upload action */
export const UPLOAD_ACTOR_TYPES = [
  "patient",
  "doctor",
  "clinic",
  "auditor",
  "community",
  "system",
] as const;

export type UploadActorType = (typeof UPLOAD_ACTOR_TYPES)[number];

/** Actor types that represent human medical professionals */
export const MEDICAL_PROFESSIONAL_ACTORS: UploadActorType[] = [
  "doctor",
  "clinic",
  "auditor",
];

/** Actor types that can upload without authentication (with restrictions) */
export const UNAUTHENTICATED_ACTORS: UploadActorType[] = ["community"];

// ============================================================================
// Upload Surfaces — Where the upload occurs
// ============================================================================

/** The application surface/feature where upload originates */
export const UPLOAD_SURFACES = [
  "forensic_audit", // Main patient/doctor/clinic audit
  "surgery_evidence", // Mobile surgery portal
  "doctor_portal", // Doctor v2 isolated
  "community", // Public rating feature
  "training", // Academy/competency
  "bulk_admin", // Admin batch operations
] as const;

export type UploadSurface = (typeof UPLOAD_SURFACES)[number];

/** Surfaces that are part of the main forensic audit pipeline */
export const FORENSIC_PIPELINE_SURFACES: UploadSurface[] = [
  "forensic_audit",
  "surgery_evidence",
];

/** Surfaces that are isolated domains (no forensic pipeline) */
export const ISOLATED_SURFACES: UploadSurface[] = [
  "doctor_portal",
  "community",
  "training",
  "bulk_admin",
];

// ============================================================================
// Source Case Tables — Which case table owns the upload
// ============================================================================

/** The database table that owns the case context for this upload */
export const SOURCE_CASE_TABLES = [
  "cases", // Main forensic audit
  "doctor_cases", // Doctor portal v2
  "training_cases", // Academy
  "community_cases", // Public ratings
] as const;

export type SourceCaseTable = (typeof SOURCE_CASE_TABLES)[number];

/** Mapping from upload surface to default source case table */
export const SURFACE_TO_SOURCE_TABLE: Record<UploadSurface, SourceCaseTable> = {
  forensic_audit: "cases",
  surgery_evidence: "cases",
  doctor_portal: "doctor_cases",
  community: "community_cases",
  training: "training_cases",
  bulk_admin: "cases",
};

// ============================================================================
// Photo Categories — Canonical classification values
// ============================================================================

/** Standard anatomical photo categories for hair transplant audits */
export const CANONICAL_PHOTO_CATEGORIES = [
  "front", // Face-forward view
  "top", // Top/crown view
  "crown", // Back of head
  "left", // Left side
  "right", // Right side
  "donor", // Donor area close-up
  "recipient", // Recipient area close-up
  "hairline", // Hairline detail
  "temporal", // Temporal region
  "vertex", // Vertex/crown detail
  "other", // Uncategorized/ancillary
] as const;

export type CanonicalPhotoCategory = (typeof CANONICAL_PHOTO_CATEGORIES)[number];

/** Categories required for minimum viable forensic audit */
export const REQUIRED_FORENSIC_CATEGORIES: CanonicalPhotoCategory[] = [
  "front",
  "top",
  "crown",
  "left",
  "right",
];

/** Categories that are optional but enhance audit quality */
export const OPTIONAL_FORENSIC_CATEGORIES: CanonicalPhotoCategory[] = [
  "donor",
  "recipient",
  "hairline",
  "temporal",
  "vertex",
];

// ============================================================================
// Surgery Slots — Time-based surgery documentation
// ============================================================================

/** Surgery documentation time slots (for surgery_evidence surface) */
export const SURGERY_SLOTS = [
  "pre-op",
  "intra-op",
  "post-op-immediate",
  "post-op-1mo",
  "post-op-3mo",
  "post-op-6mo",
  "post-op-12mo",
  "post-op-18mo",
  "post-op-24mo",
] as const;

export type SurgerySlot = (typeof SURGERY_SLOTS)[number];

/** Slots that are collected before/during surgery */
export const PRE_AND_INTRA_OP_SLOTS: SurgerySlot[] = [
  "pre-op",
  "intra-op",
  "post-op-immediate",
];

/** Slots that are collected during follow-up */
export const POST_OP_FOLLOWUP_SLOTS: SurgerySlot[] = [
  "post-op-1mo",
  "post-op-3mo",
  "post-op-6mo",
  "post-op-12mo",
  "post-op-18mo",
  "post-op-24mo",
];

// ============================================================================
// AI Classification Status — For FI OS integration
// ============================================================================

/** Status of AI-powered photo classification */
export const AI_CLASSIFICATION_STATUSES = [
  "pending", // Not yet classified
  "processing", // Classification in progress
  "complete", // Successfully classified
  "failed", // Classification error
  "not_required", // Human override or exempt
] as const;

export type AIClassificationStatus = (typeof AI_CLASSIFICATION_STATUSES)[number];

/** Status values that indicate classification is in-progress */
export const IN_PROGRESS_CLASSIFICATION_STATUSES: AIClassificationStatus[] = [
  "pending",
  "processing",
];

/** Status values that indicate classification is terminal */
export const TERMINAL_CLASSIFICATION_STATUSES: AIClassificationStatus[] = [
  "complete",
  "failed",
  "not_required",
];

// ============================================================================
// Photo Quality Status — Validation outcomes
// ============================================================================

/** Quality assessment status for uploaded photos */
export const PHOTO_QUALITY_STATUSES = [
  "unknown", // Not assessed
  "pass", // Meets all requirements
  "warn", // Usable with caveats
  "fail", // Does not meet requirements
] as const;

export type PhotoQualityStatus = (typeof PHOTO_QUALITY_STATUSES)[number];

/** Quality check types performed during validation */
export const QUALITY_CHECK_TYPES = [
  "resolution", // Minimum pixel dimensions
  "focus", // Sharpness/blur detection
  "lighting", // Exposure consistency
  "angle", // Anatomical alignment
  "coverage", // Area of scalp visible
  "consistency", // Matches other photos in set
] as const;

export type QualityCheckType = (typeof QUALITY_CHECK_TYPES)[number];

// ============================================================================
// Photo Protocol Status — Compliance with standards
// ============================================================================

/** Protocol compliance status for medical photography standards */
export const PHOTO_PROTOCOL_STATUSES = [
  "not_assessed",
  "compliant",
  "minor_deviation", // Acceptable variation
  "major_deviation", // Requires correction
  "non_compliant", // Cannot use
] as const;

export type PhotoProtocolStatus = (typeof PHOTO_PROTOCOL_STATUSES)[number];

/** Protocol standards we may validate against */
export const PROTOCOL_STANDARDS = [
  "ishrs_guidelines", // International Society of Hair Restoration Surgery
  "clinic_standard", // Individual clinic protocols
  "fi_os_standard", // Future FI OS standard
] as const;

export type ProtocolStandard = (typeof PROTOCOL_STANDARDS)[number];

// ============================================================================
// Storage Conventions — Path and bucket patterns
// ============================================================================

/** Supported storage bucket names */
export const STORAGE_BUCKETS = [
  "case-files", // Primary bucket
  "academy-assets", // Academy isolated
] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

/** Path convention types */
export const PATH_CONVENTIONS = [
  "forensic_patient", // cases/{caseId}/patient/{category}/
  "forensic_doctor", // cases/{caseId}/doctor/{category}/
  "forensic_clinic", // cases/{caseId}/clinic/{category}/
  "surgery_slot", // cases/{caseId}/surgery/{slot}/
  "audit_canonical", // audit_photos/{caseId}/{submitter}/{category}/
  "bulk_staging", // cases/bulk/{batchId}/
  "academy_isolated", // academy/training-cases/{caseId}/
  "doctor_portal", // doctor_cases/{caseId}/
  "legacy_orphan", // {userId}/{caseId}/ — DEPRECATED
] as const;

export type PathConvention = (typeof PATH_CONVENTIONS)[number];

/** Path conventions that are deprecated and should not be used for new uploads */
export const DEPRECATED_PATH_CONVENTIONS: PathConvention[] = ["legacy_orphan"];

/** Mapping from upload surface to recommended path convention */
export const SURFACE_TO_PATH_CONVENTION: Record<UploadSurface, PathConvention> = {
  forensic_audit: "audit_canonical",
  surgery_evidence: "surgery_slot",
  doctor_portal: "doctor_portal",
  community: "audit_canonical", // Reuse forensic convention
  training: "academy_isolated",
  bulk_admin: "bulk_staging",
};

// ============================================================================
// Content Types — Supported MIME types
// ============================================================================

/** Supported image content types */
export const SUPPORTED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type SupportedImageContentType = (typeof SUPPORTED_IMAGE_CONTENT_TYPES)[number];

/** Content type file extensions */
export const CONTENT_TYPE_EXTENSIONS: Record<SupportedImageContentType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// ============================================================================
// Metadata Version — For contract evolution
// ============================================================================

/** Version of the upload metadata contract */
export const CURRENT_METADATA_VERSION = "2.0" as const;

/** Historical versions for migration reference */
export const HISTORICAL_METADATA_VERSIONS = ["1.0"] as const;

/** All valid metadata versions */
export const METADATA_VERSIONS = [
  ...HISTORICAL_METADATA_VERSIONS,
  CURRENT_METADATA_VERSION,
] as const;

export type MetadataVersion = (typeof METADATA_VERSIONS)[number];

// ============================================================================
// Core Upload Contract Interface
// ============================================================================

/**
 * FI-compatible upload metadata contract.
 *
 * This interface can be used for:
 * - Type-safe metadata construction
 * - API request/response validation
 * - Future database schema migration
 * - FI OS event payload preparation
 *
 * NOTE: Not all fields are currently populated. This is a forward-looking
 * contract that includes fields for planned features.
 */
export interface UploadMetadataContract {
  // Core Identification
  /** Contract version for schema evolution */
  metadata_version: MetadataVersion;

  // Actor and Context
  /** Who performed the upload */
  upload_actor_type: UploadActorType;
  /** Which application surface */
  upload_surface: UploadSurface;
  /** Which case table owns this upload */
  source_case_table: SourceCaseTable;
  /** Reference to the case row (UUID) */
  case_id: string;
  /** Reference to the user who uploaded (UUID or null for community) */
  uploaded_by_user_id: string | null;

  // Classification
  /** Canonical anatomical category */
  canonical_photo_category: CanonicalPhotoCategory;
  /** Surgery time slot (if surgery_evidence surface) */
  surgery_slot?: SurgerySlot;
  /** Free-form tags for search/filter */
  tags?: string[];

  // File Information
  /** Original filename before any processing */
  original_filename: string;
  /** Detected MIME type (not client-provided) */
  content_type: SupportedImageContentType;
  /** File size in bytes */
  file_size_bytes: number;
  /** Image width in pixels (if available) */
  width_pixels?: number;
  /** Image height in pixels (if available) */
  height_pixels?: number;
  /** SHA-256 hash of file content (if available) */
  content_hash_sha256?: string;

  // Processing Pipeline
  /** Whether client-side compression was applied */
  client_compressed: boolean;
  /** Compression ratio if compressed (0.0-1.0) */
  compression_ratio?: number;
  /** Quality setting for lossy compression (1-100) */
  compression_quality?: number;

  // AI Classification (FI OS future)
  /** Status of AI-powered classification */
  ai_classification_status: AIClassificationStatus;
  /** AI-detected category (may differ from canonical) */
  ai_detected_category?: CanonicalPhotoCategory;
  /** Confidence score 0.0-1.0 */
  ai_classification_confidence?: number;
  /** Model version that performed classification */
  ai_classification_model?: string;
  /** Timestamp of classification */
  ai_classified_at?: string;

  // Quality Assessment
  /** Overall quality status */
  photo_quality_status: PhotoQualityStatus;
  /** Individual quality check results */
  quality_checks?: Record<QualityCheckType, PhotoQualityStatus>;

  // Protocol Compliance
  /** Protocol compliance status */
  photo_protocol_status: PhotoProtocolStatus;
  /** Which standard was assessed against */
  protocol_standard?: ProtocolStandard;
  /** Human-readable deviation notes */
  protocol_deviation_notes?: string;

  // Storage
  /** Storage bucket name */
  storage_bucket: StorageBucket;
  /** Full storage path within bucket */
  storage_path: string;
  /** Path convention used */
  path_convention: PathConvention;

  // Timestamps
  /** When upload was initiated (ISO 8601) */
  uploaded_at: string;
  /** When processing completed (ISO 8601) */
  processed_at?: string;

  // FI OS Integration (future)
  /** FI OS image ID if synced to FI */
  fi_os_image_id?: string;
  /** FI OS sync status */
  fi_os_sync_status?: "pending" | "synced" | "failed";
}

// ============================================================================
// Minimal Upload Contract (for initial inserts)
// ============================================================================

/**
 * Minimal required fields for creating an upload record.
 * Used for initial database inserts before full processing.
 */
export interface MinimalUploadMetadata {
  metadata_version: MetadataVersion;
  upload_actor_type: UploadActorType;
  upload_surface: UploadSurface;
  source_case_table: SourceCaseTable;
  case_id: string;
  uploaded_by_user_id: string | null;
  canonical_photo_category: CanonicalPhotoCategory;
  original_filename: string;
  content_type: SupportedImageContentType;
  file_size_bytes: number;
  client_compressed: boolean;
  storage_bucket: StorageBucket;
  storage_path: string;
  path_convention: PathConvention;
  uploaded_at: string;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a string is a valid upload actor type.
 */
export function isValidUploadActorType(value: string): value is UploadActorType {
  return (UPLOAD_ACTOR_TYPES as readonly string[]).includes(value);
}

/**
 * Check if a string is a valid upload surface.
 */
export function isValidUploadSurface(value: string): value is UploadSurface {
  return (UPLOAD_SURFACES as readonly string[]).includes(value);
}

/**
 * Check if a string is a valid canonical photo category.
 */
export function isValidCanonicalPhotoCategory(value: string): value is CanonicalPhotoCategory {
  return (CANONICAL_PHOTO_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Check if a string is a valid supported content type.
 */
export function isValidContentType(value: string): value is SupportedImageContentType {
  return (SUPPORTED_IMAGE_CONTENT_TYPES as readonly string[]).includes(value);
}

/**
 * Get the source case table for a given upload surface.
 */
export function getSourceTableForSurface(surface: UploadSurface): SourceCaseTable {
  return SURFACE_TO_SOURCE_TABLE[surface];
}

/**
 * Get the recommended path convention for a given upload surface.
 */
export function getPathConventionForSurface(surface: UploadSurface): PathConvention {
  return SURFACE_TO_PATH_CONVENTION[surface];
}

/**
 * Check if a path convention is deprecated.
 */
export function isDeprecatedPathConvention(convention: PathConvention): boolean {
  return (DEPRECATED_PATH_CONVENTIONS as readonly string[]).includes(convention);
}

/**
 * Create a minimal upload metadata object with defaults.
 */
export function createMinimalUploadMetadata(
  params: Omit<MinimalUploadMetadata, "metadata_version">
): MinimalUploadMetadata {
  return {
    metadata_version: CURRENT_METADATA_VERSION,
    ...params,
  };
}

// ============================================================================
// Upload Type Taxonomy (Legacy Compatibility)
// ============================================================================

/**
 * Legacy type prefixes stored in `uploads.type` column.
 * These map to the new contract fields.
 *
 * @deprecated Use `upload_surface` + `upload_actor_type` + `canonical_photo_category` instead.
 */
export const LEGACY_UPLOAD_TYPE_PREFIXES = [
  "patient_photo",
  "doctor_photo",
  "clinic_photo",
  "surgery_photo",
  "audit_photo",
  "admin_photo",
  "bulk_photo",
] as const;

export type LegacyUploadTypePrefix = (typeof LEGACY_UPLOAD_TYPE_PREFIXES)[number];

/**
 * Parse a legacy `uploads.type` value into contract fields.
 * Example: "patient_photo:front" → { actor: "patient", category: "front" }
 */
export function parseLegacyUploadType(
  type: string
): {
  prefix: LegacyUploadTypePrefix | null;
  category: string | null;
  actor: UploadActorType | null;
} {
  const parts = type.split(":");
  const prefix = parts[0] as LegacyUploadTypePrefix;
  const category = parts[1] || null;

  const prefixToActor: Record<LegacyUploadTypePrefix, UploadActorType> = {
    patient_photo: "patient",
    doctor_photo: "doctor",
    clinic_photo: "clinic",
    surgery_photo: "patient", // Surgery is patient context
    audit_photo: "auditor",
    admin_photo: "system",
    bulk_photo: "system",
  };

  if (!(LEGACY_UPLOAD_TYPE_PREFIXES as readonly string[]).includes(prefix)) {
    return { prefix: null, category, actor: null };
  }

  return {
    prefix,
    category,
    actor: prefixToActor[prefix],
  };
}

/**
 * Generate a legacy `uploads.type` value from contract fields.
 * For backward compatibility during migration.
 */
export function generateLegacyUploadType(
  actor: UploadActorType,
  surface: UploadSurface,
  category: CanonicalPhotoCategory
): string {
  if (surface === "surgery_evidence") {
    return `surgery_photo:${category}`;
  }
  if (actor === "auditor") {
    return `audit_photo:${category}`;
  }
  if (actor === "system") {
    return `admin_photo:${category}`;
  }
  return `${actor}_photo:${category}`;
}
