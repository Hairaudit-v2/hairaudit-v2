import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess, requireAcademyStaff } from "@/lib/academy/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: trainingDoctorId } = await ctx.params;
  const supabase = await createSupabaseAuthServerClient();
  const { data, error } = await supabase
    .from("training_competency_weekly_reviews")
    .select("*")
    .eq("training_doctor_id", trainingDoctorId)
    .order("week_number", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reviews: data ?? [] });
}

type PostBody = {
  weekNumber: number;
  reviewStartDate: string;
  reviewEndDate: string;
  strengths?: string | null;
  focusAreas?: string | null;
  risksOrConcerns?: string | null;
  recommendedNextTargets?: string | null;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let access;
  try {
    access = await requireAcademyStaff();
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id: trainingDoctorId } = await ctx.params;
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const weekNumber = Number(body.weekNumber);
  if (!Number.isFinite(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ ok: false, error: "weekNumber required" }, { status: 400 });
  }
  const reviewStartDate = String(body.reviewStartDate || "").trim();
  const reviewEndDate = String(body.reviewEndDate || "").trim();
  if (!reviewStartDate || !reviewEndDate) {
    return NextResponse.json({ ok: false, error: "reviewStartDate and reviewEndDate required" }, { status: 400 });
  }

  const supabase = await createSupabaseAuthServerClient();
  const { data, error } = await supabase
    .from("training_competency_weekly_reviews")
    .upsert(
      {
        training_doctor_id: trainingDoctorId,
        week_number: weekNumber,
        review_start_date: reviewStartDate,
        review_end_date: reviewEndDate,
        strengths: body.strengths?.trim() || null,
        focus_areas: body.focusAreas?.trim() || null,
        risks_or_concerns: body.risksOrConcerns?.trim() || null,
        recommended_next_targets: body.recommendedNextTargets?.trim() || null,
        reviewed_by: access.userId,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "training_doctor_id,week_number,review_start_date" }
    )
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, review: data });
}
