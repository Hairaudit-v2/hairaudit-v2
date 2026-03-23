import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function supabaseAdmin() {
  return createSupabaseAdminClient();
}

/**
 * GET /api/debug/reports?caseId=...
 * Quick view of latest reports + summary keys for debugging.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId") ?? "";

  if (!caseId) {
    return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("reports")
    .select("id, case_id, version, created_at, summary")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Helpful: return summary keys only (so it doesn't flood terminal)
  const reports = (data ?? []).map((r: any) => ({
    id: r.id,
    case_id: r.case_id,
    version: r.version,
    created_at: r.created_at,
    summary_keys: r.summary ? Object.keys(r.summary) : [],
    has_answers: Boolean(r.summary?.answers),
    has_computed: Boolean(r.summary?.computed),
  }));

  return NextResponse.json({ ok: true, reports });
}
