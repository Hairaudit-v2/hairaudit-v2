// PUT /api/surgery-upload/defaults — upsert clinic-level surgery defaults (Stage 2)
// Clinic owners edit their own clinic's defaults. Auditors may edit any clinic's
// defaults by passing clinicProfileId. Doctors are read-only (403 on write).
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import { resolveSurgeryClinicContext } from "@/lib/surgeryUpload/resolveClinicContext";
import { sanitizeClinicDefaultsInput } from "@/lib/surgeryUpload/clinicDefaults";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/surgery-upload/defaults]";

export async function PUT(req: Request) {
  try {
    const auth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const actor = await resolveSurgeryUploadActor(user);
    if (!actor.allowed) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    if (actor.role === "doctor") {
      return NextResponse.json(
        { ok: false, error: "Doctors can view clinic defaults but cannot edit them." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const admin = createSupabaseAdminClient();

    // Resolve the clinic we're saving defaults for.
    let clinicProfileId: string | null = null;
    if (actor.isAuditor) {
      clinicProfileId =
        typeof body.clinicProfileId === "string" && body.clinicProfileId.trim()
          ? body.clinicProfileId.trim()
          : null;
      if (!clinicProfileId) {
        return NextResponse.json(
          { ok: false, error: "clinicProfileId is required for auditors" },
          { status: 400 }
        );
      }
    } else {
      const ctx = await resolveSurgeryClinicContext(admin, user.id, actor.role);
      clinicProfileId = ctx.clinicProfileId;
      if (!clinicProfileId) {
        return NextResponse.json(
          { ok: false, error: "No clinic profile is linked to your account." },
          { status: 400 }
        );
      }
    }

    // Confirm the clinic exists (FK safety + clearer error than a 500).
    const { data: clinic } = await admin
      .from("clinic_profiles")
      .select("id")
      .eq("id", clinicProfileId)
      .maybeSingle();
    if (!clinic) {
      return NextResponse.json({ ok: false, error: "Clinic not found" }, { status: 404 });
    }

    const sanitized = sanitizeClinicDefaultsInput(body);
    if ("error" in sanitized) {
      return NextResponse.json({ ok: false, error: sanitized.error }, { status: 400 });
    }

    const { data: existing } = await admin
      .from("surgery_upload_clinic_defaults")
      .select("id")
      .eq("clinic_profile_id", clinicProfileId)
      .maybeSingle();

    let saved;
    if (existing?.id) {
      const { data, error } = await admin
        .from("surgery_upload_clinic_defaults")
        .update({ ...sanitized.values, updated_by: user.id })
        .eq("clinic_profile_id", clinicProfileId)
        .select("*")
        .single();
      if (error) {
        console.error(LOG_PREFIX, "update failed", { clinicProfileId, error: error.message });
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      saved = data;
    } else {
      const { data, error } = await admin
        .from("surgery_upload_clinic_defaults")
        .insert({
          clinic_profile_id: clinicProfileId,
          created_by: user.id,
          updated_by: user.id,
          ...sanitized.values,
        })
        .select("*")
        .single();
      if (error) {
        console.error(LOG_PREFIX, "insert failed", { clinicProfileId, error: error.message });
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      saved = data;
    }

    return NextResponse.json({ ok: true, defaults: saved });
  } catch (e) {
    console.error(LOG_PREFIX, "unhandled error", e);
    return NextResponse.json({ ok: false, error: "Could not save defaults" }, { status: 500 });
  }
}
