// POST /api/surgery-upload/cases — create a lightweight surgery-upload draft case
// Reuses the existing `cases` table (status 'draft') and adds a 1:1
// surgery_upload_details row. Does NOT trigger the audit/AI pipeline.
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import { sanitizeSurgeryDetailsInput } from "@/lib/surgeryUpload/fields";
import { resolveSurgeryClinicContext } from "@/lib/surgeryUpload/resolveClinicContext";
import {
  defaultsToCaseValues,
  resolveDefaultChecklistForNewCase,
} from "@/lib/surgeryUpload/clinicDefaults";
import type { SurgeryChecklistConfig } from "@/lib/surgeryUpload/checklist";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/surgery-upload/cases]";

export async function POST(req: Request) {
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
      return NextResponse.json(
        { ok: false, error: "Forbidden: surgery upload is for doctors, clinics, and auditors." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sanitized = sanitizeSurgeryDetailsInput(body);
    if ("error" in sanitized) {
      return NextResponse.json({ ok: false, error: sanitized.error }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Resolve the clinic linkage (Stage 2.2). This single resolved clinicProfileId
    // drives BOTH defaults lookup and the stored clinic_profile_id, so reporting and
    // defaults always agree. clinic_name is kept as a human-readable snapshot.
    let clinicProfileId: string | null = null;
    let clinicName: string | null = null;
    if (actor.isAuditor) {
      // Auditors may explicitly target a clinic; only store it if it actually exists.
      const requested =
        typeof body.clinicProfileId === "string" && body.clinicProfileId.trim()
          ? body.clinicProfileId.trim()
          : null;
      if (requested) {
        const { data: cp } = await admin
          .from("clinic_profiles")
          .select("id, clinic_name")
          .eq("id", requested)
          .maybeSingle();
        if (cp?.id) {
          clinicProfileId = cp.id as string;
          clinicName = (cp.clinic_name as string | null) ?? null;
        }
      }
    } else {
      // Clinic owners and clinic-linked doctors resolve via existing context helper.
      const clinicContext = await resolveSurgeryClinicContext(admin, user.id, actor.role);
      clinicProfileId = clinicContext.clinicProfileId;
      clinicName = clinicContext.clinicName;
    }

    // Copy saved clinic defaults (Stage 2). Defaults are COPIED, never linked, so
    // historical cases stay accurate if defaults change later.
    let defaultValues: Record<string, string | boolean> = {};
    let defaultsApplied = false;
    // Stage 3: snapshot of the clinic's photo checklist preferences, copied (not
    // linked) so later default changes never alter this case. null => base checklist.
    let checklistConfig: SurgeryChecklistConfig | null = null;
    if (clinicProfileId) {
      const { data: defaultsRow } = await admin
        .from("surgery_upload_clinic_defaults")
        .select("*")
        .eq("clinic_profile_id", clinicProfileId)
        .maybeSingle();
      const mapped = defaultsToCaseValues(defaultsRow);
      defaultValues = mapped.values;
      // prefilled_from_clinic_defaults is true only when real defaults were copied.
      defaultsApplied = mapped.applied;
      checklistConfig = resolveDefaultChecklistForNewCase(defaultsRow);
    }

    // Create the underlying case as a draft, mirroring /api/cases/create.
    const isClinic = actor.role === "clinic";
    const auditType = isClinic ? "clinic" : "doctor";
    const insertCase: Record<string, unknown> = {
      user_id: user.id,
      title:
        (typeof body.patient_reference === "string" && body.patient_reference.trim()) ||
        "Surgery upload",
      status: "draft",
      audit_type: auditType,
      submission_channel: isClinic ? "clinic_submitted" : "doctor_submitted",
      visibility_scope: "internal",
    };
    if (actor.role === "doctor") insertCase.doctor_id = user.id;
    if (actor.role === "clinic") insertCase.clinic_id = user.id;
    // Auditors create a draft owned by themselves (user_id); reassignment is a Stage 2 concern.

    const { data: createdCase, error: caseErr } = await admin
      .from("cases")
      .insert(insertCase)
      .select("id")
      .single();

    if (caseErr || !createdCase?.id) {
      console.error(LOG_PREFIX, "case insert failed", { error: caseErr?.message });
      return NextResponse.json(
        { ok: false, error: caseErr?.message ?? "Could not create case" },
        { status: 500 }
      );
    }

    const caseId = String(createdCase.id);

    const detailsRow: Record<string, unknown> = {
      case_id: caseId,
      created_by: user.id,
      status: "draft",
      // Stage 2.2: reliable clinic linkage (nullable; never blocks creation).
      clinic_profile_id: clinicProfileId,
      prefilled_from_clinic_defaults: defaultsApplied,
      // Stage 3: per-case checklist snapshot (null => base HairAudit checklist).
      photo_checklist_config: checklistConfig,
      // Clinic defaults first; explicit request body values win over them.
      ...defaultValues,
      ...sanitized.values,
    };
    // Pre-fill clinic name snapshot from the resolved clinic profile when not supplied.
    if (!detailsRow.clinic_name && clinicName) {
      detailsRow.clinic_name = clinicName;
    }
    // Default surgeon name from sign-in identity when not supplied.
    if (!detailsRow.surgeon_name && actor.role === "doctor") {
      detailsRow.surgeon_name = (user.user_metadata?.name as string) ?? null;
    }

    const { data: createdDetails, error: detailsErr } = await admin
      .from("surgery_upload_details")
      .insert(detailsRow)
      .select("*")
      .single();

    if (detailsErr) {
      console.error(LOG_PREFIX, "details insert failed; rolling back case", {
        caseId,
        error: detailsErr.message,
      });
      // Best-effort cleanup so we don't leave an orphan draft case behind.
      await admin.from("cases").delete().eq("id", caseId);
      return NextResponse.json(
        { ok: false, error: detailsErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, caseId, details: createdDetails });
  } catch (e) {
    console.error(LOG_PREFIX, "unhandled error", e);
    return NextResponse.json(
      { ok: false, error: "Could not create surgery upload" },
      { status: 500 }
    );
  }
}
