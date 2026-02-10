import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
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
