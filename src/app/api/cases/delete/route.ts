import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// DELETE /api/cases/delete?caseId=...
// Draft-only: lets a patient discard an old draft and start fresh.
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const caseId = url.searchParams.get("caseId");
    if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });

    const supabaseAuth = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();

    const { data: c, error: caseErr } = await admin
      .from("cases")
      .select("id, user_id, status, submitted_at")
      .eq("id", caseId)
      .maybeSingle();

    if (caseErr) return NextResponse.json({ error: caseErr.message }, { status: 500 });
    if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

    // Only the owner can delete their own draft.
    if (c.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Draft-only guard.
    if (c.submitted_at || String(c.status ?? "") === "submitted" || String(c.status ?? "") !== "draft") {
      return NextResponse.json({ error: "Only draft cases can be deleted." }, { status: 409 });
    }

    // Load uploads (for storage cleanup).
    const { data: uploads, error: upErr } = await admin
      .from("uploads")
      .select("id, storage_path")
      .eq("case_id", caseId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const paths = (uploads ?? [])
      .map((u) => String(u.storage_path ?? ""))
      .filter(Boolean);

    // Best-effort storage cleanup (don’t block deletion if some objects are missing).
    const bucket = "case-files";
    const storageWarnings: string[] = [];
    const CHUNK = 50;
    for (let i = 0; i < paths.length; i += CHUNK) {
      const chunk = paths.slice(i, i + CHUNK);
      const { error: storageErr } = await admin.storage.from(bucket).remove(chunk);
      if (storageErr) storageWarnings.push(storageErr.message);
    }

    // Delete dependent rows.
    const { error: delUploadsErr } = await admin.from("uploads").delete().eq("case_id", caseId);
    if (delUploadsErr) return NextResponse.json({ error: delUploadsErr.message }, { status: 500 });

    try {
      if (paths.length) {
        await admin.from("audit_photos").delete().in("storage_path", paths);
      }
    } catch {
      /* audit_photos may not exist */
    }

    const { error: delReportsErr } = await admin.from("reports").delete().eq("case_id", caseId);
    if (delReportsErr) return NextResponse.json({ error: delReportsErr.message }, { status: 500 });

    const { error: delCaseErr } = await admin.from("cases").delete().eq("id", caseId);
    if (delCaseErr) return NextResponse.json({ error: delCaseErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, storageWarnings: storageWarnings.length ? storageWarnings : undefined });
  } catch (e: unknown) {
    const errMsg = (e as Error)?.message ?? "Server error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

