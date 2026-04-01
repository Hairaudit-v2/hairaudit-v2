import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { requireAcademyStaff } from "@/lib/academy/auth";
import type { TrainingCompetencyStepRow } from "@/lib/academy/types";

export const runtime = "nodejs";

const ALLOWED = new Set([
  "not_started",
  "in_progress",
  "threshold_reached",
  "awaiting_signoff",
  "needs_repeat",
  "regressed",
  "waived_optional",
]);

type PutBody = {
  status: string;
  trainerNotes?: string | null;
};

export async function PUT(req: Request, ctx: { params: Promise<{ id: string; stepId: string }> }) {
  let access;
  try {
    access = await requireAcademyStaff();
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id: trainingDoctorId, stepId } = await ctx.params;
  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const status = String(body.status || "").trim();
  if (!ALLOWED.has(status)) {
    return NextResponse.json(
      { ok: false, error: "Invalid status. Use trainer observation flow and sign-off for signed_off." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseAuthServerClient();

  const { data: step, error: sErr } = await supabase.from("training_competency_steps").select("*").eq("id", stepId).maybeSingle();
  if (sErr || !step) {
    return NextResponse.json({ ok: false, error: "Step not found" }, { status: 404 });
  }
  const st = step as TrainingCompetencyStepRow;
  if (status === "waived_optional" && !st.is_optional) {
    return NextResponse.json({ ok: false, error: "waived_optional only for optional steps" }, { status: 400 });
  }

  const { data: ach } = await supabase
    .from("training_competency_achievements")
    .select("id")
    .eq("training_doctor_id", trainingDoctorId)
    .eq("step_id", stepId)
    .maybeSingle();
  if (ach?.id) {
    return NextResponse.json({ ok: false, error: "Step already signed off — clear achievement via admin if needed." }, { status: 409 });
  }

  const { data: row, error } = await supabase
    .from("training_competency_step_states")
    .upsert(
      {
        training_doctor_id: trainingDoctorId,
        step_id: stepId,
        status,
        achievement_id: null,
        trainer_notes: body.trainerNotes?.trim() || null,
        updated_by: access.userId,
      },
      { onConflict: "training_doctor_id,step_id" }
    )
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, state: row });
}
