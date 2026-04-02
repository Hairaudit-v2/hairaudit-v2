import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type PatchTraineeBody = Partial<{
  training_doctor_id: string;
  full_name: string;
  email: string | null;
  program_id: string | null;
  academy_site_id: string | null;
  assigned_trainer_id: string | null;
  competency_wave_start_date: string | null;
  start_date: string | null;
  current_stage: string;
  status: string;
  notes: string | null;
}>;

export async function PATCH(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { userId } = await ctx.params;
  let body: PatchTraineeBody;
  try {
    body = (await req.json()) as PatchTraineeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const doctorId = String(body.training_doctor_id ?? "").trim();
  if (!doctorId) {
    return NextResponse.json({ ok: false, error: "training_doctor_id is required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: doc, error: dErr } = await admin.from("training_doctors").select("id, auth_user_id").eq("id", doctorId).maybeSingle();
  if (dErr || !doc) return NextResponse.json({ ok: false, error: "Trainee profile not found" }, { status: 404 });
  if ((doc as { auth_user_id: string | null }).auth_user_id !== userId) {
    return NextResponse.json({ ok: false, error: "training_doctor does not belong to this user" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.full_name !== undefined) patch.full_name = String(body.full_name).trim();
  if (body.email !== undefined) patch.email = body.email?.trim() || null;
  if (body.program_id !== undefined) patch.program_id = body.program_id?.trim() || null;
  if (body.academy_site_id !== undefined) patch.academy_site_id = body.academy_site_id?.trim() || null;
  if (body.assigned_trainer_id !== undefined) patch.assigned_trainer_id = body.assigned_trainer_id?.trim() || null;
  if (body.competency_wave_start_date !== undefined) {
    patch.competency_wave_start_date = body.competency_wave_start_date?.trim() || null;
  }
  if (body.start_date !== undefined) patch.start_date = body.start_date?.trim() || null;
  if (body.current_stage !== undefined) patch.current_stage = String(body.current_stage).trim();
  if (body.status !== undefined) patch.status = String(body.status).trim();
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields" }, { status: 400 });
  }

  const { data, error } = await admin.from("training_doctors").update(patch).eq("id", doctorId).select("*").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, trainee: data });
}
