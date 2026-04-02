import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAcademyAccess, requireAcademyStaff } from "@/lib/academy/auth";
import { isAllowedTraineeStatus } from "@/lib/academy/traineeStatus";

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
  if (body.status != null) {
    const s = String(body.status).trim();
    if (!isAllowedTraineeStatus(s)) {
      return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
    }
    patch.status = s;
  }
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

type DeleteTraineeBody = {
  confirmation?: string;
};

async function countForDoctor(admin: ReturnType<typeof createSupabaseAdminClient>, doctorId: string) {
  const tables = [
    { key: "cases", table: "training_cases", col: "training_doctor_id" as const },
    { key: "competencyAchievements", table: "training_competency_achievements", col: "training_doctor_id" as const },
    { key: "weeklyReviews", table: "training_competency_weekly_reviews", col: "training_doctor_id" as const },
    { key: "stepObservations", table: "training_competency_step_observations", col: "training_doctor_id" as const },
    { key: "stepStates", table: "training_competency_step_states", col: "training_doctor_id" as const },
    { key: "stageHistory", table: "training_stage_history", col: "training_doctor_id" as const },
    { key: "cohortMemberships", table: "training_cohort_trainees", col: "training_doctor_id" as const },
  ] as const;

  const results = await Promise.all(
    tables.map(async ({ key, table, col }) => {
      const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq(col, doctorId);
      if (error) throw new Error(`${key}: ${error.message}`);
      return [key, count ?? 0] as const;
    })
  );

  return Object.fromEntries(results) as Record<(typeof tables)[number]["key"], number>;
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let body: DeleteTraineeBody = {};
  try {
    body = (await req.json()) as DeleteTraineeBody;
  } catch {
    /* empty body */
  }
  const confirmation = String(body.confirmation ?? "").trim();

  const admin = createSupabaseAdminClient();
  const { data: doc, error: loadErr } = await admin.from("training_doctors").select("id, full_name").eq("id", id).maybeSingle();
  if (loadErr) {
    return NextResponse.json({ ok: false, error: loadErr.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  if (confirmation !== doc.full_name.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Confirmation does not match this trainee’s full name. Type it exactly to proceed.",
      },
      { status: 400 }
    );
  }

  let counts: Awaited<ReturnType<typeof countForDoctor>>;
  try {
    counts = await countForDoctor(admin, id);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Could not verify dependencies" },
      { status: 500 }
    );
  }

  const blockingTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  if (blockingTotal > 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This trainee has linked training data or cohort membership. Hard delete is blocked to protect history. Use Withdraw or Archive to remove them from active lists, or merge/correct fields on this profile instead of creating another row.",
        counts,
        hint: "Archive keeps all cases, competency, reviews, and assignments visible to admins when filtered.",
      },
      { status: 409 }
    );
  }

  const { error: delErr } = await admin.from("training_doctors").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deletedId: id });
}
