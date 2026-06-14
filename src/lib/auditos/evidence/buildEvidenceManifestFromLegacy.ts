import type { CaseEvidenceManifest, PreparedImageManifestItem } from "@/lib/evidence/evidenceManifest";
import type {
  AuditOsEvidenceCompletenessSummary,
  AuditOsEvidenceItem,
  AuditOsEvidenceItemRole,
  AuditOsEvidenceManifest,
} from "./types";

type LegacyUpload = {
  id?: string | null;
  type?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Baseline required canonical slots aligned with `prepareCaseEvidence` expectations (informational only). */
const REQUIRED_CANONICAL_SLOTS = 5;

function inferRoleFromType(type: string): AuditOsEvidenceItemRole {
  const t = type.toLowerCase();
  if (t.startsWith("patient_")) return "patient";
  if (t.startsWith("doctor_")) return "doctor";
  if (t.startsWith("clinic_")) return "clinic";
  if (t.includes("audit")) return "auditor";
  return "unknown";
}

function isLikelyImage(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("image") || t.includes("photo") || t.includes("jpg") || t.includes("png") || t.includes("jpeg") || t.includes("webp");
}

function isLikelyDocument(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("pdf") || t.includes("document") || t.includes("doc") || t.includes("report_pack");
}

function uploadToItem(u: LegacyUpload): AuditOsEvidenceItem {
  const type = String(u.type ?? "");
  const meta = u.metadata && typeof u.metadata === "object" ? u.metadata : undefined;
  const category = meta && typeof meta.category === "string" ? meta.category : null;
  return {
    uploadId: u.id ?? null,
    storagePath: u.storage_path ?? null,
    category,
    phase: meta && typeof meta.phase === "string" ? meta.phase : null,
    sourceRole: inferRoleFromType(type),
    type: u.type ?? null,
    metadata: meta ?? undefined,
  };
}

function preparedToItem(p: PreparedImageManifestItem): AuditOsEvidenceItem {
  return {
    uploadId: p.upload_id,
    storagePath: p.prepared_path ?? p.original_path,
    mimeType: p.mime_type,
    category: p.category,
    phase: null,
    sourceRole: "system",
    type: "prepared_image",
    metadata: {
      quality_label: p.quality_label,
      width: p.width,
      height: p.height,
      notes: p.notes,
    },
  };
}

/**
 * Build a versioned AuditOS evidence manifest view from existing DB/storage shapes only.
 */
export function buildEvidenceManifestFromLegacy(args: {
  caseId: string;
  legacyManifest: CaseEvidenceManifest | null;
  uploads?: ReadonlyArray<LegacyUpload> | null;
}): AuditOsEvidenceManifest {
  const { caseId, legacyManifest, uploads = [] } = args;
  const images: AuditOsEvidenceItem[] = [];
  const documents: AuditOsEvidenceItem[] = [];
  const otherUploads: AuditOsEvidenceItem[] = [];

  for (const u of uploads ?? []) {
    const type = String(u.type ?? "");
    const item = uploadToItem(u);
    if (isLikelyImage(type)) images.push(item);
    else if (isLikelyDocument(type)) documents.push(item);
    else otherUploads.push(item);
  }

  const prepared = legacyManifest?.prepared_images ?? [];
  for (const p of prepared) {
    images.push(preparedToItem(p));
  }

  const missingEvidence = [...(legacyManifest?.missing_categories ?? [])];

  const completeness: AuditOsEvidenceCompletenessSummary = {
    coverageScore:
      typeof legacyManifest?.quality_score === "number" && Number.isFinite(legacyManifest.quality_score)
        ? legacyManifest.quality_score
        : null,
    requiredSlotsTotal: legacyManifest ? REQUIRED_CANONICAL_SLOTS : null,
    requiredSlotsFilled:
      legacyManifest != null ? Math.max(0, REQUIRED_CANONICAL_SLOTS - missingEvidence.length) : null,
    notes: Array.isArray(legacyManifest?.errors) ? legacyManifest.errors.map((e) => String(e)) : [],
  };

  const qualityHints: Record<string, unknown> = {
    prepared_count: prepared.length,
    prepared_quality_mix: prepared.reduce(
      (acc, p) => {
        acc[p.quality_label] = (acc[p.quality_label] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  const confidenceHints: Record<string, unknown> = {
    manifest_status: legacyManifest?.status ?? null,
    upload_image_count: images.filter((i) => i.type !== "prepared_image").length,
  };

  return {
    evidenceManifestVersion: "hairaudit.evidence_manifest.v1",
    caseId,
    legacyManifestId: legacyManifest?.id ?? null,
    status: legacyManifest?.status ?? null,
    images,
    documents,
    otherUploads,
    completeness,
    missingEvidence,
    qualityHints,
    confidenceHints,
    metadata: {
      errors: legacyManifest?.errors ?? [],
      created_at: legacyManifest?.created_at,
      updated_at: legacyManifest?.updated_at,
    },
  };
}
