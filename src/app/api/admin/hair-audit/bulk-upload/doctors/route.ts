import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireHairAuditBulkAdmin } from "@/lib/hair-audit/bulkUpload/auth";
import {
  createBulkDoctor,
  findDoctorMatchesByEmail,
  findExactDoctorNameMatches,
  normalizeEmail,
} from "@/lib/hair-audit/bulkUpload/professionalIntake";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null as Record<string, unknown> | null);
  const doctor_name = typeof body?.doctor_name === "string" ? body.doctor_name.trim() : "";
  if (!doctor_name) {
    return NextResponse.json({ ok: false, error: "doctor_name is required" }, { status: 400 });
  }

  const confirmDuplicates =
    typeof body?.confirmDuplicates === "boolean"
      ? body.confirmDuplicates
      : typeof body?.confirm_duplicate === "boolean"
        ? body.confirm_duplicate
        : false;

  const normalizedEmail =
    typeof body?.doctor_email === "string" && body.doctor_email.trim()
      ? normalizeEmail(body.doctor_email.trim())
      : null;

  const admin = createSupabaseAdminClient();

  if (!confirmDuplicates && normalizedEmail) {
    const dup = await findDoctorMatchesByEmail(admin, normalizedEmail);
    if (dup) {
      return NextResponse.json(
        {
          ok: false,
          code: "duplicate_email",
          message: `A doctor with email ${normalizedEmail} already exists. Select that doctor instead, or confirm to create anyway.`,
          match: dup,
        },
        { status: 409 }
      );
    }
  }

  if (!confirmDuplicates && !normalizedEmail) {
    const exactName = await findExactDoctorNameMatches(admin, doctor_name);
    if (exactName.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "exact_name_duplicate",
          message: `Found ${exactName.length} doctor(s) with this exact display name — confirm create if they are different people.`,
          matches: exactName,
        },
        { status: 409 }
      );
    }
  }

  const clinicUserId =
    typeof body?.clinicUserId === "string" ? body.clinicUserId.trim()
    : typeof body?.clinic_user_id === "string" ? body.clinic_user_id.trim()
    : "";

  try {
    const created = await createBulkDoctor(admin, {
      doctor_name,
      doctor_email: typeof body?.doctor_email === "string" ? body.doctor_email.trim() || null : null,
      intake_phone: typeof body?.intake_phone === "string" ? body.intake_phone : null,
      country: typeof body?.country === "string" ? body.country : null,
      city: typeof body?.city === "string" ? body.city : null,
      bulk_intake_notes: typeof body?.bulk_intake_notes === "string" ? body.bulk_intake_notes : null,
      clinicUserId: clinicUserId || null,
    });
    return NextResponse.json({
      ok: true,
      doctor: {
        userId: created.userId,
        doctorProfileId: created.doctorProfileId,
        displayLabel: created.displayLabel,
        emailUsedForAuth: created.emailUsed,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
