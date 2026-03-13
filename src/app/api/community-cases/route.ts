import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildHairAuditScore } from "@/lib/communityCases";

type CreateCaseBody = {
  imageDataUrls: string[];
  monthsSinceProcedure?: number | null;
  concernLevel?: "low" | "medium" | "high";
  allowCommunityShare?: boolean;
};

function sanitizeImageDataUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const urls = input
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.startsWith("data:image/"))
    .slice(0, 6);
  return urls;
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("community_cases")
      .select(
        "id, created_at, summary, image_data_urls, hairline_design_score, density_score, donor_preservation_score, naturalness_score, overall_score, community_rating_count, community_naturalness_avg, community_density_avg, community_hairline_avg"
      )
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, cases: data ?? [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateCaseBody;
    const imageDataUrls = sanitizeImageDataUrls(body.imageDataUrls);
    if (!imageDataUrls.length) {
      return NextResponse.json({ ok: false, error: "At least one image is required." }, { status: 400 });
    }

    const monthsSinceProcedure =
      typeof body.monthsSinceProcedure === "number" && Number.isFinite(body.monthsSinceProcedure)
        ? Math.max(0, Math.min(240, Math.round(body.monthsSinceProcedure)))
        : null;

    const concernLevel = body.concernLevel ?? "low";
    const score = buildHairAuditScore({
      photoCount: imageDataUrls.length,
      monthsSinceProcedure,
      concernLevel: concernLevel === "high" || concernLevel === "medium" ? concernLevel : "low",
    });

    const allowCommunityShare = Boolean(body.allowCommunityShare);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("community_cases")
      .insert({
        summary: score.summary,
        image_data_urls: imageDataUrls,
        hairline_design_score: score.hairlineDesign,
        density_score: score.density,
        donor_preservation_score: score.donorPreservation,
        naturalness_score: score.naturalness,
        overall_score: score.overall,
        allow_community_share: allowCommunityShare,
        is_published: allowCommunityShare,
      })
      .select(
        "id, created_at, summary, image_data_urls, hairline_design_score, density_score, donor_preservation_score, naturalness_score, overall_score, community_rating_count, community_naturalness_avg, community_density_avg, community_hairline_avg, is_published"
      )
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, case: data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
