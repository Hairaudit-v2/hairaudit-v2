/**
 * HA-PHOTO-TIMELINE-2A Phase C — Collect multi-signal inputs per upload.
 * Prefer auditor corrections over stale type/category. Never mutates uploads.
 */

import type { LegacyUploadSignal } from "@/lib/photoSessions/deriveSessionsFromUploads";

export type UploadAuditCorrectionRow = {
  upload_id: string;
  action?: string | null;
  new_category?: string | null;
  created_at?: string | null;
};

export type ReconcileUploadSignal = {
  uploadId: string;
  effectiveCategory: string;
  categorySource: "correction" | "type" | "metadata";
  createdAt: string | null;
  originalName: string | null;
  batchId: string | null;
  captureStage: string | null;
  captureRole: string | null;
  aiDetectedCategory: string | null;
  aiConfidence: number | null;
  rawType: string | null;
};

function asRecord(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  return meta as Record<string, unknown>;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function categoryFromUploadTypeOrMeta(u: LegacyUploadSignal): {
  category: string | null;
  source: "type" | "metadata" | null;
} {
  const fromType = String(u.type ?? "").trim();
  if (fromType.toLowerCase().startsWith("patient_photo:")) {
    const cat = fromType.slice("patient_photo:".length).trim().toLowerCase();
    return { category: cat || null, source: cat ? "type" : null };
  }
  const meta = asRecord(u.metadata);
  const fromMeta = str(meta?.category)?.toLowerCase() ?? null;
  return { category: fromMeta, source: fromMeta ? "metadata" : null };
}

/**
 * Latest reassign correction wins for each upload_id.
 */
export function latestCorrectionCategoryByUploadId(
  corrections: UploadAuditCorrectionRow[]
): Map<string, string> {
  const sorted = [...corrections].sort((a, b) => {
    const at = Date.parse(a.created_at ?? "") || 0;
    const bt = Date.parse(b.created_at ?? "") || 0;
    return bt - at;
  });
  const map = new Map<string, string>();
  for (const c of sorted) {
    if (c.action && c.action !== "reassign") continue;
    const cat = str(c.new_category)?.toLowerCase();
    if (!cat || !c.upload_id) continue;
    if (!map.has(c.upload_id)) map.set(c.upload_id, cat);
  }
  return map;
}

/**
 * Weak filename → category-like slug heuristics (never authoritative alone).
 */
export function weakCategoryFromFilename(originalName: string | null): string | null {
  if (!originalName) return null;
  const s = originalName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (/month[_\s]?12|m12|12m/.test(s)) {
    if (/donor/.test(s)) return "postop_month12_donor";
    if (/crown/.test(s)) return "postop_month12_crown";
    if (/top/.test(s)) return "postop_month12_top";
    return "postop_month12_front";
  }
  if (/month[_\s]?9|m9|9m/.test(s)) {
    if (/donor/.test(s)) return "postop_month9_donor";
    if (/crown/.test(s)) return "postop_month9_crown";
    if (/top/.test(s)) return "postop_month9_top";
    return "postop_month9_front";
  }
  if (/month[_\s]?6|m6|6m/.test(s)) {
    if (/donor/.test(s)) return "postop_month6_donor";
    if (/crown/.test(s)) return "postop_month6_crown";
    if (/top/.test(s)) return "postop_month6_top";
    return "postop_month6_front";
  }
  if (/month[_\s]?3|m3|3m/.test(s)) {
    if (/donor/.test(s)) return "postop_month3_donor";
    if (/crown/.test(s)) return "postop_month3_crown";
    if (/top/.test(s)) return "postop_month3_top";
    return "postop_month3_front";
  }
  if (/day0|surgery[_\s]?day|intraop/.test(s)) return "day0_recipient";
  if (/pre[_\s]?op|preop|baseline/.test(s)) {
    if (/donor/.test(s)) return "preop_donor_rear";
    if (/top/.test(s)) return "preop_top";
    return "preop_front";
  }
  return null;
}

export function buildReconcileUploadSignals(
  uploads: LegacyUploadSignal[],
  corrections: UploadAuditCorrectionRow[] = []
): ReconcileUploadSignal[] {
  const correctionMap = latestCorrectionCategoryByUploadId(corrections);
  const out: ReconcileUploadSignal[] = [];

  for (const u of uploads) {
    if (!u.id) continue;
    const meta = asRecord(u.metadata);
    if (meta?.audit_excluded === true) continue;

    const fromUpload = categoryFromUploadTypeOrMeta(u);
    const corrected = correctionMap.get(String(u.id)) ?? null;
    const effectiveCategory = corrected ?? fromUpload.category;
    if (!effectiveCategory) continue;

    out.push({
      uploadId: String(u.id),
      effectiveCategory,
      categorySource: corrected ? "correction" : (fromUpload.source ?? "type"),
      createdAt: typeof u.created_at === "string" ? u.created_at : null,
      originalName:
        str(meta?.original_name) ?? str(meta?.originalName) ?? str(meta?.display_name) ?? null,
      batchId: str(meta?.batch_id) ?? str(meta?.bulk_image_id) ?? null,
      captureStage: str(meta?.capture_stage) ?? str(meta?.captureStage) ?? null,
      captureRole: str(meta?.capture_role) ?? str(meta?.captureRole) ?? null,
      aiDetectedCategory:
        str(meta?.ai_detected_category)?.toLowerCase() ??
        str(meta?.aiDetectedCategory)?.toLowerCase() ??
        null,
      aiConfidence:
        num(meta?.ai_classification_confidence) ?? num(meta?.aiClassificationConfidence),
      rawType: typeof u.type === "string" ? u.type : null,
    });
  }

  return out;
}
