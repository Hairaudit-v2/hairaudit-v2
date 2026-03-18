import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * PATCH: Set audit mode for a clinic-owned case only.
 * Body: { caseId: string, auditMode: 'internal' | 'public' }
 * Does not modify submission logic; only updates audit_mode and visibility_scope.
 */
export async function PATCH(req: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { caseId?: string; auditMode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
  const auditMode = typeof body.auditMode === "string" ? body.auditMode.toLowerCase() : "";

  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });
  if (auditMode !== "internal" && auditMode !== "public") {
    return NextResponse.json({ error: "auditMode must be 'internal' or 'public'" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: row, error: fetchError } = await admin
    .from("cases")
    .select("id, clinic_id, audit_mode, visibility_scope")
    .eq("id", caseId)
    .eq("clinic_id", user.id)
    .maybeSingle();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Case not found or not owned by this clinic" }, { status: 404 });
  }

  const visibilityScope = auditMode === "public" ? "public" : "internal";

  const { error: updateError } = await admin
    .from("cases")
    .update({
      audit_mode: auditMode,
      visibility_scope: visibilityScope,
    })
    .eq("id", caseId)
    .eq("clinic_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, caseId, auditMode, visibilityScope });
}
