import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireHairAuditBulkAdmin } from "@/lib/hair-audit/bulkUpload/auth";
import {
  BULK_IMAGE_CATEGORY_SET,
  bulkStoragePath,
  type BulkImageCategory,
} from "@/lib/hair-audit/bulkUpload/constants";
import { computeCaseReadiness } from "@/lib/hair-audit/bulkUpload/validation";
import { safeFileName, UPLOAD_LIMITS } from "@/lib/uploads/safeUpload";

export const runtime = "nodejs";

async function refreshCaseIntakeStatus(admin: ReturnType<typeof createSupabaseAdminClient>, caseId: string) {
  const { data: caseRow } = await admin
    .from("cases")
    .select("id, patient_reference, graft_count")
    .eq("id", caseId)
    .maybeSingle();
  if (!caseRow) return;

  const { count } = await admin
    .from("hair_audit_case_images")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId);

  const readiness = computeCaseReadiness(
    {
      patient_reference: caseRow.patient_reference ?? "",
      graft_count: caseRow.graft_count,
    },
    count ?? 0
  );

  await admin.from("cases").update({ intake_status: readiness.intakeStatus }).eq("id", caseId);
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

  const maxBytes = UPLOAD_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { ok: false, error: `Each image must be under ${UPLOAD_LIMITS.MAX_FILE_SIZE_MB}MB` },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: batch } = await admin.from("hair_audit_case_batches").select("id").eq("id", batchId).maybeSingle();
  if (!batch) return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });

  if (caseId) {
    const { data: caseRow } = await admin
      .from("cases")
      .select("id, batch_id")
      .eq("id", caseId)
      .eq("batch_id", batchId)
      .maybeSingle();
    if (!caseRow) return NextResponse.json({ ok: false, error: "Case not in batch" }, { status: 400 });
  }

  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const cleanedName = safeFileName(file.name || "upload.jpg");
  const storagePath = bulkStoragePath(batchId, caseId, cleanedName);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from(bucket).upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
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
      mime_type: file.type || null,
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

  if (caseId) {
    await refreshCaseIntakeStatus(admin, caseId);
  }

  return NextResponse.json({ ok: true, image: row });
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
  const { data, error } = await admin
    .from("hair_audit_case_images")
    .update(updatePayload)
    .in("id", imageIds)
    .select("*");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const affectedCaseIds = new Set<string>();
  for (const row of data ?? []) {
    if (row.case_id) affectedCaseIds.add(row.case_id);
  }
  if (typeof updatePayload.case_id === "string") affectedCaseIds.add(updatePayload.case_id);

  await Promise.all([...affectedCaseIds].map((caseId) => refreshCaseIntakeStatus(admin, caseId)));

  return NextResponse.json({ ok: true, images: data ?? [] });
}
