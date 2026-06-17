/**
 * FI image-intelligence bridge contract — Phase 2G
 *
 * Pure mapping from HairAudit upload events to FI-compatible image-intelligence
 * input. No network calls, no AI execution, no queue persistence.
 *
 * See: docs/hairaudit-v2-phase-2g-event-sink-fi-bridge.md
 */

import {
  FORENSIC_PIPELINE_SURFACES,
  ISOLATED_SURFACES,
  type UploadSurface,
} from "./uploadContract";
import {
  HAIRAUDIT_UPLOAD_EVENT_NAMES,
  uploadEventPayloadIsSafe,
  type HairAuditUploadCreatedEvent,
  type HairAuditUploadDeletedEvent,
  type HairAuditUploadEvent,
} from "./uploadEvents";

export const FI_IMAGE_INTELLIGENCE_SOURCE_SYSTEM = "hairaudit" as const;

export type FiImageIntelligenceSourceSystem = typeof FI_IMAGE_INTELLIGENCE_SOURCE_SYSTEM;

/** FI-compatible image-intelligence input derived from a HairAudit upload event. */
export interface FiImageIntelligenceInput {
  source_system: FiImageIntelligenceSourceSystem;
  source_event_name: string;
  source_case_id: string;
  source_upload_id: string;
  actor_type?: string;
  upload_surface?: string;
  storage_bucket: string;
  storage_path: string;
  canonical_photo_category: string;
  legacy_upload_type?: string;
  metadata_version: string;
  occurred_at: string;
  /** Present when mapped from a deletion event (suppression / tombstone prep). */
  deleted_at?: string;
}

export interface FiImageIntelligenceBridgeResult {
  input: FiImageIntelligenceInput;
  should_enqueue_image_intelligence: boolean;
  /** Human-readable reason when enqueue is false. */
  reason?: string;
}

const SURFACE_EXCLUSION_REASONS: Partial<Record<UploadSurface, string>> = {
  training: "training surface is isolated from forensic image intelligence pipeline",
  community: "community surface is excluded from forensic image intelligence pipeline",
  bulk_admin: "bulk_admin surface excluded pending per-case assignment validation",
  doctor_portal: "doctor_portal v2 surface is isolated from forensic image intelligence pipeline",
};

export function isFiImageIntelligenceEnabled(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env?.HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED === "true"
  );
}

function mapCreatedEvent(event: HairAuditUploadCreatedEvent): FiImageIntelligenceInput {
  return {
    source_system: FI_IMAGE_INTELLIGENCE_SOURCE_SYSTEM,
    source_event_name: event.event_name,
    source_case_id: event.case_id,
    source_upload_id: event.upload_id,
    actor_type: event.actor_type,
    upload_surface: event.upload_surface,
    storage_bucket: String(event.storage_bucket),
    storage_path: event.storage_path,
    canonical_photo_category: event.canonical_photo_category,
    ...(event.legacy_upload_type ? { legacy_upload_type: event.legacy_upload_type } : {}),
    metadata_version: event.metadata_version,
    occurred_at: event.occurred_at,
  };
}

function mapDeletedEvent(event: HairAuditUploadDeletedEvent): FiImageIntelligenceInput {
  return {
    source_system: FI_IMAGE_INTELLIGENCE_SOURCE_SYSTEM,
    source_event_name: event.event_name,
    source_case_id: event.case_id,
    source_upload_id: event.upload_id,
    ...(event.actor_type ? { actor_type: event.actor_type } : {}),
    ...(event.upload_surface ? { upload_surface: event.upload_surface } : {}),
    storage_bucket: String(event.storage_bucket),
    storage_path: event.storage_path,
    canonical_photo_category: event.canonical_photo_category,
    ...(event.legacy_upload_type ? { legacy_upload_type: event.legacy_upload_type } : {}),
    metadata_version: event.metadata_version,
    occurred_at: event.occurred_at,
    deleted_at: event.deleted_at,
  };
}

/** Map any HairAudit upload lifecycle event to FI-compatible input (pure). */
export function mapUploadEventToFiImageIntelligenceInput(
  event: HairAuditUploadEvent
): FiImageIntelligenceInput {
  if (event.event_name === HAIRAUDIT_UPLOAD_EVENT_NAMES.CREATED) {
    return mapCreatedEvent(event);
  }
  return mapDeletedEvent(event);
}

function surfaceEnqueueEligibility(
  surface: string | undefined
): { eligible: true } | { eligible: false; reason: string } {
  if (!surface) {
    return { eligible: false, reason: "upload_surface unknown — cannot enqueue image intelligence" };
  }

  const exclusion = SURFACE_EXCLUSION_REASONS[surface as UploadSurface];
  if (exclusion) {
    return { eligible: false, reason: exclusion };
  }

  if ((FORENSIC_PIPELINE_SURFACES as readonly string[]).includes(surface)) {
    return { eligible: true };
  }

  if ((ISOLATED_SURFACES as readonly string[]).includes(surface)) {
    return {
      eligible: false,
      reason: `${surface} surface is not in the forensic image intelligence pipeline`,
    };
  }

  return {
    eligible: false,
    reason: `unknown upload_surface "${surface}" — excluded from image intelligence enqueue`,
  };
}

/**
 * Evaluate whether an upload event would enqueue FI image intelligence.
 * Never performs network I/O or AI execution — returns plan/boolean only.
 */
export function evaluateFiImageIntelligenceEnqueue(
  event: HairAuditUploadEvent
): FiImageIntelligenceBridgeResult {
  const input = mapUploadEventToFiImageIntelligenceInput(event);

  if (event.event_name === HAIRAUDIT_UPLOAD_EVENT_NAMES.DELETED) {
    return {
      input,
      should_enqueue_image_intelligence: false,
      reason: "upload.deleted events map for suppression only — not enqueue candidates",
    };
  }

  const surfaceCheck = surfaceEnqueueEligibility(input.upload_surface);
  if (!surfaceCheck.eligible) {
    return {
      input,
      should_enqueue_image_intelligence: false,
      reason: surfaceCheck.reason,
    };
  }

  if (!isFiImageIntelligenceEnabled()) {
    return {
      input,
      should_enqueue_image_intelligence: false,
      reason: "HAIRAUDIT_FI_IMAGE_INTELLIGENCE_ENABLED is not true — bridge contract only",
    };
  }

  const safety = uploadEventPayloadIsSafe(input as unknown as Record<string, unknown>);
  if (!safety.safe) {
    return {
      input,
      should_enqueue_image_intelligence: false,
      reason: "FI bridge input failed payload safety check",
    };
  }

  return {
    input,
    should_enqueue_image_intelligence: true,
    reason: "forensic pipeline upload.created eligible when FI flag enabled (execution not implemented)",
  };
}
