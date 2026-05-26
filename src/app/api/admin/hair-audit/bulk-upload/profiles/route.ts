import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireHairAuditBulkAdmin } from "@/lib/hair-audit/bulkUpload/auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const admin = createSupabaseAdminClient();
  const [clinicsRes, doctorsRes] = await Promise.all([
    admin
      .from("clinic_profiles")
      .select("id, clinic_name, linked_user_id, country, city, clinic_email, clinic_phone, clinic_website")
      .not("linked_user_id", "is", null)
      .order("clinic_name", { ascending: true })
      .limit(500),
    admin
      .from("doctor_profiles")
      .select("id, doctor_name, doctor_email, linked_user_id, clinic_profile_id, country, city, intake_phone")
      .not("linked_user_id", "is", null)
      .order("doctor_name", { ascending: true })
      .limit(500),
  ]);

  if (clinicsRes.error) return NextResponse.json({ ok: false, error: clinicsRes.error.message }, { status: 500 });
  if (doctorsRes.error) return NextResponse.json({ ok: false, error: doctorsRes.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    clinics: (clinicsRes.data ?? []).map((c) => ({
      profileId: c.id,
      name: c.clinic_name,
      userId: c.linked_user_id,
      clinic_email: c.clinic_email ?? null,
      city: c.city ?? null,
      country: c.country ?? null,
    })),
    doctors: (doctorsRes.data ?? []).map((d) => ({
      profileId: d.id,
      name: d.doctor_name,
      userId: d.linked_user_id,
      clinicProfileId: d.clinic_profile_id,
      doctor_email: d.doctor_email ?? null,
      city: d.city ?? null,
      country: d.country ?? null,
    })),
  });
}
