/**
 * HairAudit upload event contract — Phase 2E
 *
 * Pure types and builders for internal upload lifecycle events.
 * No network calls; consumed by uploadEventDispatcher for FI-prep hooks.
 *
 * See: docs/hairaudit-v2-phase-2e-upload-events-manifest-parity.md
 */

import {
  CURRENT_METADATA_VERSION,
  isValidCanonicalPhotoCategory,
  isValidUploadActorType,
  isValidUploadSurface,
  parseLegacyUploadType,
  type CanonicalPhotoCategory,
  type MetadataVersion,
  type SourceCaseTable,
  type StorageBucket,
  type UploadActorType,
  type UploadSurface,
} from "./uploadContract";

/** Schema version for upload event payloads (independent of metadata contract version). */
export const HAIRAUDIT_UPLOAD_EVENT_VERSION = "1.0" as const;

export type HairAuditUploadEventVersion = typeof HAIRAUDIT_UPLOAD_EVENT_VERSION;

/** Normalized upload event names for FI / analytics integration. */
export const HAIRAUDIT_UPLOAD_EVENT_NAMES = {
  CREATED: "hairaudit.upload.created",
  DELETED: "hairaudit.upload.deleted",
} as const;

export type HairAuditUploadEventName =
  (typeof HAIRAUDIT_UPLOAD_EVENT_NAMES)[keyof typeof HAIRAUDIT_UPLOAD_EVENT_NAMES];

/** Fields shared by all upload lifecycle events. */
export interface HairAuditUploadEventBase {
  event_name: HairAuditUploadEventName;
  event_version: HairAuditUploadEventVersion;
  case_id: string;
  upload_id: string;
  actor_type: UploadActorType;
  upload_surface: UploadSurface;
  source_case_table: SourceCaseTable;
  storage_bucket: StorageBucket | string;
  storage_path: string;
  canonical_photo_category: CanonicalPhotoCategory | string;
  legacy_upload_type?: string;
  metadata_version: MetadataVersion;
  occurred_at: string;
}

/** Emitted after a successful upload row / image row insert. */
export interface HairAuditUploadCreatedEvent extends HairAuditUploadEventBase {
  event_name: typeof HAIRAUDIT_UPLOAD_EVENT_NAMES.CREATED;
}

/** Emitted after a successful upload row removal and storage delete. */
export interface HairAuditUploadDeletedEvent {
  event_name: typeof HAIRAUDIT_UPLOAD_EVENT_NAMES.DELETED;
  event_version: HairAuditUploadEventVersion;
  case_id: string;
  upload_id: string;
  actor_type?: UploadActorType;
  upload_surface?: UploadSurface;
  source_case_table: SourceCaseTable;
  storage_bucket: StorageBucket | string;
  storage_path: string;
  canonical_photo_category: CanonicalPhotoCategory | string;
  legacy_upload_type?: string;
  metadata_version: MetadataVersion;
  deleted_at: string;
  occurred_at: string;
}

export type HairAuditUploadEvent = HairAuditUploadCreatedEvent | HairAuditUploadDeletedEvent;

export type BuildHairAuditUploadCreatedEventInput = {
  upload_id: string;
  case_id: string;
  actor_type: UploadActorType | string;
  upload_surface: UploadSurface | string;
  source_case_table: SourceCaseTable | string;
  storage_bucket: StorageBucket | string;
  storage_path: string;
  canonical_photo_category?: CanonicalPhotoCategory | string | null;
  legacy_upload_type?: string | null;
  metadata_version?: MetadataVersion;
  occurred_at?: string;
};

export type BuildHairAuditUploadDeletedEventInput = {
  upload_id: string;
  case_id: string;
  actor_type?: UploadActorType | string | null;
  upload_surface?: UploadSurface | string | null;
  source_case_table?: SourceCaseTable | string;
  storage_bucket: StorageBucket | string;
  storage_path: string;
  canonical_photo_category?: CanonicalPhotoCategory | string | null;
  legacy_upload_type?: string | null;
  metadata_version?: MetadataVersion;
  deleted_at?: string;
  occurred_at?: string;
};

const SENSITIVE_PAYLOAD_KEYS = [
  "signed_url",
  "signedUrl",
  "public_url",
  "publicUrl",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "secret",
] as const;

/**
 * Resolve canonical photo category from legacy type and optional metadata.
 * Surgery slots and extended categories fall back to metadata.category or "other".
 */
export function resolveCanonicalCategoryForUploadEvent(args: {
  legacy_upload_type?: string | null;
  metadata_category?: string | null;
  explicit_category?: string | null;
}): CanonicalPhotoCategory | string {
  const explicit = args.explicit_category?.trim();
  if (explicit && isValidCanonicalPhotoCategory(explicit)) {
    return explicit;
  }

  const metaCategory = args.metadata_category?.trim();
  if (metaCategory && isValidCanonicalPhotoCategory(metaCategory)) {
    return metaCategory;
  }

  const legacy = args.legacy_upload_type?.trim();
  if (legacy) {
    const parsed = parseLegacyUploadType(legacy);
    if (parsed.category && isValidCanonicalPhotoCategory(parsed.category)) {
      return parsed.category;
    }
  }

  return "other";
}

/** Infer upload surface from a legacy `uploads.type` value when present. */
export function inferUploadSurfaceFromLegacyType(
  legacyType: string | null | undefined
): UploadSurface | undefined {
  const trimmed = legacyType?.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("surgery_photo:")) return "surgery_evidence";
  if (trimmed.startsWith("bulk_photo:") || trimmed.startsWith("admin_photo:")) {
    return "bulk_admin";
  }

  const parsed = parseLegacyUploadType(trimmed);
  if (parsed.prefix) return "forensic_audit";

  return undefined;
}

/** Infer actor type from legacy `uploads.type` when the prefix is recognized. */
export function inferActorTypeFromLegacyType(
  legacyType: string | null | undefined
): UploadActorType | undefined {
  const trimmed = legacyType?.trim();
  if (!trimmed) return undefined;
  const parsed = parseLegacyUploadType(trimmed);
  return parsed.actor ?? undefined;
}

function normalizeActorType(value: string): UploadActorType {
  const trimmed = value.trim();
  return isValidUploadActorType(trimmed) ? trimmed : "system";
}

function normalizeUploadSurface(value: string): UploadSurface {
  const trimmed = value.trim();
  return isValidUploadSurface(trimmed) ? trimmed : "forensic_audit";
}

function normalizeSourceCaseTable(value: string): SourceCaseTable {
  const trimmed = value.trim();
  if (
    trimmed === "cases" ||
    trimmed === "doctor_cases" ||
    trimmed === "training_cases" ||
    trimmed === "community_cases"
  ) {
    return trimmed;
  }
  return "cases";
}

/**
 * Build a versioned `hairaudit.upload.created` event from route / DB context.
 * Pure and testable — no I/O.
 */
export function buildHairAuditUploadCreatedEvent(
  input: BuildHairAuditUploadCreatedEventInput
): HairAuditUploadCreatedEvent {
  const occurredAt = input.occurred_at?.trim() || new Date().toISOString();
  const legacyType = input.legacy_upload_type?.trim() || undefined;

  return {
    event_name: HAIRAUDIT_UPLOAD_EVENT_NAMES.CREATED,
    event_version: HAIRAUDIT_UPLOAD_EVENT_VERSION,
    case_id: input.case_id.trim(),
    upload_id: input.upload_id.trim(),
    actor_type: normalizeActorType(input.actor_type),
    upload_surface: normalizeUploadSurface(input.upload_surface),
    source_case_table: normalizeSourceCaseTable(input.source_case_table),
    storage_bucket: input.storage_bucket,
    storage_path: input.storage_path.trim(),
    canonical_photo_category: resolveCanonicalCategoryForUploadEvent({
      legacy_upload_type: legacyType,
      explicit_category: input.canonical_photo_category,
    }),
    ...(legacyType ? { legacy_upload_type: legacyType } : {}),
    metadata_version: input.metadata_version ?? CURRENT_METADATA_VERSION,
    occurred_at: occurredAt,
  };
}

/**
 * Build a versioned `hairaudit.upload.deleted` event from route / DB context.
 * Pure and testable — no I/O.
 */
export function buildHairAuditUploadDeletedEvent(
  input: BuildHairAuditUploadDeletedEventInput
): HairAuditUploadDeletedEvent {
  const deletedAt = input.deleted_at?.trim() || new Date().toISOString();
  const legacyType = input.legacy_upload_type?.trim() || undefined;

  const actorFromInput = input.actor_type?.trim();
  const actorFromLegacy = inferActorTypeFromLegacyType(legacyType);
  const actorType =
    actorFromInput && isValidUploadActorType(actorFromInput)
      ? actorFromInput
      : actorFromLegacy;

  const surfaceFromInput = input.upload_surface?.trim();
  const surfaceFromLegacy = inferUploadSurfaceFromLegacyType(legacyType);
  const uploadSurface =
    surfaceFromInput && isValidUploadSurface(surfaceFromInput)
      ? surfaceFromInput
      : surfaceFromLegacy;

  const event: HairAuditUploadDeletedEvent = {
    event_name: HAIRAUDIT_UPLOAD_EVENT_NAMES.DELETED,
    event_version: HAIRAUDIT_UPLOAD_EVENT_VERSION,
    case_id: input.case_id.trim(),
    upload_id: input.upload_id.trim(),
    source_case_table: normalizeSourceCaseTable(input.source_case_table ?? "cases"),
    storage_bucket: input.storage_bucket,
    storage_path: input.storage_path.trim(),
    canonical_photo_category: resolveCanonicalCategoryForUploadEvent({
      legacy_upload_type: legacyType,
      explicit_category: input.canonical_photo_category,
    }),
    ...(legacyType ? { legacy_upload_type: legacyType } : {}),
    metadata_version: input.metadata_version ?? CURRENT_METADATA_VERSION,
    deleted_at: deletedAt,
    occurred_at: input.occurred_at?.trim() || deletedAt,
  };

  if (actorType) event.actor_type = actorType;
  if (uploadSurface) event.upload_surface = uploadSurface;

  return event;
}

/** Flatten event for integration sink / logging (no nested objects). */
export function flattenUploadEventForSink(
  event: HairAuditUploadEvent
): Record<string, string | number | boolean | null | undefined> {
  const base: Record<string, string | number | boolean | null | undefined> = {
    event_name: event.event_name,
    event_version: event.event_version,
    case_id: event.case_id,
    upload_id: event.upload_id,
    source_case_table: event.source_case_table,
    storage_bucket: event.storage_bucket,
    storage_path: event.storage_path,
    canonical_photo_category: event.canonical_photo_category,
    legacy_upload_type: event.legacy_upload_type ?? null,
    metadata_version: event.metadata_version,
    occurred_at: event.occurred_at,
  };

  if (event.event_name === HAIRAUDIT_UPLOAD_EVENT_NAMES.CREATED) {
    base.actor_type = event.actor_type;
    base.upload_surface = event.upload_surface;
  } else {
    base.deleted_at = event.deleted_at;
    if (event.actor_type) base.actor_type = event.actor_type;
    if (event.upload_surface) base.upload_surface = event.upload_surface;
  }

  return base;
}

/**
 * Returns true when the payload contains no signed URLs or token-like secrets.
 * Used by tests and optional debug validation.
 */
export function uploadEventPayloadIsSafe(
  payload: Record<string, unknown>
): { safe: true } | { safe: false; violations: string[] } {
  const violations: string[] = [];

  for (const [key, value] of Object.entries(payload)) {
    const keyLower = key.toLowerCase();
    if (SENSITIVE_PAYLOAD_KEYS.some((s) => keyLower.includes(s.toLowerCase()))) {
      violations.push(`forbidden key: ${key}`);
    }
    if (typeof value === "string") {
      const v = value.toLowerCase();
      if (v.includes("token=") || v.includes("signature=") || v.includes("x-amz-signature")) {
        violations.push(`sensitive value in ${key}`);
      }
    }
  }

  return violations.length === 0 ? { safe: true } : { safe: false, violations };
}
