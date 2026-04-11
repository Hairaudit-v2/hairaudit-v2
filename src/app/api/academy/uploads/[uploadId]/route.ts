import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ uploadId: string }> }) {
  const requestId = crypto.randomUUID();
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized", requestId }, { status: 401 });
  }

  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized", requestId }, { status: 401 });
  }

  const { uploadId } = await ctx.params;
  const id = uploadId?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing upload id", requestId }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("training_case_uploads")
    .select("id, training_case_id, uploaded_by, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ ok: false, error: "Not found", requestId }, { status: 404 });
  }

  const { data: caseRow, error: caseErr } = await auth
    .from("training_cases")
    .select("id, training_doctor_id")
    .eq("id", row.training_case_id)
    .maybeSingle();

  if (caseErr || !caseRow) {
    return NextResponse.json({ ok: false, error: "Forbidden", requestId }, { status: 403 });
  }

  let mayDelete = access.isStaff;
  if (!mayDelete && row.uploaded_by === user.id) {
    const { data: doctor } = await auth
      .from("training_doctors")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    mayDelete = doctor?.id === caseRow.training_doctor_id;
  }

  if (!mayDelete) {
    return NextResponse.json({ ok: false, error: "Forbidden", requestId }, { status: 403 });
  }

  const { error: delErr } = await admin.from("training_case_uploads").delete().eq("id", id);
  if (delErr) {
    console.error(`[${requestId}] Academy upload delete db failed`, delErr);
    return NextResponse.json({ ok: false, error: "Could not remove upload", requestId }, { status: 500 });
  }

  const bucket = process.env.CASE_FILES_BUCKET || "case-files";
  const { error: stErr } = await admin.storage.from(bucket).remove([row.storage_path]);
  if (stErr) {
    console.warn(`[${requestId}] Academy upload storage remove failed (row deleted)`, stErr.message);
  }

  return NextResponse.json({ ok: true, requestId });
}
