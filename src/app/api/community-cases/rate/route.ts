import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RateBody = {
  caseId?: string;
  naturalness?: number;
  density?: number;
  hairlineDesign?: number;
};

function normalizeRating(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RateBody;
    const caseId = (body.caseId ?? "").trim();
    if (!caseId) return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });

    const naturalness = normalizeRating(body.naturalness);
    const density = normalizeRating(body.density);
    const hairlineDesign = normalizeRating(body.hairlineDesign);
    if (!naturalness || !density || !hairlineDesign) {
      return NextResponse.json({ ok: false, error: "Ratings must be between 1 and 5." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: found, error: caseError } = await supabase
      .from("community_cases")
      .select("id, is_published")
      .eq("id", caseId)
      .maybeSingle();
    if (caseError) return NextResponse.json({ ok: false, error: caseError.message }, { status: 500 });
    if (!found || !found.is_published) {
      return NextResponse.json({ ok: false, error: "Published case not found." }, { status: 404 });
    }

    const { error: insertError } = await supabase.from("community_case_ratings").insert({
      case_id: caseId,
      naturalness,
      density,
      hairline_design: hairlineDesign,
    });
    if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });

    const { data: rows, error: rowsError } = await supabase
      .from("community_case_ratings")
      .select("naturalness, density, hairline_design")
      .eq("case_id", caseId);
    if (rowsError) return NextResponse.json({ ok: false, error: rowsError.message }, { status: 500 });

    const count = rows?.length ?? 0;
    const naturalnessAvg =
      count > 0 ? rows.reduce((sum, r) => sum + Number(r.naturalness ?? 0), 0) / count : null;
    const densityAvg = count > 0 ? rows.reduce((sum, r) => sum + Number(r.density ?? 0), 0) / count : null;
    const hairlineAvg =
      count > 0 ? rows.reduce((sum, r) => sum + Number(r.hairline_design ?? 0), 0) / count : null;

    const { error: updateError } = await supabase
      .from("community_cases")
      .update({
        community_rating_count: count,
        community_naturalness_avg: naturalnessAvg,
        community_density_avg: densityAvg,
        community_hairline_avg: hairlineAvg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId);
    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      aggregates: {
        count,
        naturalnessAvg,
        densityAvg,
        hairlineAvg,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
