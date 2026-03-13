import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = (searchParams.get("caseId") ?? "").trim();
    if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("community_cases")
      .select(
        "id, created_at, summary, image_data_urls, hairline_design_score, density_score, donor_preservation_score, naturalness_score, overall_score, community_rating_count, community_naturalness_avg, community_density_avg, community_hairline_avg, is_published"
      )
      .eq("id", caseId)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
    if (!data.is_published) {
      return NextResponse.json({ ok: false, error: "Case is private" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, case: data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
