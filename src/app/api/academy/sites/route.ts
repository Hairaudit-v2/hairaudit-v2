import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listAcademySites } from "@/lib/academy/academySites";

export const runtime = "nodejs";

export async function GET() {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const sites = await listAcademySites(admin);
  return NextResponse.json({ ok: true, sites });
}

type CreateBody = {
  name?: string;
  slug?: string;
  display_name?: string | null;
  ops_notification_email?: string | null;
  general_contact_email?: string | null;
  phone?: string | null;
  country?: string | null;
  timezone?: string | null;
  is_active?: boolean;
  notes?: string | null;
};

export async function POST(req: Request) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const slug = String(body.slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!name || !slug) {
    return NextResponse.json({ ok: false, error: "name and slug are required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("academy_sites")
    .insert({
      name,
      slug,
      display_name: body.display_name?.trim() || null,
      ops_notification_email: body.ops_notification_email?.trim() || null,
      general_contact_email: body.general_contact_email?.trim() || null,
      phone: body.phone?.trim() || null,
      country: body.country?.trim() || null,
      timezone: body.timezone?.trim() || null,
      is_active: body.is_active !== false,
      notes: body.notes?.trim() || null,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, site: data });
}
