import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireHairAuditBulkAdmin } from "@/lib/hair-audit/bulkUpload/auth";
import { createBulkClinic, findClinicMatches, normalizeEmail } from "@/lib/hair-audit/bulkUpload/professionalIntake";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireHairAuditBulkAdmin();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null as Record<string, unknown> | null);
  const clinic_name = typeof body?.clinic_name === "string" ? body.clinic_name.trim() : "";
  if (!clinic_name) {
    return NextResponse.json({ ok: false, error: "clinic_name is required" }, { status: 400 });
  }

  const confirmDuplicates =
    typeof body?.confirmDuplicates === "boolean"
      ? body.confirmDuplicates
      : typeof body?.confirm_duplicate === "boolean"
        ? body.confirm_duplicate
        : false;

  const normalizedEmail =
    typeof body?.clinic_email === "string" && body.clinic_email.trim()
      ? normalizeEmail(body.clinic_email.trim())
      : null;

  const admin = createSupabaseAdminClient();

  if (!confirmDuplicates && normalizedEmail) {
    const { data: prof } = await admin.from("profiles").select("id, name, role, email").eq("email", normalizedEmail).maybeSingle();
    if (prof?.role === "clinic") {
      const { data: cp } = await admin
        .from("clinic_profiles")
        .select("id, clinic_name, linked_user_id, country, city")
        .eq("linked_user_id", prof.id)
        .maybeSingle();
      if (cp?.linked_user_id && cp.clinic_name && cp.id) {
        return NextResponse.json(
          {
            ok: false,
            code: "duplicate_email",
            message: `A clinic login already uses ${normalizedEmail}. Select it from the directory or confirm duplicate override.`,
            match: {
              userId: cp.linked_user_id,
              displayLabel: cp.clinic_name,
              clinic_profile_id: cp.id,
              country: cp.country,
              city: cp.city,
            },
          },
          { status: 409 }
        );
      }
    }
  }

  const country = typeof body?.country === "string" ? body.country.trim() || null : null;
  const city = typeof body?.city === "string" ? body.city.trim() || null : null;
  const websiteRaw = typeof body?.clinic_website === "string" ? body.clinic_website : null;

  if (!confirmDuplicates) {
    const { byWebsite, byNameStrict, suggestions } = await findClinicMatches(admin, {
      name: clinic_name,
      country,
      city,
      website: websiteRaw,
    });
    const strongDup = byWebsite ?? byNameStrict;
    if (strongDup) {
      return NextResponse.json(
        {
          ok: false,
          code: "possible_duplicate",
          message:
            byWebsite
              ? "A clinic already has this normalized website/domain. Select it or confirm to proceed."
              : "A clinic exists with this name plus location hints. Confirm if this should be separate.",
          match: strongDup,
          suggestions,
        },
        { status: 409 }
      );
    }
  }

  try {
    const created = await createBulkClinic(admin, {
      clinic_name,
      clinic_email: typeof body?.clinic_email === "string" ? body.clinic_email.trim() || null : null,
      clinic_phone: typeof body?.clinic_phone === "string" ? body.clinic_phone.trim() || null : null,
      clinic_website: typeof body?.clinic_website === "string" ? body.clinic_website.trim() || null : null,
      country: typeof body?.country === "string" ? body.country : null,
      city: typeof body?.city === "string" ? body.city : null,
      bulk_intake_notes: typeof body?.bulk_intake_notes === "string" ? body.bulk_intake_notes : null,
    });
    const { suggestions } = await findClinicMatches(admin, {
      name: clinic_name,
      country,
      city,
      website: websiteRaw,
    });
    return NextResponse.json({
      ok: true,
      clinic: {
        userId: created.userId,
        clinicProfileId: created.clinicProfileId,
        displayLabel: created.displayLabel,
        emailUsedForAuth: created.emailUsed,
      },
      similarClinics: suggestions.slice(0, 8),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
