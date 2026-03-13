import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// DELETE /api/cases/delete?caseId=...
// Draft-only patient delete uses soft-delete fields (no hard delete).
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

    const now = new Date().toISOString();
    const { error: delCaseErr } = await admin
      .from("cases")
      .update({
        deleted_at: now,
        deleted_by: user.id,
        delete_reason: "Patient discarded draft",
        archived_at: now,
        archived_by: user.id,
        archived_reason: "Patient discarded draft",
        updated_at: now,
      })
      .eq("id", caseId);

    if (delCaseErr) return NextResponse.json({ error: delCaseErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const errMsg = (e as Error)?.message ?? "Server error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

