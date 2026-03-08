import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";

export const runtime = "nodejs";

/**
 * POST — Manually unlock auditor review for a report (admin/auditor only).
 * Sets auditor_review_eligibility = eligible_manual_unlock, auditor_review_reason = manual_admin_unlock,
 * auditor_review_status = available.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!isAuditor({ profileRole: profile?.role, userEmail: user.email })) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { reportId?: string };
    const reportId = String(body?.reportId ?? "").trim();
    if (!reportId) return NextResponse.json({ ok: false, error: "Missing reportId" }, { status: 400 });

    const { error } = await admin
      .from("reports")
      .update({
        auditor_review_eligibility: "eligible_manual_unlock",
        auditor_review_status: "available",
        auditor_review_reason: "manual_admin_unlock",
      })
      .eq("id", reportId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? "Server error") }, { status: 500 });
  }
}
