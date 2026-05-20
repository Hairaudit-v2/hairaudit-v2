import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess, requireAcademyStaff } from "@/lib/academy/auth";
import {
  fetchTrainingCaseReviewBundle,
  submitTrainingCaseReview,
  updateTrainingCaseReviewDraft,
} from "@/lib/academy/trainingCaseReviews";
import type { TrainingCaseReviewUpsertBody } from "@/lib/academy/trainingCaseReviews";
import { parseStringList } from "@/lib/academy/trainingCaseReviews";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ reviewId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { reviewId } = await ctx.params;
  const supabase = await createSupabaseAuthServerClient();
  try {
    const bundle = await fetchTrainingCaseReviewBundle(supabase, reviewId);
    if (!bundle) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, ...bundle });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

function normalizeBody(raw: TrainingCaseReviewUpsertBody): TrainingCaseReviewUpsertBody {
  return {
    ...raw,
    main_strengths: raw.main_strengths != null ? parseStringList(raw.main_strengths) : undefined,
    improvement_priorities:
      raw.improvement_priorities != null ? parseStringList(raw.improvement_priorities) : undefined,
  };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ reviewId: string }> }) {
  try {
    await requireAcademyStaff();
    const { reviewId } = await ctx.params;
    let body: TrainingCaseReviewUpsertBody;
    try {
      body = normalizeBody((await req.json()) as TrainingCaseReviewUpsertBody);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const supabase = await createSupabaseAuthServerClient();
    const review = await updateTrainingCaseReviewDraft(supabase, reviewId, body);
    return NextResponse.json({ ok: true, review });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "staff_only" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ reviewId: string }> }) {
  try {
    await requireAcademyStaff();
    const { reviewId } = await ctx.params;
    let action = "submit";
    try {
      const j = (await req.json()) as { action?: string };
      if (j.action) action = j.action;
    } catch {
      /* default submit */
    }

    const supabase = await createSupabaseAuthServerClient();
    if (action === "submit") {
      const review = await submitTrainingCaseReview(supabase, reviewId);
      return NextResponse.json({ ok: true, review });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "staff_only" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
