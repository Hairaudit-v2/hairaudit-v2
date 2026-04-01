import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { requireAcademyStaff } from "@/lib/academy/auth";
import type { PerformanceDemonstration } from "@/lib/academy/types";

export const runtime = "nodejs";

type PatchBody = Partial<{
  trainerComments: string | null;
  performanceDemonstration: PerformanceDemonstration;
  evidenceTrainingCaseId: string | null;
  capture: Record<string, unknown>;
  singleSessionOverride: boolean;
}>;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; achievementId: string }> }
) {
  try {
    await requireAcademyStaff();
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id: trainingDoctorId, achievementId } = await ctx.params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createSupabaseAuthServerClient();
  const { data: row, error: fetchErr } = await supabase
    .from("training_competency_achievements")
    .select("*")
    .eq("id", achievementId)
    .eq("training_doctor_id", trainingDoctorId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (body.trainerComments !== undefined) patch.trainer_comments = body.trainerComments?.trim() || null;
  if (body.performanceDemonstration !== undefined) {
    const d = body.performanceDemonstration;
    if (d === "single_session_peak" || d === "repeatable_across_sessions" || d === "not_specified") {
      patch.performance_demonstration = d;
    }
  }
  if (body.evidenceTrainingCaseId !== undefined) {
    let cid = body.evidenceTrainingCaseId ? String(body.evidenceTrainingCaseId).trim() : null;
    if (cid === "") cid = null;
    if (cid) {
      const { data: tc, error: tcErr } = await supabase
        .from("training_cases")
        .select("id, training_doctor_id")
        .eq("id", cid)
        .maybeSingle();
      if (tcErr || !tc || tc.training_doctor_id !== trainingDoctorId) {
        return NextResponse.json({ ok: false, error: "Evidence case invalid for this trainee" }, { status: 400 });
      }
    }
    patch.evidence_training_case_id = cid;
  }
  if (body.capture !== undefined && body.capture && typeof body.capture === "object") {
    patch.capture_json = { ...(row.capture_json as object), ...body.capture };
  }
  if (body.singleSessionOverride !== undefined) {
    patch.single_session_override = Boolean(body.singleSessionOverride);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, achievement: row });
  }

  const { data: updated, error: upErr } = await supabase
    .from("training_competency_achievements")
    .update(patch)
    .eq("id", achievementId)
    .select("*")
    .maybeSingle();

  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, achievement: updated });
}
