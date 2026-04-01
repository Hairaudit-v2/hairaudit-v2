import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { requireAcademyStaff } from "@/lib/academy/auth";

export const runtime = "nodejs";

const READINESS_STATUSES = new Set([
  "ready",
  "ready_with_limitations",
  "extended_training_required",
  "not_ready",
]);

type PostBody = {
  clear?: boolean;
  status?: string | null;
  notes?: string | null;
  restrictions?: Record<string, unknown> | null;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let access;
  try {
    access = await requireAcademyStaff();
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id: trainingDoctorId } = await ctx.params;
  let body: PostBody = {};
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = (await req.json()) as PostBody;
    }
  } catch {
    body = {};
  }

  const supabase = await createSupabaseAuthServerClient();

  if (body.clear) {
    const { data, error } = await supabase
      .from("training_doctors")
      .update({
        competency_final_readiness_at: null,
        competency_final_readiness_by: null,
        competency_final_readiness_status: null,
        competency_final_readiness_notes: null,
        competency_restrictions_json: {},
      })
      .eq("id", trainingDoctorId)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, trainee: data });
  }

  const st = body.status != null && body.status !== "" ? String(body.status).trim() : null;
  if (st && !READINESS_STATUSES.has(st)) {
    return NextResponse.json({ ok: false, error: "Invalid readiness status" }, { status: 400 });
  }

  const restrictions =
    body.restrictions && typeof body.restrictions === "object" ? body.restrictions : undefined;

  const patch: Record<string, unknown> = {
    competency_final_readiness_at: new Date().toISOString(),
    competency_final_readiness_by: access.userId,
    competency_final_readiness_status: st,
    competency_final_readiness_notes: body.notes?.trim() || null,
  };
  if (restrictions !== undefined) {
    patch.competency_restrictions_json = restrictions;
  }

  const { data, error } = await supabase
    .from("training_doctors")
    .update(patch)
    .eq("id", trainingDoctorId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, trainee: data });
}
