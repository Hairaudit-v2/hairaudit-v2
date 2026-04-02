import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess, requireAcademyStaff } from "@/lib/academy/auth";
import { DEFAULT_TRAINING_PROGRAM_ID } from "@/lib/academy/constants";
import {
  isAllowedTraineeStatus,
  parseTraineeListStatusFilter,
  statusesForListFilter,
} from "@/lib/academy/traineeStatus";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!access.isStaff) {
    return NextResponse.json({ ok: false, error: "Staff only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const filter = parseTraineeListStatusFilter(url.searchParams.get("status"));
  const statuses = statusesForListFilter(filter);

  const supabase = await createSupabaseAuthServerClient();
  let q = supabase.from("training_doctors").select("*").order("created_at", { ascending: false });
  if (statuses !== "all") {
    q = q.in("status", statuses);
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, trainees: data ?? [], filter });
}

type CreateTraineeBody = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  clinic_name?: string | null;
  registration_number?: string | null;
  start_date?: string | null;
  academy_site_id?: string | null;
  assigned_trainer_id?: string | null;
  competency_wave_start_date?: string | null;
  program_id?: string | null;
  current_stage?: string | null;
  status?: string | null;
  notes?: string | null;
  auth_user_id?: string | null;
};

export async function POST(req: Request) {
  try {
    await requireAcademyStaff();
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: CreateTraineeBody;
  try {
    body = (await req.json()) as CreateTraineeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.full_name === "string" ? body.full_name.trim() : "";
  if (!name) {
    return NextResponse.json({ ok: false, error: "full_name is required" }, { status: 400 });
  }

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const programId = body.program_id?.trim() || DEFAULT_TRAINING_PROGRAM_ID;

  const { data, error } = await supabase
    .from("training_doctors")
    .insert({
      full_name: name,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      country: body.country?.trim() || null,
      clinic_name: body.clinic_name?.trim() || null,
      registration_number: body.registration_number?.trim() || null,
      start_date: body.start_date?.trim() || null,
      academy_site_id: body.academy_site_id?.trim() || null,
      assigned_trainer_id: body.assigned_trainer_id?.trim() || null,
      competency_wave_start_date: body.competency_wave_start_date?.trim() || null,
      program_id: programId,
      current_stage: body.current_stage?.trim() || "foundation",
      status: (() => {
        const s = body.status?.trim() || "active";
        return isAllowedTraineeStatus(s) ? s : "active";
      })(),
      notes: body.notes?.trim() || null,
      auth_user_id: body.auth_user_id?.trim() || null,
      created_by: user.id,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, trainee: data });
}
