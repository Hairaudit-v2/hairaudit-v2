import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import type { AcademyUserRole } from "@/lib/academy/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ROLES: AcademyUserRole[] = ["academy_admin", "trainer", "clinic_staff", "trainee"];

export async function PATCH(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const { userId } = await ctx.params;
  let body: { display_name?: string | null; role?: AcademyUserRole };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.display_name !== undefined) {
    patch.display_name = body.display_name === null ? null : String(body.display_name).trim() || null;
  }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) {
      return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });
    }
    patch.role = body.role;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("academy_users").update(patch).eq("user_id", userId).select("*").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, academy_user: data });
}
