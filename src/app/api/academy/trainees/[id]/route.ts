import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess, requireAcademyStaff } from "@/lib/academy/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const supabase = await createSupabaseAuthServerClient();
  const { data, error } = await supabase.from("training_doctors").select("*").eq("id", id).maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, trainee: data });
}

type PatchTraineeBody = Partial<{
  full_name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  clinic_name: string | null;
  registration_number: string | null;
  start_date: string | null;
  competency_wave_start_date: string | null;
  competency_final_readiness_status: string | null;
  competency_final_readiness_notes: string | null;
  competency_restrictions_json: Record<string, unknown> | null;
  assigned_trainer_id: string | null;
  academy_site_id: string | null;
  program_id: string | null;
  current_stage: string;
  status: string;
  notes: string | null;
  auth_user_id: string | null;
}>;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAcademyStaff();
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let body: PatchTraineeBody;
  try {
    body = (await req.json()) as PatchTraineeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { ...body };
  if (body.full_name != null) patch.full_name = String(body.full_name).trim();
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  const supabase = await createSupabaseAuthServerClient();
  const { data, error } = await supabase.from("training_doctors").update(patch).eq("id", id).select("*").maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, trainee: data });
}
