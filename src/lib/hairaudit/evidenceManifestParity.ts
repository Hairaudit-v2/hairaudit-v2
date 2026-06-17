/**
 * Evidence manifest parity helpers — Phase 2E
 *
 * Pure comparison utilities between legacy upload rows, audit_photos,
 * and the Phase 2E upload event contract. Does not mutate manifests.
 *
 * See: docs/hairaudit-v2-phase-2e-upload-events-manifest-parity.md
 */

import type { HairAuditUploadCreatedEvent } from "./uploadEvents";
import {
  isValidCanonicalPhotoCategory,
  parseLegacyUploadType,
  type CanonicalPhotoCategory,
  type UploadActorType,
} from "./uploadContract";

export type LegacyUploadManifestRow = {
  id?: string | null;
  type?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AuditPhotoManifestRow = {
  id?: string | null;
  case_id?: string | null;
  submitter_type?: string | null;
  photo_key?: string | null;
  storage_path?: string | null;
  public_url?: string | null;
};

export type NormalizedManifestUpload = {
  upload_id: string | null;
  storage_path: string | null;
  legacy_upload_type: string | null;
  canonical_photo_category: CanonicalPhotoCategory | string;
  actor_type: UploadActorType | "unknown";
  metadata_category: string | null;
  source: "uploads" | "audit_photos" | "upload_event";
};

export type ManifestFieldGap = {
  field: string;
  legacy: unknown;
  contract: unknown;
};

export type ManifestCoverageGap = {
  kind:
    | "upload_without_audit_photo"
    | "audit_photo_without_upload"
    | "path_mismatch"
    | "category_mismatch"
    | "missing_from_manifest_view";
  upload_id?: string | null;
  storage_path?: string | null;
  detail: string;
};

const ACTOR_FROM_SUBMITTER: Record<string, UploadActorType> = {
  patient: "patient",
  doctor: "doctor",
  clinic: "clinic",
  auditor: "auditor",
};

function metadataCategory(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta.category !== "string") return null;
  return meta.category;
}

function actorFromLegacyType(type: string): UploadActorType | "unknown" {
  const parsed = parseLegacyUploadType(type);
  return parsed.actor ?? "unknown";
}

/**
 * Normalize a legacy `uploads` row into manifest-comparable shape.
 */
export function normalizeLegacyUploadForManifest(
  row: LegacyUploadManifestRow
): NormalizedManifestUpload {
  const type = String(row.type ?? "");
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : null;
  const metaCategory = metadataCategory(meta);

  return {
    upload_id: row.id ?? null,
    storage_path: row.storage_path ?? null,
    legacy_upload_type: type || null,
    canonical_photo_category: resolveCategoryFromLegacy(type, metaCategory),
    actor_type: actorFromLegacyType(type),
    metadata_category: metaCategory,
    source: "uploads",
  };
}

/**
 * Normalize an `audit_photos` row for parity checks against uploads / events.
 */
export function normalizeAuditPhotoForManifest(
  row: AuditPhotoManifestRow
): NormalizedManifestUpload {
  const submitter = String(row.submitter_type ?? "").toLowerCase();
  const photoKey = row.photo_key ?? null;
  const category = photoKey && isValidCanonicalPhotoCategory(photoKey) ? photoKey : photoKey ?? "other";

  return {
    upload_id: row.id ?? null,
    storage_path: row.storage_path ?? null,
    legacy_upload_type: photoKey ? `${submitter}_photo:${photoKey}` : null,
    canonical_photo_category: category,
    actor_type: ACTOR_FROM_SUBMITTER[submitter] ?? "unknown",
    metadata_category: photoKey,
    source: "audit_photos",
  };
}

function resolveCategoryFromLegacy(
  legacyType: string,
  metaCategory: string | null
): CanonicalPhotoCategory | string {
  if (metaCategory && isValidCanonicalPhotoCategory(metaCategory)) {
    return metaCategory;
  }
  const parsed = parseLegacyUploadType(legacyType);
  if (parsed.category && isValidCanonicalPhotoCategory(parsed.category)) {
    return parsed.category;
  }
  return metaCategory ?? parsed.category ?? "other";
}

/**
 * Compare a Phase 2E upload event to a normalized legacy/manifest input.
 */
export function compareUploadContractToManifestInput(
  event: HairAuditUploadCreatedEvent,
  manifestInput: NormalizedManifestUpload
): { matches: boolean; gaps: ManifestFieldGap[] } {
  const gaps: ManifestFieldGap[] = [];

  const compare = (field: string, contractVal: unknown, legacyVal: unknown) => {
    if (contractVal !== legacyVal) {
      gaps.push({ field, contract: contractVal, legacy: legacyVal });
    }
  };

  compare("upload_id", event.upload_id, manifestInput.upload_id);
  compare("storage_path", event.storage_path, manifestInput.storage_path);
  compare("canonical_photo_category", event.canonical_photo_category, manifestInput.canonical_photo_category);
  compare("actor_type", event.actor_type, manifestInput.actor_type);

  if (event.legacy_upload_type && manifestInput.legacy_upload_type) {
    compare("legacy_upload_type", event.legacy_upload_type, manifestInput.legacy_upload_type);
  }

  return { matches: gaps.length === 0, gaps };
}

/**
 * Identify coverage gaps between uploads, audit_photos, and optional event payloads.
 */
export function identifyManifestCoverageGaps(args: {
  uploads?: ReadonlyArray<LegacyUploadManifestRow>;
  auditPhotos?: ReadonlyArray<AuditPhotoManifestRow>;
  events?: ReadonlyArray<HairAuditUploadCreatedEvent>;
}): ManifestCoverageGap[] {
  const gaps: ManifestCoverageGap[] = [];
  const uploads = args.uploads ?? [];
  const auditPhotos = args.auditPhotos ?? [];
  const events = args.events ?? [];

  const uploadsByPath = new Map<string, LegacyUploadManifestRow>();
  for (const u of uploads) {
    const path = u.storage_path?.trim();
    if (path) uploadsByPath.set(path, u);
  }

  const auditByPath = new Map<string, AuditPhotoManifestRow>();
  for (const a of auditPhotos) {
    const path = a.storage_path?.trim();
    if (path) auditByPath.set(path, a);
  }

  const dualWritePrefixes = ["patient_photo:", "doctor_photo:", "clinic_photo:", "audit_photo:"];

  for (const u of uploads) {
    const path = u.storage_path?.trim();
    if (!path) continue;
    const type = String(u.type ?? "");
    if (!type.includes("photo") && !type.includes("image")) continue;

    const isDualWriteType = dualWritePrefixes.some((p) => type.startsWith(p));
    if (isDualWriteType && !auditByPath.has(path)) {
      gaps.push({
        kind: "upload_without_audit_photo",
        upload_id: u.id,
        storage_path: path,
        detail: `uploads row has no matching audit_photos entry for path ${path}`,
      });
    }

    const normalized = normalizeLegacyUploadForManifest(u);
    const matchingEvent = events.find((e) => e.upload_id === u.id || e.storage_path === path);
    if (matchingEvent) {
      const cmp = compareUploadContractToManifestInput(matchingEvent, normalized);
      if (!cmp.matches) {
        gaps.push({
          kind: "category_mismatch",
          upload_id: u.id,
          storage_path: path,
          detail: `event vs legacy mismatch: ${cmp.gaps.map((g) => g.field).join(", ")}`,
        });
      }
    }
  }

  for (const a of auditPhotos) {
    const path = a.storage_path?.trim();
    if (!path) continue;
    if (!uploadsByPath.has(path)) {
      gaps.push({
        kind: "audit_photo_without_upload",
        upload_id: a.id,
        storage_path: path,
        detail: `audit_photos row has no matching uploads row for path ${path}`,
      });
    }
  }

  return gaps;
}
