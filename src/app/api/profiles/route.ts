import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { parseRole } from "@/lib/roles";
import { isSupportedLocale, normalizeLocale } from "@/lib/i18n/constants";
import { resolveProfileUpsertRole } from "@/lib/security/profileRolePolicy";
import {
  readHaAllowStandaloneClinicSignup,
  readHaAllowStandaloneDoctorSignup,
} from "@/lib/nexus/haAccessPolicy.server";

// GET — fetch current user's profile (role)
export async function GET() {
  const auth = await createSupabaseAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, name, preferred_language")
    .eq("id", user.id)
    .maybeSingle();

  const role = isAuditor({ profileRole: profile?.role, userEmail: user.email })
    ? "auditor"
    : parseRole(profile?.role);

  return NextResponse.json({
    role,
    displayName: profile?.name ?? user.email?.split("@")[0],
    email: user.email,
    preferred_language: normalizeLocale(
      typeof (profile as { preferred_language?: string } | null)?.preferred_language === "string"
        ? (profile as { preferred_language: string }).preferred_language
        : undefined
    ),
  });
}

/** PATCH — update lightweight profile preferences (e.g. UI locale). */
export async function PATCH(req: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const raw = body?.preferred_language;
  if (typeof raw !== "string" || !isSupportedLocale(raw)) {
    return NextResponse.json({ error: "Invalid preferred_language" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ preferred_language: raw, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, preferred_language: raw });
}

// POST — initialize/update current user's beta profile (patient by default, auditor by allowlist)
export async function POST(req: Request) {
  const auth = await createSupabaseAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const requestedRole = body?.role;

  const requestedParsed = parseRole(requestedRole);
  if (requestedParsed === "doctor" && !readHaAllowStandaloneDoctorSignup()) {
    return NextResponse.json({ error: "Standalone doctor signup is not available." }, { status: 403 });
  }
  if (requestedParsed === "clinic" && !readHaAllowStandaloneClinicSignup()) {
    return NextResponse.json({ error: "Standalone clinic signup is not available." }, { status: 403 });
  }

  const name =
    typeof body?.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : (
          (user.user_metadata as Record<string, unknown> | undefined)?.full_name ??
          (user.user_metadata as Record<string, unknown> | undefined)?.name ??
          null
        );

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const roleDecision = resolveProfileUpsertRole({
    existingProfileRole: profile?.role,
    requestedRole,
    userEmail: user.email,
    userMetadataRole: (user.user_metadata as Record<string, unknown> | undefined)?.role,
  });
  if (!roleDecision.ok) {
    const message =
      roleDecision.reason === "invalid_signup_role"
        ? "Doctor/clinic roles must match signup intent"
        : "Role elevation to doctor/clinic is not permitted";
    return NextResponse.json({ error: message }, { status: 403 });
  }
  const role = roleDecision.role;
  const { error } = await admin.from("profiles").upsert(
    {
      id: user.id,
      role,
      email: user.email,
      name,
    },
    { onConflict: "id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, role });
}
