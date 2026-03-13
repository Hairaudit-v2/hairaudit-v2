import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { resolveClinicProfileForUser } from "@/lib/clinicPortal";

export const runtime = "nodejs";

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function defaultCasePermissions(value: unknown) {
  const input = asRecord(value);
  return {
    can_assign_cases: input.can_assign_cases !== false,
    can_edit_case_details: input.can_edit_case_details !== false,
  };
}

function resolveClinicUserRole(params: {
  clinicLinkedUserId: string | null;
  userId: string;
  portalBasicProfile: unknown;
}) {
  if (params.clinicLinkedUserId && params.clinicLinkedUserId === params.userId) return "owner";
  const basic = asRecord(params.portalBasicProfile);
  const role = asText(basic.clinic_user_role).toLowerCase();
  if (role === "owner" || role === "admin") return role;
  return "member";
}

export async function GET() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { admin, clinicProfile } = await resolveClinicProfileForUser({
    userId: user.id,
    userEmail: asText(user.email).toLowerCase(),
  });
  if (!clinicProfile) return NextResponse.json({ error: "Clinic profile missing" }, { status: 500 });

  const { data: rows, error } = await admin
    .from("doctor_profiles")
    .select(
      "id, doctor_name, doctor_email, profile_image_url, professional_title, short_bio, specialties, years_experience, public_summary, associated_branches, is_active, archived_at, clinic_role, case_permissions, can_respond_audits, can_submit_cases, can_view_internal_cases, updated_at, created_at"
    )
    .eq("clinic_profile_id", clinicProfile.id)
    .order("is_active", { ascending: false })
    .order("doctor_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: portal } = await admin
    .from("clinic_portal_profiles")
    .select("basic_profile")
    .eq("clinic_profile_id", clinicProfile.id)
    .maybeSingle();

  const userRole = resolveClinicUserRole({
    clinicLinkedUserId: clinicProfile.linked_user_id,
    userId: user.id,
    portalBasicProfile: (portal as { basic_profile?: unknown } | null)?.basic_profile,
  });

  return NextResponse.json({
    ok: true,
    userRole,
    canManageDoctors: userRole === "owner" || userRole === "admin",
    items: rows ?? [],
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { admin, clinicProfile } = await resolveClinicProfileForUser({
    userId: user.id,
    userEmail: asText(user.email).toLowerCase(),
  });
  if (!clinicProfile) return NextResponse.json({ error: "Clinic profile missing" }, { status: 500 });

  const { data: portal } = await admin
    .from("clinic_portal_profiles")
    .select("basic_profile")
    .eq("clinic_profile_id", clinicProfile.id)
    .maybeSingle();
  const userRole = resolveClinicUserRole({
    clinicLinkedUserId: clinicProfile.linked_user_id,
    userId: user.id,
    portalBasicProfile: (portal as { basic_profile?: unknown } | null)?.basic_profile,
  });
  if (!(userRole === "owner" || userRole === "admin")) {
    return NextResponse.json({ error: "Only clinic owner/admin can manage doctors." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const doctorName = asText(body?.fullName);
  if (!doctorName) return NextResponse.json({ error: "Doctor full name is required." }, { status: 400 });

  const payload = {
    clinic_profile_id: clinicProfile.id,
    doctor_name: doctorName,
    doctor_email: asText(body?.email) || null,
    profile_image_url: asText(body?.profileImage) || null,
    professional_title: asText(body?.title) || null,
    short_bio: asText(body?.shortBio) || null,
    specialties: asArray(body?.specialties),
    years_experience:
      Number.isFinite(Number(body?.yearsExperience)) && Number(body?.yearsExperience) >= 0
        ? Number(body?.yearsExperience)
        : null,
    public_summary: asText(body?.publicSummary) || null,
    associated_branches: asArray(body?.associatedBranches),
    is_active: body?.isActive !== false,
    archived_at: body?.isActive === false ? new Date().toISOString() : null,
    clinic_role: asText(body?.clinicRole) || "doctor",
    case_permissions: defaultCasePermissions(body?.casePermissions),
    can_respond_audits: body?.canRespondToAudits !== false,
    can_submit_cases: body?.canSubmitCases !== false,
    can_view_internal_cases: Boolean(body?.canViewInternalCases),
  };

  const { data, error } = await admin
    .from("doctor_profiles")
    .insert(payload)
    .select(
      "id, doctor_name, doctor_email, profile_image_url, professional_title, short_bio, specialties, years_experience, public_summary, associated_branches, is_active, archived_at, clinic_role, case_permissions, can_respond_audits, can_submit_cases, can_view_internal_cases, updated_at, created_at"
    )
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(req: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { admin, clinicProfile } = await resolveClinicProfileForUser({
    userId: user.id,
    userEmail: asText(user.email).toLowerCase(),
  });
  if (!clinicProfile) return NextResponse.json({ error: "Clinic profile missing" }, { status: 500 });

  const { data: portal } = await admin
    .from("clinic_portal_profiles")
    .select("basic_profile")
    .eq("clinic_profile_id", clinicProfile.id)
    .maybeSingle();
  const userRole = resolveClinicUserRole({
    clinicLinkedUserId: clinicProfile.linked_user_id,
    userId: user.id,
    portalBasicProfile: (portal as { basic_profile?: unknown } | null)?.basic_profile,
  });
  if (!(userRole === "owner" || userRole === "admin")) {
    return NextResponse.json({ error: "Only clinic owner/admin can manage doctors." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const doctorId = asText(body?.id);
  if (!doctorId) return NextResponse.json({ error: "Missing doctor id." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body?.fullName !== undefined) patch.doctor_name = asText(body.fullName) || "Unspecified Doctor";
  if (body?.email !== undefined) patch.doctor_email = asText(body.email) || null;
  if (body?.profileImage !== undefined) patch.profile_image_url = asText(body.profileImage) || null;
  if (body?.title !== undefined) patch.professional_title = asText(body.title) || null;
  if (body?.shortBio !== undefined) patch.short_bio = asText(body.shortBio) || null;
  if (body?.specialties !== undefined) patch.specialties = asArray(body.specialties);
  if (body?.yearsExperience !== undefined) {
    patch.years_experience =
      Number.isFinite(Number(body.yearsExperience)) && Number(body.yearsExperience) >= 0
        ? Number(body.yearsExperience)
        : null;
  }
  if (body?.publicSummary !== undefined) patch.public_summary = asText(body.publicSummary) || null;
  if (body?.associatedBranches !== undefined) patch.associated_branches = asArray(body.associatedBranches);
  if (body?.clinicRole !== undefined) patch.clinic_role = asText(body.clinicRole) || "doctor";
  if (body?.casePermissions !== undefined) patch.case_permissions = defaultCasePermissions(body.casePermissions);
  if (body?.canRespondToAudits !== undefined) patch.can_respond_audits = Boolean(body.canRespondToAudits);
  if (body?.canSubmitCases !== undefined) patch.can_submit_cases = Boolean(body.canSubmitCases);
  if (body?.canViewInternalCases !== undefined) patch.can_view_internal_cases = Boolean(body.canViewInternalCases);
  if (body?.isActive !== undefined) {
    const isActive = Boolean(body.isActive);
    patch.is_active = isActive;
    patch.archived_at = isActive ? null : new Date().toISOString();
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from("doctor_profiles")
    .update(patch)
    .eq("id", doctorId)
    .eq("clinic_profile_id", clinicProfile.id)
    .select(
      "id, doctor_name, doctor_email, profile_image_url, professional_title, short_bio, specialties, years_experience, public_summary, associated_branches, is_active, archived_at, clinic_role, case_permissions, can_respond_audits, can_submit_cases, can_view_internal_cases, updated_at, created_at"
    )
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}
