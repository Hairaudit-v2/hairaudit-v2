import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { requireAcademyStaff } from "@/lib/academy/auth";
import { ACADEMY_SCORING_DOMAINS } from "@/lib/academy/constants";

export const runtime = "nodejs";

type ReviewBody = {
  stage_at_assessment: string;
  domain_scores_json?: Record<string, number | string>;
  strengths?: string | null;
  weaknesses?: string | null;
  corrective_actions?: string | null;
  ready_to_progress?: boolean;
  trainer_confidence?: number | null;
  overall_score?: number | null;
  signed_off_at?: string | null;
};

function sanitizeDomains(raw: Record<string, number | string> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of ACADEMY_SCORING_DOMAINS) {
    const v = raw[key];
    if (v == null) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) continue;
    out[key] = Math.round(n * 10) / 10;
  }
  return out;
}

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    await requireAcademyStaff();
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { caseId } = await ctx.params;
  let body: ReviewBody;
  try {
    body = (await req.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const stage = typeof body.stage_at_assessment === "string" ? body.stage_at_assessment.trim() : "";
  if (!stage) {
    return NextResponse.json({ ok: false, error: "stage_at_assessment is required" }, { status: 400 });
  }

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const domain_scores_json = sanitizeDomains(body.domain_scores_json);

  const { data, error } = await supabase
    .from("training_case_assessments")
    .insert({
      training_case_id: caseId,
      trainer_id: user.id,
      stage_at_assessment: stage,
      domain_scores_json,
      strengths: body.strengths?.trim() || null,
      weaknesses: body.weaknesses?.trim() || null,
      corrective_actions: body.corrective_actions?.trim() || null,
      ready_to_progress: Boolean(body.ready_to_progress),
      trainer_confidence: body.trainer_confidence ?? null,
      overall_score: body.overall_score ?? null,
      signed_off_at: body.signed_off_at?.trim() || null,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, assessment: data });
}
