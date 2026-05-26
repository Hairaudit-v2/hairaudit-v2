import type { SupabaseClient } from "@supabase/supabase-js";
import { BULK_TO_DOCTOR_PHOTO_KEY, type BulkImageCategory } from "./constants";

export type BulkImageRow = {
  id: string;
  case_id: string | null;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  image_category: BulkImageCategory | null;
  batch_id?: string;
};

export type BulkSyncResult = {
  synced: number;
  updated: number;
  skipped: number;
  removed: number;
  errors: string[];
};

type UploadRow = {
  id: string;
  case_id: string;
  type: string;
  storage_path: string;
  metadata: Record<string, unknown> | null;
};

function emptySyncResult(): BulkSyncResult {
  return { synced: 0, updated: 0, skipped: 0, removed: 0, errors: [] };
}

function mergeSyncResult(target: BulkSyncResult, source: BulkSyncResult) {
  target.synced += source.synced;
  target.updated += source.updated;
  target.skipped += source.skipped;
  target.removed += source.removed;
  target.errors.push(...source.errors);
}

function bulkTypeForCategory(category: BulkImageCategory | null) {
  const bulkCategory = category ?? "other";
  const auditKey = BULK_TO_DOCTOR_PHOTO_KEY[bulkCategory] ?? "img_preop_front";
  return {
    bulkCategory,
    auditKey,
    typeValue: `doctor_photo:${auditKey}`,
  };
}

function bulkUploadMetadata(
  img: BulkImageRow,
  auditKey: string,
  bulkCategory: BulkImageCategory | "other"
): Record<string, unknown> {
  return {
    bulk_image_id: img.id,
    bulk_category: bulkCategory,
    audit_category: auditKey,
    original_name: img.file_name,
    mime: img.mime_type,
    source: "hair_audit_bulk_upload",
    ...(img.batch_id ? { batch_id: img.batch_id } : {}),
  };
}

async function findUploadForBulkImage(
  admin: SupabaseClient,
  img: Pick<BulkImageRow, "id" | "storage_path">
): Promise<UploadRow | null> {
  const { data: byMeta } = await admin
    .from("uploads")
    .select("id, case_id, type, storage_path, metadata")
    .contains("metadata", { bulk_image_id: img.id })
    .maybeSingle();

  if (byMeta) return byMeta as UploadRow;

  const { data: byPath } = await admin
    .from("uploads")
    .select("id, case_id, type, storage_path, metadata")
    .eq("storage_path", img.storage_path)
    .maybeSingle();

  return (byPath as UploadRow | null) ?? null;
}

export async function removeBulkImageFromUploads(
  admin: SupabaseClient,
  img: Pick<BulkImageRow, "id" | "storage_path">
): Promise<BulkSyncResult> {
  const result = emptySyncResult();
  const existing = await findUploadForBulkImage(admin, img);
  if (!existing) {
    result.skipped++;
    return result;
  }

  const { error } = await admin.from("uploads").delete().eq("id", existing.id);
  if (error) {
    result.errors.push(error.message);
  } else {
    result.removed++;
  }
  return result;
}

export async function syncSingleBulkImageToUploads(
  admin: SupabaseClient,
  caseId: string,
  userId: string,
  img: BulkImageRow
): Promise<BulkSyncResult> {
  const result = emptySyncResult();
  if (img.case_id !== caseId) {
    result.errors.push(`Bulk image ${img.id} is not assigned to case ${caseId}`);
    return result;
  }

  const { bulkCategory, auditKey, typeValue } = bulkTypeForCategory(img.image_category);
  const metadata = bulkUploadMetadata(img, auditKey, bulkCategory);
  const existing = await findUploadForBulkImage(admin, img);

  if (existing) {
    const needsUpdate =
      existing.case_id !== caseId ||
      existing.type !== typeValue ||
      existing.storage_path !== img.storage_path ||
      existing.metadata?.bulk_category !== bulkCategory;

    if (!needsUpdate) {
      result.skipped++;
      return result;
    }

    const { error } = await admin
      .from("uploads")
      .update({
        case_id: caseId,
        type: typeValue,
        storage_path: img.storage_path,
        metadata: { ...(existing.metadata ?? {}), ...metadata },
      })
      .eq("id", existing.id);

    if (error) result.errors.push(error.message);
    else result.updated++;
    return result;
  }

  const { error } = await admin.from("uploads").insert({
    case_id: caseId,
    user_id: userId,
    type: typeValue,
    storage_path: img.storage_path,
    metadata,
  });

  if (error) result.errors.push(error.message);
  else result.synced++;
  return result;
}

export async function reconcileBulkImageUpload(
  admin: SupabaseClient,
  userId: string,
  before: BulkImageRow,
  after: BulkImageRow
): Promise<BulkSyncResult> {
  const result = emptySyncResult();

  if (before.case_id && before.case_id !== after.case_id) {
    mergeSyncResult(result, await removeBulkImageFromUploads(admin, before));
  }

  if (!after.case_id) {
    mergeSyncResult(result, await removeBulkImageFromUploads(admin, after));
    return result;
  }

  mergeSyncResult(result, await syncSingleBulkImageToUploads(admin, after.case_id, userId, after));
  return result;
}

export async function syncBulkImagesToUploads(
  admin: SupabaseClient,
  caseId: string,
  userId: string,
  images: BulkImageRow[]
): Promise<BulkSyncResult> {
  const result = emptySyncResult();
  const caseImages = images.filter((img) => img.case_id === caseId);

  for (const img of caseImages) {
    mergeSyncResult(result, await syncSingleBulkImageToUploads(admin, caseId, userId, img));
  }

  return result;
}

export async function syncBatchBulkImagesToUploads(
  admin: SupabaseClient,
  batchId: string,
  defaultUserId: string
): Promise<BulkSyncResult & { caseIds: string[] }> {
  const result = emptySyncResult();
  const caseIds = new Set<string>();

  const { data: images, error: imgErr } = await admin
    .from("hair_audit_case_images")
    .select("id, case_id, batch_id, storage_path, file_name, mime_type, image_category")
    .eq("batch_id", batchId)
    .not("case_id", "is", null);

  if (imgErr) {
    result.errors.push(imgErr.message);
    return { ...result, caseIds: [] };
  }

  const byCase = new Map<string, BulkImageRow[]>();
  for (const row of images ?? []) {
    if (!row.case_id) continue;
    caseIds.add(row.case_id);
    const list = byCase.get(row.case_id) ?? [];
    list.push(row as BulkImageRow);
    byCase.set(row.case_id, list);
  }

  for (const caseId of caseIds) {
    const { data: caseRow } = await admin.from("cases").select("user_id").eq("id", caseId).maybeSingle();
    const userId = caseRow?.user_id ?? defaultUserId;
    mergeSyncResult(result, await syncBulkImagesToUploads(admin, caseId, userId, byCase.get(caseId) ?? []));
  }

  return { ...result, caseIds: [...caseIds] };
}

export async function getBulkImageReviewSyncStatus(
  admin: SupabaseClient,
  images: Array<Pick<BulkImageRow, "id" | "case_id" | "storage_path">>
): Promise<Record<string, boolean>> {
  const status: Record<string, boolean> = {};
  if (!images.length) return status;

  const caseIds = [...new Set(images.map((img) => img.case_id).filter(Boolean))] as string[];
  const uploadsByBulkId = new Map<string, { case_id: string; storage_path: string }>();
  const uploadsByPath = new Map<string, { case_id: string }>();

  if (caseIds.length) {
    const { data: uploads } = await admin
      .from("uploads")
      .select("case_id, storage_path, metadata")
      .in("case_id", caseIds);

    for (const upload of uploads ?? []) {
      uploadsByPath.set(`${upload.case_id}:${upload.storage_path}`, { case_id: upload.case_id });
      const bulkImageId = (upload.metadata as Record<string, unknown> | null)?.bulk_image_id;
      if (typeof bulkImageId === "string") {
        uploadsByBulkId.set(bulkImageId, {
          case_id: upload.case_id,
          storage_path: upload.storage_path,
        });
      }
    }
  }

  for (const img of images) {
    if (!img.case_id) {
      status[img.id] = false;
      continue;
    }

    const byMeta = uploadsByBulkId.get(img.id);
    if (byMeta && byMeta.case_id === img.case_id && byMeta.storage_path === img.storage_path) {
      status[img.id] = true;
      continue;
    }

    status[img.id] = uploadsByPath.has(`${img.case_id}:${img.storage_path}`);
  }

  return status;
}

export async function countReviewUploadsForCases(
  admin: SupabaseClient,
  caseIds: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (!caseIds.length) return counts;

  const { data: uploads, error } = await admin.from("uploads").select("case_id").in("case_id", caseIds);
  if (error) return counts;

  for (const row of uploads ?? []) {
    counts[row.case_id] = (counts[row.case_id] ?? 0) + 1;
  }
  return counts;
}
