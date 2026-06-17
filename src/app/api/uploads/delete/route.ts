import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireAuthenticatedUser,
  requireCaseAccess,
} from "@/lib/security/caseAccess.server";
import {
  gateUploadCaseStoragePath,
  isWellFormedUploadId,
  resolveCaseFilesBucket,
} from "@/lib/hairaudit/uploadStorage";
import { notifyHairAuditUploadDeleted } from "@/lib/hairaudit/uploadEventDispatcher";

// DELETE /api/uploads/delete?uploadId=...
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const uploadId = url.searchParams.get("uploadId")?.trim();

    if (!uploadId) {
      return NextResponse.json({ error: "Missing uploadId" }, { status: 400 });
    }

    if (!isWellFormedUploadId(uploadId)) {
      return NextResponse.json({ error: "Invalid uploadId" }, { status: 400 });
    }

    const bucketGate = resolveCaseFilesBucket();
    if (!bucketGate.ok) {
      console.error("[uploads/delete] Bucket resolution failed:", bucketGate.error);
      return NextResponse.json({ error: "Storage is unavailable" }, { status: 503 });
    }

    const supabaseAuth = await createSupabaseAuthServerClient();
    const userGate = await requireAuthenticatedUser(supabaseAuth);
    if (!userGate.ok) return userGate.response;

    const admin = createSupabaseAdminClient();

    const { data: upload, error: upErr } = await admin
      .from("uploads")
      .select("id, case_id, user_id, storage_path, type, created_at")
      .eq("id", uploadId)
      .maybeSingle();

    if (upErr) {
      console.error("[uploads/delete] Upload lookup failed:", upErr.message);
      return NextResponse.json({ error: "Could not delete upload" }, { status: 500 });
    }
    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const caseGate = await requireCaseAccess({
      userId: userGate.data.user.id,
      caseId: upload.case_id,
      supabaseAuth,
    });
    if (!caseGate.ok) return caseGate.response;

    const pathGate = gateUploadCaseStoragePath(upload.case_id, upload.storage_path);
    if (!pathGate.ok) {
      return NextResponse.json({ error: pathGate.error }, { status: pathGate.status });
    }

    const { data: caseSubmit, error: caseSubmitErr } = await admin
      .from("cases")
      .select("submitted_at, status")
      .eq("id", upload.case_id)
      .maybeSingle();

    if (caseSubmitErr) {
      console.error("[uploads/delete] Case submit lookup failed:", caseSubmitErr.message);
      return NextResponse.json({ error: "Could not delete upload" }, { status: 500 });
    }

    if (caseSubmit?.submitted_at || caseSubmit?.status === "submitted") {
      return NextResponse.json(
        { error: "This case has been submitted and cannot be modified." },
        { status: 409 }
      );
    }

    if (String(upload.type ?? "").startsWith("surgery_photo:")) {
      const { data: surgeryDetails } = await admin
        .from("surgery_upload_details")
        .select("status")
        .eq("case_id", upload.case_id)
        .maybeSingle();
      if (surgeryDetails?.status === "submitted") {
        return NextResponse.json(
          { error: "This surgery upload has been submitted and cannot be modified." },
          { status: 409 }
        );
      }
    }

    const { error: storageErr } = await admin.storage
      .from(bucketGate.bucket)
      .remove([pathGate.normalizedPath]);

    if (storageErr) {
      console.error("[uploads/delete] Storage remove failed:", storageErr.message);
      return NextResponse.json({ error: "Could not delete upload" }, { status: 500 });
    }

    const { error: delErr } = await admin.from("uploads").delete().eq("id", upload.id);

    if (delErr) {
      console.error("[uploads/delete] DB delete failed:", delErr.message);
      return NextResponse.json({ error: "Could not delete upload" }, { status: 500 });
    }

    try {
      await admin.from("audit_photos").delete().eq("storage_path", pathGate.normalizedPath);
    } catch {
      /* audit_photos may not exist */
    }

    notifyHairAuditUploadDeleted({
      upload_id: upload.id,
      case_id: upload.case_id,
      source_case_table: "cases",
      storage_bucket: bucketGate.bucket,
      storage_path: pathGate.normalizedPath,
      legacy_upload_type: upload.type,
      occurred_at: upload.created_at ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[uploads/delete] Error:", e);
    return NextResponse.json({ error: "Could not delete upload" }, { status: 500 });
  }
}
