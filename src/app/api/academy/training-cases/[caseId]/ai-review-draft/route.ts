import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { requireAcademyStaff } from "@/lib/academy/auth";
import { isActiveTrainingCase } from "@/lib/academy/trainingCases";
import {
  generateTrainingCaseAiReviewDraft,
  getLatestTrainingCaseAiReviewDraft,
  listTrainingCaseAiReviewDrafts,
  mapAiDraftToReviewSectionSuggestions,
} from "@/lib/academy/trainingCaseReviews/aiDrafts";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    await requireAcademyStaff();
    const { caseId } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const reviewId = searchParams.get("reviewId");
    const latestOnly = searchParams.get("latest") === "1";

    const supabase = await createSupabaseAuthServerClient();
    const { data: c } = await supabase.from("training_cases").select("id, deleted_at, status").eq("id", caseId).maybeSingle();
    if (!c || !isActiveTrainingCase(c)) {
      return NextResponse.json({ ok: false, error: "Case not found" }, { status: 404 });
    }

    if (latestOnly) {
      const draft = await getLatestTrainingCaseAiReviewDraft(supabase, caseId, reviewId);
      const sectionSuggestions =
        draft &&
        draft.status === "completed" &&
        !(draft.structured_feedback as { placeholder?: boolean } | null)?.placeholder
          ? mapAiDraftToReviewSectionSuggestions(draft)
          : [];
      return NextResponse.json({
        ok: true,
        draft,
        sectionSuggestions,
      });
    }

    const drafts = await listTrainingCaseAiReviewDrafts(supabase, caseId, {
      reviewId: reviewId ?? undefined,
      limit: 10,
    });
    return NextResponse.json({ ok: true, drafts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Forbidden";
    const status = msg === "staff_only" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const access = await requireAcademyStaff();
    const { caseId } = await ctx.params;
    const supabase = await createSupabaseAuthServerClient();

    const { data: c, error: cErr } = await supabase
      .from("training_cases")
      .select("id, deleted_at, status")
      .eq("id", caseId)
      .maybeSingle();
    if (cErr || !c || !isActiveTrainingCase(c)) {
      return NextResponse.json({ ok: false, error: "Case not found or not active" }, { status: 404 });
    }

    let reviewId: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.reviewId === "string") reviewId = body.reviewId;
    } catch {
      /* empty body ok */
    }

    const { draft, staffMessage } = await generateTrainingCaseAiReviewDraft(supabase, {
      trainingCaseId: caseId,
      trainingCaseReviewId: reviewId,
      requestedBy: access.userId,
    });

    return NextResponse.json({
      ok: true,
      draft,
      staffMessage,
      sectionSuggestions:
        draft.status === "completed" && !draft.structured_feedback?.placeholder
          ? mapAiDraftToReviewSectionSuggestions(draft)
          : [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "staff_only" ? 403 : msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
