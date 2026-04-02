import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: cohorts, error } = await admin
    .from("training_cohorts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const ids = (cohorts ?? []).map((c: { id: string }) => c.id);
  if (!ids.length) return NextResponse.json({ ok: true, cohorts: [] });

  const [{ data: trainers }, { data: trainees }] = await Promise.all([
    admin.from("training_cohort_trainers").select("cohort_id, user_id").in("cohort_id", ids),
    admin.from("training_cohort_trainees").select("cohort_id, training_doctor_id").in("cohort_id", ids),
  ]);

  return NextResponse.json({
    ok: true,
    cohorts: cohorts ?? [],
    trainers: trainers ?? [],
    trainees: trainees ?? [],
  });
}

type CohortBody = {
  name?: string;
  academy_site_id?: string | null;
  program_id?: string | null;
  start_date?: string | null;
  notes?: string | null;
  trainer_user_ids?: string[];
  training_doctor_ids?: string[];
};

export async function POST(req: Request) {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  let body: CohortBody;
  try {
    body = (await req.json()) as CohortBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: cohort, error: cErr } = await admin
    .from("training_cohorts")
    .insert({
      name,
      academy_site_id: body.academy_site_id?.trim() || null,
      program_id: body.program_id?.trim() || null,
      start_date: body.start_date?.trim() || null,
      notes: body.notes?.trim() || null,
      created_by: access.userId,
    })
    .select("*")
    .maybeSingle();

  if (cErr || !cohort) {
    return NextResponse.json({ ok: false, error: cErr?.message ?? "Insert failed" }, { status: 500 });
  }

  const cid = cohort.id as string;
  const trainerIds = Array.isArray(body.trainer_user_ids) ? body.trainer_user_ids.map((x) => String(x).trim()).filter(Boolean) : [];
  const doctorIds = Array.isArray(body.training_doctor_ids)
    ? body.training_doctor_ids.map((x) => String(x).trim()).filter(Boolean)
    : [];

  if (trainerIds.length) {
    await admin.from("training_cohort_trainers").insert(trainerIds.map((user_id) => ({ cohort_id: cid, user_id })));
  }
  if (doctorIds.length) {
    await admin
      .from("training_cohort_trainees")
      .insert(doctorIds.map((training_doctor_id) => ({ cohort_id: cid, training_doctor_id })));
  }

  return NextResponse.json({ ok: true, cohort });
}
