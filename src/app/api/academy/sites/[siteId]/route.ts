import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAcademySiteById } from "@/lib/academy/academySites";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ siteId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { siteId } = await ctx.params;
  const admin = createSupabaseAdminClient();
  const site = await getAcademySiteById(admin, siteId);
  if (!site) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, site });
}

type PatchBody = Partial<{
  name: string;
  slug: string;
  display_name: string | null;
  ops_notification_email: string | null;
  general_contact_email: string | null;
  phone: string | null;
  country: string | null;
  timezone: string | null;
  is_active: boolean;
  notes: string | null;
}>;

export async function PATCH(req: Request, ctx: { params: Promise<{ siteId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { siteId } = await ctx.params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.slug !== undefined) {
    patch.slug = String(body.slug)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
  if (body.display_name !== undefined) patch.display_name = body.display_name?.trim() || null;
  if (body.ops_notification_email !== undefined) patch.ops_notification_email = body.ops_notification_email?.trim() || null;
  if (body.general_contact_email !== undefined) {
    patch.general_contact_email = body.general_contact_email?.trim() || null;
  }
  if (body.phone !== undefined) patch.phone = body.phone?.trim() || null;
  if (body.country !== undefined) patch.country = body.country?.trim() || null;
  if (body.timezone !== undefined) patch.timezone = body.timezone?.trim() || null;
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("academy_sites").update(patch).eq("id", siteId).select("*").maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, site: data });
}
