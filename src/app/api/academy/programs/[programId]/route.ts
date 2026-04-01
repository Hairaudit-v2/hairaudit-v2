import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ programId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { programId } = await ctx.params;
  let body: { academy_site_id?: string | null };
  try {
    body = (await req.json()) as { academy_site_id?: string | null };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!("academy_site_id" in body)) {
    return NextResponse.json({ ok: false, error: "academy_site_id is required" }, { status: 400 });
  }

  const academy_site_id =
    body.academy_site_id === null || body.academy_site_id === ""
      ? null
      : String(body.academy_site_id).trim();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("training_programs")
    .update({ academy_site_id })
    .eq("id", programId)
    .select("id, name, academy_site_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, program: data });
}
