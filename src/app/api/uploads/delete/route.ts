import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { canAccessCase } from "@/lib/case-access";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// DELETE /api/uploads/delete?uploadId=...
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const uploadId = url.searchParams.get("uploadId");

    if (!uploadId) {
      return NextResponse.json({ error: "Missing uploadId" }, { status: 400 });
    }

    // 1) Identify logged-in user (cookie-aware)
    const supabaseAuth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // 2) Load upload row
    const { data: upload, error: upErr } = await admin
      .from("uploads")
      .select("id, case_id, user_id, storage_path, type")
      .eq("id", uploadId)
      .maybeSingle();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const { data: c, error: caseErr } = await admin
      .from("cases")
      .select("id, user_id, patient_id, doctor_id, clinic_id, status, submitted_at")
      .eq("id", upload.case_id)
      .maybeSingle();

    if (caseErr) {
      return NextResponse.json({ error: caseErr.message }, { status: 500 });
    }
    const allowed = await canAccessCase(user.id, c);
    if (!c || !allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Optional: stop deletions after submit (recommended)
    if (c.submitted_at || c.status === "submitted") {
      return NextResponse.json(
        { error: "This case has been submitted and cannot be modified." },
        { status: 409 }
      );
    }

    // 4) Delete from Storage (bucket is in the first segment of storage_path)
    // Your storage_path currently looks like: "cases/<caseId>/patient/..."
    // So we delete from the "case-files" bucket using that path.
    const bucket = "case-files";
    const { error: storageErr } = await admin.storage
      .from(bucket)
      .remove([upload.storage_path]);

    if (storageErr) {
      return NextResponse.json({ error: storageErr.message }, { status: 500 });
    }

    const { error: delErr } = await admin.from("uploads").delete().eq("id", upload.id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    try {
      await admin.from("audit_photos").delete().eq("storage_path", upload.storage_path);
    } catch {
      /* audit_photos may not exist */
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
