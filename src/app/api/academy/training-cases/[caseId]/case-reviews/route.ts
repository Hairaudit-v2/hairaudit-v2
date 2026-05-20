import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess, requireAcademyStaff } from "@/lib/academy/auth";
import {
  createDraftTrainingCaseReview,
  fetchTrainingCaseReviewsForCase,
} from "@/lib/academy/trainingCaseReviews";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { caseId } = await ctx.params;
  const supabase = await createSupabaseAuthServerClient();
  try {
    const reviews = await fetchTrainingCaseReviewsForCase(supabase, caseId);
    return NextResponse.json({ ok: true, reviews });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function POST(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const access = await requireAcademyStaff();
    const { caseId } = await ctx.params;
    const supabase = await createSupabaseAuthServerClient();

    const { data: c, error: cErr } = await supabase
      .from("training_cases")
      .select("id, training_doctor_id, surgery_date, procedure_type")
      .eq("id", caseId)
      .maybeSingle();
    if (cErr || !c) return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });

    const { data: doctor } = await supabase
      .from("training_doctors")
      .select("id, program_id, current_stage")
      .eq("id", c.training_doctor_id)
      .maybeSingle();

    const { data: cohortLink } = await supabase
      .from("training_cohort_trainees")
      .select("cohort_id")
      .eq("training_doctor_id", c.training_doctor_id)
      .limit(1)
      .maybeSingle();

    const review = await createDraftTrainingCaseReview(supabase, {
      trainingCaseId: caseId,
      traineeId: c.training_doctor_id,
      reviewerId: access.userId,
      programId: doctor?.program_id ?? null,
      cohortId: cohortLink?.cohort_id ?? null,
      caseDate: c.surgery_date,
      caseType: c.procedure_type,
      traineeStage: doctor?.current_stage ?? null,
    });

    return NextResponse.json({ ok: true, review });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Forbidden";
    const status = msg === "staff_only" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
