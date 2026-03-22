import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inferCanonicalPhotoCategory } from "@/lib/photos/classification";
import { isPatientUploadAuditExcluded } from "@/lib/uploads/patientPhotoAuditMeta";

type UploadRow = {
  id: string;
  type?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type PreparedImageManifestItem = {
  upload_id: string;
  original_path: string;
  prepared_path: string;
  category: string;
  width: number;
  height: number;
  mime_type: string;
  quality_label: "usable" | "weak" | "poor";
  notes: string;
};

export type CaseEvidenceManifest = {
  id: string;
  case_id: string;
  status: "processing" | "ready" | "failed";
  prepared_images: PreparedImageManifestItem[];
  quality_score: number;
  missing_categories: string[];
  errors: string[];
  created_at?: string;
  updated_at?: string;
};

export type PreparedModelImageInput = {
  uploadId: string;
  sourceKey: string;
  category: string;
  qualityLabel: "usable" | "weak" | "poor";
  mimeType: string;
  dataBase64: string;
};

const REQUIRED_EVIDENCE_CATEGORIES = [
  "preop_front",
  "preop_top",
  "preop_donor_rear",
  "day0_recipient",
  "day0_donor",
] as const;

/**
 * Map prepared-image canonical categories onto REQUIRED_EVIDENCE_CATEGORIES slots.
 * Baseline audit buckets (`patient_current_*` / `current_*`) satisfy the same preop_* coverage
 * as explicit `preop_*` uploads. Aggregate day-of bucket counts toward recipient slot only.
 */
function expandManifestRequiredCoverage(categories: Set<string>): Set<string> {
  const out = new Set(categories);
  const has = (c: string) => out.has(c);
  if (has("current_front") || has("patient_current_front")) out.add("preop_front");
  if (has("current_top") || has("patient_current_top")) out.add("preop_top");
  if (has("current_donor_rear") || has("patient_current_donor_rear")) out.add("preop_donor_rear");
  if (has("day0_recipient") || has("any_day0")) out.add("day0_recipient");
  if (has("day0_donor")) out.add("day0_donor");
  return out;
}

function isImageUpload(type: string): boolean {
  const t = String(type ?? "").toLowerCase();
  return t.includes("image") || t.includes("photo") || t.includes("jpg") || t.includes("png") || t.includes("jpeg") || t.includes("webp");
}

async function sleepMs(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function qualityFromDimensions(width: number, height: number): { label: "usable" | "weak" | "poor"; notes: string[] } {
  const notes: string[] = [];
  if (width < 500 || height < 500) {
    notes.push("small_dimensions");
    return { label: "poor", notes };
  }
  if (width < 900 || height < 900) {
    notes.push("below_preferred_resolution");
    return { label: "weak", notes };
  }
  return { label: "usable", notes };
}

function normalizeQualityScore(params: {
  selectedCount: number;
  preparedImages: PreparedImageManifestItem[];
  missingCategories: string[];
}): number {
  const { selectedCount, preparedImages, missingCategories } = params;
  if (selectedCount <= 0) return 0;
  const successRatio = Math.max(0, Math.min(1, preparedImages.length / selectedCount));
  const categoryCoverageRatio = Math.max(0, Math.min(1, (REQUIRED_EVIDENCE_CATEGORIES.length - missingCategories.length) / REQUIRED_EVIDENCE_CATEGORIES.length));
  const usableCount = preparedImages.filter((x) => x.quality_label === "usable").length;
  const weakCount = preparedImages.filter((x) => x.quality_label === "weak").length;
  const denominator = Math.max(1, preparedImages.length);
  const qualityMixRatio = Math.max(0, Math.min(1, (usableCount + weakCount * 0.5) / denominator));
  const score = (successRatio * 0.5 + categoryCoverageRatio * 0.3 + qualityMixRatio * 0.2) * 100;
  return Math.round(score * 10) / 10;
}

export async function loadLatestEvidenceManifest(args: {
  supabase: SupabaseClient;
  caseId: string;
  status?: "processing" | "ready" | "failed";
}): Promise<CaseEvidenceManifest | null> {
  let query = args.supabase
    .from("case_evidence_manifests")
    .select("id, case_id, status, prepared_images, quality_score, missing_categories, errors, created_at, updated_at")
    .eq("case_id", args.caseId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (args.status) {
    query = query.eq("status", args.status);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data as CaseEvidenceManifest;
}

export async function prepareCaseEvidenceManifest(args: {
  supabase: SupabaseClient;
  caseId: string;
  bucket: string;
  uploads?: UploadRow[];
  logger?: { warn?: (msg: string, data?: Record<string, unknown>) => void; error?: (msg: string, data?: Record<string, unknown>) => void };
}): Promise<{ manifest: CaseEvidenceManifest }> {
  const { supabase, caseId, bucket, logger } = args;
  const uploads: UploadRow[] =
    args.uploads ??
    ((
      await supabase
        .from("uploads")
        .select("id, type, storage_path, metadata, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true })
    ).data ?? []);

  const imageUploads = uploads.filter((u) => isImageUpload(String(u.type ?? "")));

  const { data: processingRow, error: insertErr } = await supabase
    .from("case_evidence_manifests")
    .insert({
      case_id: caseId,
      status: "processing",
      prepared_images: [],
      quality_score: 0,
      missing_categories: [],
      errors: [],
    })
    .select("id")
    .maybeSingle();

  if (insertErr || !processingRow?.id) {
    throw new Error(`case_evidence_manifests insert failed: ${insertErr?.message ?? "unknown error"}`);
  }

  const preparedImages: PreparedImageManifestItem[] = [];
  const errors: string[] = [];

  for (const upload of imageUploads) {
    if (isPatientUploadAuditExcluded(upload)) continue;
    const originalPath = String(upload.storage_path ?? "").trim();
    if (!originalPath) continue;
    const category = inferCanonicalPhotoCategory(upload);
    const uploadId = String(upload.id ?? "");
    let finalized = false;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const downloadRes = await withTimeout(
          supabase.storage.from(bucket).download(originalPath),
          12_000,
          `Timeout downloading image: ${originalPath}`
        );
        if (downloadRes.error || !downloadRes.data) {
          throw new Error(downloadRes.error?.message || "download failed");
        }
        const originalBytes = Buffer.from(await withTimeout(downloadRes.data.arrayBuffer(), 10_000, `Timeout reading bytes: ${originalPath}`));
        const sourceMeta = await sharp(originalBytes).metadata();
        const optimized = await sharp(originalBytes)
          .rotate()
          .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 72, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });
        const width = Number(optimized.info.width ?? sourceMeta.width ?? 0);
        const height = Number(optimized.info.height ?? sourceMeta.height ?? 0);
        const quality = qualityFromDimensions(width, height);
        const preparedPath = `cases/${caseId}/prepared/${uploadId || Date.now().toString()}-${category}.jpg`;

        const uploadRes = await withTimeout(
          supabase.storage.from(bucket).upload(preparedPath, optimized.data, { contentType: "image/jpeg", upsert: true }),
          10_000,
          `Timeout uploading prepared image: ${preparedPath}`
        );
        if (uploadRes.error) {
          throw new Error(uploadRes.error.message);
        }

        preparedImages.push({
          upload_id: uploadId,
          original_path: originalPath,
          prepared_path: preparedPath,
          category,
          width: width || 0,
          height: height || 0,
          mime_type: "image/jpeg",
          quality_label: quality.label,
          notes: quality.notes.join(", "),
        });

        finalized = true;
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger?.warn?.("prepare-case-evidence attempt failed", {
          caseId,
          uploadId,
          originalPath,
          attempt,
          message,
        });
        if (attempt < 3) {
          await sleepMs(250 * 2 ** (attempt - 1));
        } else {
          errors.push(`${uploadId || originalPath}: ${message}`);
          logger?.error?.("prepare-case-evidence image failed", {
            caseId,
            uploadId,
            originalPath,
            message,
          });
        }
      }
    }

    if (!finalized) continue;
  }

  const usefulCategories = expandManifestRequiredCoverage(
    new Set(
      preparedImages
        .filter((x) => x.quality_label !== "poor")
        .map((x) => x.category)
    )
  );
  const missingCategories = REQUIRED_EVIDENCE_CATEGORIES.filter((c) => !usefulCategories.has(c));
  const selectedForPrepare = imageUploads.filter((u) => !isPatientUploadAuditExcluded(u));
  const qualityScore = normalizeQualityScore({
    selectedCount: selectedForPrepare.length,
    preparedImages,
    missingCategories,
  });
  const status: "ready" | "failed" = preparedImages.length > 0 ? "ready" : "failed";

  const { data: finalRow, error: updateErr } = await supabase
    .from("case_evidence_manifests")
    .update({
      status,
      prepared_images: preparedImages,
      quality_score: qualityScore,
      missing_categories: missingCategories,
      errors,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(processingRow.id))
    .select("id, case_id, status, prepared_images, quality_score, missing_categories, errors, created_at, updated_at")
    .maybeSingle();

  if (updateErr || !finalRow) {
    throw new Error(`case_evidence_manifests update failed: ${updateErr?.message ?? "unknown error"}`);
  }

  return {
    manifest: finalRow as CaseEvidenceManifest,
  };
}

/**
 * Sort prepared images for AI model input with graft tray prioritization.
 * Priority: graft_tray_closeup > img_graft_tray_closeup > graft_tray_overview > img_graft_tray_overview > others by quality
 */
function sortPreparedImagesForModel(items: PreparedImageManifestItem[]): PreparedImageManifestItem[] {
  const graftTrayPriority = new Map<string, number>([
    ["graft_tray_closeup", 1],
    ["img_graft_tray_closeup", 2],
    ["graft_tray_overview", 3],
    ["img_graft_tray_overview", 4],
    ["graft_sorting", 5],
    ["graft_hydration_solution", 6],
    ["graft_count_board", 7],
  ]);

  return [...items].sort((a, b) => {
    const aIsGraft = graftTrayPriority.has(a.category);
    const bIsGraft = graftTrayPriority.has(b.category);

    // Both are graft tray - sort by priority
    if (aIsGraft && bIsGraft) {
      return (graftTrayPriority.get(a.category) ?? 99) - (graftTrayPriority.get(b.category) ?? 99);
    }

    // Only a is graft tray - comes first
    if (aIsGraft) return -1;
    // Only b is graft tray - comes first
    if (bIsGraft) return 1;

    // Neither is graft tray - sort by quality (usable > weak > poor)
    const qualityOrder = { usable: 0, weak: 1, poor: 2 };
    return qualityOrder[a.quality_label] - qualityOrder[b.quality_label];
  });
}

/** Load prepared JPEGs from storage as base64 for model calls. Kept out of `prepareCaseEvidenceManifest` so Inngest `step.run` outputs stay under payload limits. */
export async function loadPreparedModelImageInputs(args: {
  supabase: SupabaseClient;
  bucket: string;
  items: PreparedImageManifestItem[];
  logger?: { warn?: (msg: string, data?: Record<string, unknown>) => void; info?: (msg: string, data?: Record<string, unknown>) => void };
  maxItems?: number;
  caseId?: string;
}): Promise<PreparedModelImageInput[]> {
  const { supabase, bucket, items, logger, maxItems = 10, caseId } = args;

  // Sort with graft tray prioritization
  const sortedItems = sortPreparedImagesForModel(items);

  // Count graft tray images before limiting
  const graftTrayCategories = new Set([
    "graft_tray_closeup",
    "graft_tray_overview",
    "img_graft_tray_closeup",
    "img_graft_tray_overview",
    "graft_sorting",
    "graft_hydration_solution",
    "graft_count_board",
  ]);
  const totalGraftTray = sortedItems.filter((i) => graftTrayCategories.has(i.category)).length;

  // Limit to max (default 10 for AI model)
  const itemsToLoad = sortedItems.slice(0, maxItems);
  const selectedGraftTray = itemsToLoad.filter((i) => graftTrayCategories.has(i.category)).length;

  // Debug logging
  const logContext = caseId ? ` ${caseId}` : "";
  if (logger?.info) {
    logger.info(`[loadPreparedModelImageInputs${logContext}] Selection summary`, {
      totalItems: items.length,
      selectedItems: itemsToLoad.length,
      totalGraftTrayImages: totalGraftTray,
      selectedGraftTrayImages: selectedGraftTray,
      maxItems,
      fallbackUsed: totalGraftTray === 0,
    });
  }

  // Guard: warn if graft tray images exist but weren't selected
  if (totalGraftTray > 0 && selectedGraftTray === 0) {
    const warnMsg = `[loadPreparedModelImageInputs${logContext}] WARNING: ${totalGraftTray} graft tray images available but 0 selected in top ${maxItems}`;
    if (logger?.warn) {
      logger.warn(warnMsg, {
        totalGraftTray,
        topCategories: itemsToLoad.slice(0, 5).map((i) => i.category),
      });
    } else {
      // eslint-disable-next-line no-console
      console.warn(warnMsg);
    }
  }

  const out: PreparedModelImageInput[] = [];
  for (const item of itemsToLoad) {
    const preparedPath = String(item.prepared_path ?? "").trim();
    if (!preparedPath) continue;
    const downloadRes = await withTimeout(
      supabase.storage.from(bucket).download(preparedPath),
      12_000,
      `Timeout downloading image: ${preparedPath}`
    );
    if (downloadRes.error || !downloadRes.data) {
      logger?.warn?.(`Failed to download prepared image: ${preparedPath}`, { error: downloadRes.error?.message });
      continue;
    }
    const buf = Buffer.from(
      await withTimeout(downloadRes.data.arrayBuffer(), 10_000, `Timeout reading image: ${preparedPath}`)
    );
    out.push({
      uploadId: item.upload_id,
      sourceKey: preparedPath,
      category: item.category,
      qualityLabel: item.quality_label,
      mimeType: item.mime_type || "image/jpeg",
      dataBase64: buf.toString("base64"),
    });
  }
  return out;
}

