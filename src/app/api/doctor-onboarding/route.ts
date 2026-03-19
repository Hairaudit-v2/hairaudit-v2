import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET — return current user's doctor profile for onboarding form pre-fill.
 * POST — create or update doctor_profiles for the authenticated user (minimal onboarding).
 */

export async function GET() {
  const auth = await createSupabaseAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("doctor_profiles")
    .select("id, doctor_name, doctor_email, years_experience, short_bio")
    .eq("linked_user_id", user.id)
    .maybeSingle();

  const shortBio = profile?.short_bio;
  const clinicName =
    typeof shortBio === "string" && shortBio.startsWith("Clinic: ")
      ? shortBio.replace(/^Clinic: /, "").trim()
      : undefined;

  return NextResponse.json({
    ok: true,
    profile: profile
      ? {
          id: profile.id,
          doctor_name: profile.doctor_name,
          doctor_email: profile.doctor_email ?? undefined,
          years_experience: profile.years_experience ?? undefined,
          clinic_name: clinicName,
        }
      : null,
  });
}

export async function POST(req: Request) {
  const auth = await createSupabaseAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const doctorName =
    typeof body?.doctor_name === "string" && body.doctor_name.trim().length > 0
      ? body.doctor_name.trim()
      : null;
  if (!doctorName) {
    return NextResponse.json({ error: "Doctor name is required" }, { status: 400 });
  }

  const doctorEmail =
    typeof body?.doctor_email === "string" && body.doctor_email.trim().length > 0
      ? body.doctor_email.trim()
      : (user.email ?? "").trim() || null;
  const yearsExperience =
    typeof body?.years_experience === "number" && body.years_experience >= 0
      ? body.years_experience
      : typeof body?.years_experience === "string" && body.years_experience.trim() !== ""
        ? parseInt(body.years_experience.trim(), 10)
        : null;
  const validYears =
    yearsExperience !== null && !Number.isNaN(yearsExperience) && yearsExperience >= 0 && yearsExperience <= 100
      ? yearsExperience
      : null;
  const clinicName =
    typeof body?.clinic_name === "string" && body.clinic_name.trim().length > 0
      ? body.clinic_name.trim()
      : null;
  const shortBio = clinicName ? `Clinic: ${clinicName}` : null;

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("doctor_profiles")
    .select("id")
    .eq("linked_user_id", user.id)
    .maybeSingle();

  const payload = {
    linked_user_id: user.id,
    doctor_name: doctorName,
    doctor_email: doctorEmail,
    ...(validYears !== null && { years_experience: validYears }),
    ...(shortBio !== null && { short_bio: shortBio }),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await admin
      .from("doctor_profiles")
      .update(payload)
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: true });
  }

  const { error } = await admin.from("doctor_profiles").insert(payload);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, created: true });
}
