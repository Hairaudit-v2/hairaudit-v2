import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!access.isStaff) {
    return NextResponse.json({ ok: false, error: "Staff only" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("training_programs")
    .select("id, name, description, academy_site_id, is_active")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, programs: data ?? [] });
}

type CreateProgramBody = {
  name?: string;
  description?: string | null;
  academy_site_id?: string | null;
  is_active?: boolean;
};

export async function POST(req: Request) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  let body: CreateProgramBody;
  try {
    body = (await req.json()) as CreateProgramBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  }

  const academy_site_id =
    body.academy_site_id === null || body.academy_site_id === ""
      ? null
      : String(body.academy_site_id ?? "").trim() || null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("training_programs")
    .insert({
      name,
      description: body.description != null ? String(body.description).trim() || null : null,
      academy_site_id,
      is_active: body.is_active !== false,
    })
    .select("id, name, description, academy_site_id, is_active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, program: data });
}
