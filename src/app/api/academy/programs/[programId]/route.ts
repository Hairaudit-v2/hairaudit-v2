import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type PatchProgramBody = {
  name?: string;
  description?: string | null;
  academy_site_id?: string | null;
  is_active?: boolean;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ programId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { programId } = await ctx.params;
  let body: PatchProgramBody;
  try {
    body = (await req.json()) as PatchProgramBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.description !== undefined) {
    patch.description = body.description === null ? null : String(body.description).trim() || null;
  }
  if (body.academy_site_id !== undefined) {
    patch.academy_site_id =
      body.academy_site_id === null || body.academy_site_id === ""
        ? null
        : String(body.academy_site_id).trim();
  }
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("training_programs")
    .update(patch)
    .eq("id", programId)
    .select("id, name, description, academy_site_id, is_active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, program: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ programId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { programId } = await ctx.params;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("training_programs").delete().eq("id", programId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
