import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { requireAcademyStaff } from "@/lib/academy/auth";

export const runtime = "nodejs";

type PostBody = {
  stepId: string;
  trainingCaseId?: string | null;
  thresholdMet?: boolean;
  trainerObserved?: boolean;
  checklistJson?: Record<string, unknown>;
  notes?: string | null;
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

  const stepId = String(body.stepId || "").trim();
  if (!stepId) {
    return NextResponse.json({ ok: false, error: "stepId required" }, { status: 400 });
  }

  let trainingCaseId = body.trainingCaseId ? String(body.trainingCaseId).trim() : null;
  if (trainingCaseId === "") trainingCaseId = null;

  const supabase = await createSupabaseAuthServerClient();

  if (trainingCaseId) {
    const { data: tc, error: tcErr } = await supabase
      .from("training_cases")
      .select("id, training_doctor_id")
      .eq("id", trainingCaseId)
      .maybeSingle();
    if (tcErr || !tc || tc.training_doctor_id !== trainingDoctorId) {
      return NextResponse.json({ ok: false, error: "Case invalid for this trainee" }, { status: 400 });
    }
  }

  const { data: inserted, error } = await supabase
    .from("training_competency_step_observations")
    .insert({
      training_doctor_id: trainingDoctorId,
      step_id: stepId,
      training_case_id: trainingCaseId,
      recorded_by: access.userId,
      threshold_met: body.thresholdMet !== false,
      trainer_observed: Boolean(body.trainerObserved),
      checklist_json: body.checklistJson && typeof body.checklistJson === "object" ? body.checklistJson : {},
      notes: body.notes?.trim() || null,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, observation: inserted });
}
