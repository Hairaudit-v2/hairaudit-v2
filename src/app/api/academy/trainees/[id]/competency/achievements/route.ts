import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { requireAcademyStaff } from "@/lib/academy/auth";
import { isStepUnlockedForSignoff } from "@/lib/academy/competency";
import { evaluateRepeatability } from "@/lib/academy/competencyPhase2";
import type { PerformanceDemonstration, TrainingCompetencyStepObservationRow, TrainingCompetencyStepRow } from "@/lib/academy/types";

export const runtime = "nodejs";

type CapturePayload = {
  session_date?: string | null;
  extraction_graft_count?: number | null;
  implantation_graft_count?: number | null;
  total_hairs?: number | null;
  total_grafts?: number | null;
  extraction_duration_minutes?: number | null;
  implantation_duration_minutes?: number | null;
  punch_size?: string | null;
  observed_by_trainer?: boolean | null;
};

type PostBody = {
  stepId: string;
  evidenceTrainingCaseId?: string | null;
  trainerComments?: string | null;
  performanceDemonstration?: PerformanceDemonstration;
  capture?: CapturePayload;
  /** Target steps only: explicit override when repeatability mins not met */
  singleSessionOverride?: boolean;
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

  const demo: PerformanceDemonstration =
    body.performanceDemonstration === "single_session_peak" ||
    body.performanceDemonstration === "repeatable_across_sessions"
      ? body.performanceDemonstration
      : "not_specified";

  const supabase = await createSupabaseAuthServerClient();

  const { data: stepRow, error: stepErr } = await supabase
    .from("training_competency_steps")
    .select("*")
    .eq("id", stepId)
    .maybeSingle();

  if (stepErr || !stepRow) {
    return NextResponse.json({ ok: false, error: "Step not found" }, { status: 404 });
  }
  const step = stepRow as TrainingCompetencyStepRow;

  const { data: ladderStepsRaw, error: lsErr } = await supabase
    .from("training_competency_steps")
    .select("*")
    .eq("ladder_id", step.ladder_id)
    .order("step_index", { ascending: true });

  if (lsErr || !ladderStepsRaw?.length) {
    return NextResponse.json({ ok: false, error: "Ladder steps missing" }, { status: 500 });
  }
  const ladderSteps = ladderStepsRaw as TrainingCompetencyStepRow[];

  const { data: existingAch, error: achErr } = await supabase
    .from("training_competency_achievements")
    .select("step_id")
    .eq("training_doctor_id", trainingDoctorId);

  if (achErr) {
    return NextResponse.json({ ok: false, error: achErr.message }, { status: 500 });
  }

  const achieved = new Set((existingAch ?? []).map((r) => r.step_id as string));
  if (achieved.has(stepId)) {
    return NextResponse.json({ ok: false, error: "This step is already signed off. Use PATCH to update." }, { status: 409 });
  }

  if (!isStepUnlockedForSignoff(ladderSteps, achieved, stepId)) {
    return NextResponse.json(
      { ok: false, error: "Earlier mandatory milestones must be signed off before this step." },
      { status: 400 }
    );
  }

  const { data: obsRows, error: obsErr } = await supabase
    .from("training_competency_step_observations")
    .select("*")
    .eq("training_doctor_id", trainingDoctorId)
    .eq("step_id", stepId);

  if (obsErr) {
    return NextResponse.json({ ok: false, error: obsErr.message }, { status: 500 });
  }

  const observations = (obsRows ?? []) as TrainingCompetencyStepObservationRow[];
  const rep = evaluateRepeatability(step, observations);
  const singleOverride = Boolean(body.singleSessionOverride) && step.is_target;
  if (!rep.satisfied && !singleOverride) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Repeatability requirements not met for this step. Log signed observations on distinct cases, or for target steps only use explicit single-session override.",
        repeatability: rep,
      },
      { status: 400 }
    );
  }

  let evidenceTrainingCaseId = body.evidenceTrainingCaseId ? String(body.evidenceTrainingCaseId).trim() : null;
  if (evidenceTrainingCaseId === "") evidenceTrainingCaseId = null;

  if (evidenceTrainingCaseId) {
    const { data: tc, error: tcErr } = await supabase
      .from("training_cases")
      .select("id, training_doctor_id, surgery_date")
      .eq("id", evidenceTrainingCaseId)
      .maybeSingle();
    if (tcErr || !tc || tc.training_doctor_id !== trainingDoctorId) {
      return NextResponse.json({ ok: false, error: "Evidence case invalid for this trainee" }, { status: 400 });
    }
  }

  const captureJson: Record<string, unknown> = {};
  if (evidenceTrainingCaseId) {
    const { data: metrics } = await supabase
      .from("training_case_metrics")
      .select("*")
      .eq("training_case_id", evidenceTrainingCaseId)
      .maybeSingle();
    const { data: tc } = await supabase
      .from("training_cases")
      .select("surgery_date")
      .eq("id", evidenceTrainingCaseId)
      .maybeSingle();
    if (tc?.surgery_date) captureJson.session_date = tc.surgery_date;
    if (metrics) {
      captureJson.case_metrics_snapshot = {
        grafts_extracted: metrics.grafts_extracted,
        grafts_implanted: metrics.grafts_implanted,
        total_hairs: metrics.total_hairs,
        extraction_minutes: metrics.extraction_minutes,
        implantation_minutes: metrics.implantation_minutes,
        punch_size: metrics.punch_size,
        extraction_grafts_per_hour: metrics.extraction_grafts_per_hour,
        implantation_grafts_per_hour: metrics.implantation_grafts_per_hour,
        hair_to_graft_ratio: metrics.hair_to_graft_ratio,
        observed_by_trainer: metrics.observed_by_trainer,
      };
    }
  }
  const manual = body.capture && typeof body.capture === "object" ? (body.capture as Record<string, unknown>) : {};
  Object.assign(captureJson, manual);

  const { data: inserted, error: insErr } = await supabase
    .from("training_competency_achievements")
    .insert({
      training_doctor_id: trainingDoctorId,
      step_id: stepId,
      signed_off_by: access.userId,
      trainer_comments: body.trainerComments?.trim() || null,
      evidence_training_case_id: evidenceTrainingCaseId,
      performance_demonstration: demo,
      capture_json: captureJson,
      single_session_override: singleOverride,
    })
    .select("*")
    .maybeSingle();

  if (insErr) {
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  if (inserted?.id) {
    const { error: stErr } = await supabase.from("training_competency_step_states").upsert(
      {
        training_doctor_id: trainingDoctorId,
        step_id: stepId,
        status: "signed_off",
        achievement_id: inserted.id,
        updated_by: access.userId,
        trainer_notes: null,
      },
      { onConflict: "training_doctor_id,step_id" }
    );
    if (stErr) {
      return NextResponse.json({ ok: false, error: stErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, achievement: inserted });
}
