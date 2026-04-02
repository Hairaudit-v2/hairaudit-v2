import { NextResponse } from "next/server";
import { getAcademyAccess } from "@/lib/academy/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { provisionAcademyMember, type ProvisionAcademyRole } from "@/lib/academy/provisionMembers";

export const runtime = "nodejs";

export async function GET() {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: academyRows, error: aErr } = await admin.from("academy_users").select("*").order("display_name", { ascending: true });
  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });

  const userIds = (academyRows ?? []).map((r: { user_id: string }) => r.user_id);
  let profiles: { id: string; email: string | null; name: string | null; role: string | null }[] = [];
  if (userIds.length) {
    const { data: p } = await admin.from("profiles").select("id, email, name, role").in("id", userIds);
    profiles = (p ?? []) as typeof profiles;
  }
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const { data: doctors } = await admin
    .from("training_doctors")
    .select("id, auth_user_id, full_name, program_id, academy_site_id, assigned_trainer_id")
    .not("auth_user_id", "is", null);

  type DocRow = {
    id: string;
    auth_user_id: string;
    full_name: string;
    program_id: string | null;
    academy_site_id: string | null;
    assigned_trainer_id: string | null;
  };

  const doctorsByAuth = new Map<string, DocRow[]>();
  for (const d of (doctors ?? []) as DocRow[]) {
    if (!d.auth_user_id) continue;
    const list = doctorsByAuth.get(d.auth_user_id) ?? [];
    list.push(d);
    doctorsByAuth.set(d.auth_user_id, list);
  }

  const people = (academyRows ?? []).map((au: { user_id: string; role: string; display_name: string | null }) => {
    const p = profileById.get(au.user_id);
    const tdList = doctorsByAuth.get(au.user_id) ?? [];
    return {
      user_id: au.user_id,
      academy_role: au.role,
      display_name: au.display_name,
      email: p?.email ?? null,
      profile_name: p?.name ?? null,
      profile_role: p?.role ?? null,
      trainee_profiles: tdList.map((td) => ({
        id: td.id,
        full_name: td.full_name,
        program_id: td.program_id,
        academy_site_id: td.academy_site_id,
        assigned_trainer_id: td.assigned_trainer_id,
      })),
    };
  });

  const { data: unlinkedTrainees } = await admin
    .from("training_doctors")
    .select("id, full_name, email, program_id, academy_site_id, assigned_trainer_id, auth_user_id")
    .is("auth_user_id", null)
    .order("full_name", { ascending: true });

  return NextResponse.json({ ok: true, people, unlinked_trainees: unlinkedTrainees ?? [] });
}

const INVITE_ROLES: Set<string> = new Set(["trainer", "clinic_staff", "trainee"]);

export async function POST(req: Request) {
  const access = await getAcademyAccess();
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "academy_admin") {
    return NextResponse.json({ ok: false, error: "Academy admin only" }, { status: 403 });
  }

  let body: { email?: string; academy_role?: string; display_name?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const academy_role = String(body.academy_role ?? "").trim() as ProvisionAcademyRole;
  if (!email || !INVITE_ROLES.has(academy_role)) {
    return NextResponse.json({ ok: false, error: "email and valid academy_role required" }, { status: 400 });
  }

  const result = await provisionAcademyMember({
    email,
    academyRole: academy_role,
    displayName: body.display_name != null ? String(body.display_name).trim() : null,
    invitedByUserId: access.userId,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Provision failed", result }, { status: 400 });
  }
  return NextResponse.json({ ok: true, result });
}
