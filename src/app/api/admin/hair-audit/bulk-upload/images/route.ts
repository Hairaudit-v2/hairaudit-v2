import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireHairAuditBulkAdmin } from "@/lib/hair-audit/bulkUpload/auth";
import { refreshCaseIntakeStatus } from "@/lib/hair-audit/bulkUpload/caseIntake";
import {
  BULK_IMAGE_CATEGORY_SET,
  bulkStoragePath,
  type BulkImageCategory,
} from "@/lib/hair-audit/bulkUpload/constants";
import {
  getBulkImageReviewSyncStatus,
  reconcileBulkImageUpload,
  syncSingleBulkImageToUploads,
  type BulkImageRow,
} from "@/lib/hair-audit/bulkUpload/syncToUploads";
import { safeFileName, formatUploadErrorForUser } from "@/lib/uploads/safeUpload";
import { validateUploadedImage } from "@/lib/uploads/fileValidation";

export const runtime = "nodejs";

async function loadCaseOwnerId(admin: ReturnType<typeof createSupabaseAdminClient>, caseId: string, fallbackUserId: string) {
  const { data: caseRow } = await admin.from("cases").select("user_id").eq("id", caseId).maybeSingle();
  return caseRow?.user_id ?? fallbackUserId;
}

async function verifyCaseInBatch(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  caseId: string,
  batchId: string
) {
  const { data: caseRow } = await admin
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .eq("batch_id", batchId)
    .maybeSingle();
  return Boolean(caseRow);
}

export async function POST(req: Request) {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const form = await req.formData();
  const batchId = (form.get("batchId") as string | null)?.trim();
  const caseId = (form.get("caseId") as string | null)?.trim() || null;
  const categoryRaw = (form.get("category") as string | null)?.trim() || null;
  const file = form.get("file");

  if (!batchId || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing batchId or file" }, { status: 400 });
  }

  if (categoryRaw && !BULK_IMAGE_CATEGORY_SET.has(categoryRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid category" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: batch } = await admin.from("hair_audit_case_batches").select("id").eq("id", batchId).maybeSingle();
  if (!batch) return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });

  if (caseId) {
    const valid = await verifyCaseInBatch(admin, caseId, batchId);
    if (!valid) return NextResponse.json({ ok: false, error: "Case not in batch" }, { status: 400 });
  }

  const validated = await validateUploadedImage(file);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: formatUploadErrorForUser(validated.error) },
      { status: 400 }
    );
  }
  const { buffer, normalizedMime } = validated;

  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const cleanedName = safeFileName(file.name || "upload.jpg");
  const storagePath = bulkStoragePath(batchId, caseId, cleanedName);

  const { error: upErr } = await admin.storage.from(bucket).upload(storagePath, buffer, {
    contentType: normalizedMime,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const { count } = await admin
    .from("hair_audit_case_images")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);

  const { data: row, error: insErr } = await admin
    .from("hair_audit_case_images")
    .insert({
      batch_id: batchId,
      case_id: caseId,
      storage_path: storagePath,
      file_name: file.name || cleanedName,
      mime_type: normalizedMime,
      image_category: (categoryRaw as BulkImageCategory | null) ?? null,
      sort_order: count ?? 0,
      uploaded_by: auth.userId,
    })
    .select("*")
    .single();

  if (insErr) {
    await admin.storage.from(bucket).remove([storagePath]);
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  let sync = null;
  if (caseId && row) {
    const ownerId = await loadCaseOwnerId(admin, caseId, auth.userId);
    sync = await syncSingleBulkImageToUploads(admin, caseId, ownerId, {
      ...(row as BulkImageRow),
      batch_id: batchId,
    });
    await refreshCaseIntakeStatus(admin, caseId);
  }

  const reviewSyncStatus = row
    ? await getBulkImageReviewSyncStatus(admin, [{ id: row.id, case_id: row.case_id, storage_path: row.storage_path }])
    : {};

  return NextResponse.json({
    ok: true,
    image: row ? { ...row, synced_to_review: reviewSyncStatus[row.id] ?? false } : row,
    sync,
  });
}

export async function PATCH(req: Request) {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const imageIds = Array.isArray((body as { imageIds?: unknown }).imageIds)
    ? ((body as { imageIds: unknown[] }).imageIds.filter((x) => typeof x === "string") as string[])
    : [];
  if (!imageIds.length) {
    return NextResponse.json({ ok: false, error: "No image ids provided" }, { status: 400 });
  }

  const caseIdRaw = (body as { caseId?: unknown }).caseId;
  const categoryRaw = (body as { category?: unknown }).category;
  const updatePayload: Record<string, unknown> = {};

  if (caseIdRaw === null) {
    updatePayload.case_id = null;
  } else if (typeof caseIdRaw === "string" && caseIdRaw.trim()) {
    updatePayload.case_id = caseIdRaw.trim();
  }

  if (categoryRaw === null || categoryRaw === "") {
    updatePayload.image_category = null;
  } else if (typeof categoryRaw === "string") {
    if (!BULK_IMAGE_CATEGORY_SET.has(categoryRaw)) {
      return NextResponse.json({ ok: false, error: "Invalid category" }, { status: 400 });
    }
    updatePayload.image_category = categoryRaw;
  }

  if (!Object.keys(updatePayload).length) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: beforeRows, error: beforeErr } = await admin
    .from("hair_audit_case_images")
    .select("id, case_id, batch_id, storage_path, file_name, mime_type, image_category")
    .in("id", imageIds);

  if (beforeErr) return NextResponse.json({ ok: false, error: beforeErr.message }, { status: 500 });
  if (!beforeRows?.length) {
    return NextResponse.json({ ok: false, error: "No matching images found" }, { status: 404 });
  }

  const batchIds = new Set(beforeRows.map((row) => row.batch_id));
  if (batchIds.size !== 1) {
    return NextResponse.json({ ok: false, error: "Images must belong to a single batch" }, { status: 400 });
  }
  const batchId = [...batchIds][0]!;

  if (typeof updatePayload.case_id === "string") {
    const valid = await verifyCaseInBatch(admin, updatePayload.case_id, batchId);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Target case is not in this batch" }, { status: 400 });
    }
  }

  const beforeById = new Map(beforeRows.map((row) => [row.id, row as BulkImageRow]));

  const { data, error } = await admin
    .from("hair_audit_case_images")
    .update(updatePayload)
    .in("id", imageIds)
    .select("*");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const affectedCaseIds = new Set<string>();
  for (const row of beforeRows) {
    if (row.case_id) affectedCaseIds.add(row.case_id);
  }
  for (const row of data ?? []) {
    if (row.case_id) affectedCaseIds.add(row.case_id);
  }
  if (typeof updatePayload.case_id === "string") affectedCaseIds.add(updatePayload.case_id);

  const syncTotals = { synced: 0, updated: 0, skipped: 0, removed: 0, errors: [] as string[] };
  for (const afterRow of data ?? []) {
    const beforeRow = beforeById.get(afterRow.id);
    if (!beforeRow) continue;
    const after = { ...(afterRow as BulkImageRow), batch_id: batchId };
    const ownerId = after.case_id
      ? await loadCaseOwnerId(admin, after.case_id, auth.userId)
      : auth.userId;
    const sync = await reconcileBulkImageUpload(admin, ownerId, beforeRow, after);
    syncTotals.synced += sync.synced;
    syncTotals.updated += sync.updated;
    syncTotals.skipped += sync.skipped;
    syncTotals.removed += sync.removed;
    syncTotals.errors.push(...sync.errors);
  }

  await Promise.all([...affectedCaseIds].map((caseId) => refreshCaseIntakeStatus(admin, caseId)));

  const reviewSyncStatus = await getBulkImageReviewSyncStatus(
    admin,
    (data ?? []).map((row) => ({ id: row.id, case_id: row.case_id, storage_path: row.storage_path }))
  );

  const images = (data ?? []).map((row) => ({
    ...row,
    synced_to_review: reviewSyncStatus[row.id] ?? false,
  }));

  return NextResponse.json({ ok: true, images, sync: syncTotals });
}
