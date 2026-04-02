import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { cohortId } = await ctx.params;
  const admin = createSupabaseAdminClient();
  const { data: cohort, error } = await admin.from("training_cohorts").select("*").eq("id", cohortId).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!cohort) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const [{ data: trainers }, { data: trainees }] = await Promise.all([
    admin.from("training_cohort_trainers").select("user_id").eq("cohort_id", cohortId),
    admin.from("training_cohort_trainees").select("training_doctor_id").eq("cohort_id", cohortId),
  ]);

  return NextResponse.json({
    ok: true,
    cohort,
    trainer_user_ids: (trainers ?? []).map((r: { user_id: string }) => r.user_id),
    training_doctor_ids: (trainees ?? []).map((r: { training_doctor_id: string }) => r.training_doctor_id),
  });
}

type PatchBody = {
  name?: string;
  academy_site_id?: string | null;
  program_id?: string | null;
  start_date?: string | null;
  notes?: string | null;
  trainer_user_ids?: string[];
  training_doctor_ids?: string[];
};

export async function PATCH(req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { cohortId } = await ctx.params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.academy_site_id !== undefined) {
    patch.academy_site_id = body.academy_site_id?.trim() || null;
  }
  if (body.program_id !== undefined) patch.program_id = body.program_id?.trim() || null;
  if (body.start_date !== undefined) patch.start_date = body.start_date?.trim() || null;
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from("training_cohorts").update(patch).eq("id", cohortId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (body.trainer_user_ids !== undefined) {
    await admin.from("training_cohort_trainers").delete().eq("cohort_id", cohortId);
    const ids = body.trainer_user_ids.map((x) => String(x).trim()).filter(Boolean);
    if (ids.length) {
      await admin.from("training_cohort_trainers").insert(ids.map((user_id) => ({ cohort_id: cohortId, user_id })));
    }
  }

  if (body.training_doctor_ids !== undefined) {
    await admin.from("training_cohort_trainees").delete().eq("cohort_id", cohortId);
    const ids = body.training_doctor_ids.map((x) => String(x).trim()).filter(Boolean);
    if (ids.length) {
      await admin
        .from("training_cohort_trainees")
        .insert(ids.map((training_doctor_id) => ({ cohort_id: cohortId, training_doctor_id })));
    }
  }

  const { data: cohort } = await admin.from("training_cohorts").select("*").eq("id", cohortId).maybeSingle();
  return NextResponse.json({ ok: true, cohort });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ cohortId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { cohortId } = await ctx.params;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("training_cohorts").delete().eq("id", cohortId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
