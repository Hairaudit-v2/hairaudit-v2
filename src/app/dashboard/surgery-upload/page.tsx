import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import { SURGERY_PROCEDURE_TYPES } from "@/lib/surgeryUpload/fields";
import {
  REQUIRED_SURGERY_PHOTO_SLOTS,
  getRequiredPhotoCompletion,
} from "@/lib/surgeryUpload/checklist";
import StartSurgeryUploadButton from "./StartSurgeryUploadButton";
import type { ClinicPickerOption } from "./defaults/ClinicDefaultsPicker";
import SurgeryUploadIndexClient, {
  type SurgeryUploadListRow,
} from "./SurgeryUploadIndexClient";

export const dynamic = "force-dynamic";

const PROCEDURE_LABELS = Object.fromEntries(
  SURGERY_PROCEDURE_TYPES.map((p) => [p.value, p.label])
);
const REQUIRED_PHOTO_TOTAL = REQUIRED_SURGERY_PHOTO_SLOTS.length;

export default async function SurgeryUploadIndexPage() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const actor = await resolveSurgeryUploadActor(user);
  if (!actor.allowed) redirect("/dashboard");

  const admin = createSupabaseAdminClient();

  // Doctors/clinics see uploads they created; auditors see the most recent set.
  const query = admin
    .from("surgery_upload_details")
    .select(
      "case_id, patient_reference, clinic_name, clinic_profile_id, surgeon_name, surgery_date, procedure_type, status, submitted_at, photo_checklist_config, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(50);
  if (!actor.isAuditor) {
    query.eq("created_by", user.id);
  }
  const { data: rows } = await query;

  const list = rows ?? [];

  // Required-photo completion counts per case (reviewer visibility). Totals are
  // per-case because a clinic may have promoted optional categories to required.
  const requiredDoneByCase: Record<string, number> = {};
  const requiredTotalByCase: Record<string, number> = {};
  if (list.length > 0) {
    const caseIds = list.map((r) => r.case_id);
    const configByCase = new Map<string, unknown>(
      list.map((r) => [r.case_id, (r as { photo_checklist_config?: unknown }).photo_checklist_config])
    );
    const { data: ups } = await admin
      .from("uploads")
      .select("case_id, type")
      .in("case_id", caseIds);
    const byCase: Record<string, { type: string }[]> = {};
    for (const u of ups ?? []) {
      (byCase[u.case_id as string] ||= []).push({ type: u.type as string });
    }
    for (const caseId of caseIds) {
      const completion = getRequiredPhotoCompletion(
        byCase[caseId] ?? [],
        configByCase.get(caseId)
      );
      requiredDoneByCase[caseId] = completion.done;
      requiredTotalByCase[caseId] = completion.total;
    }
  }

  const canEditDefaults = actor.role === "clinic" || actor.isAuditor;

  // Auditors/admins can start an upload on behalf of a selected clinic. The new
  // case inherits that clinic's defaults + photo checklist (handled by the create API).
  let clinics: ClinicPickerOption[] = [];
  if (actor.isAuditor) {
    const { data: clinicRows } = await admin
      .from("clinic_profiles")
      .select("id, clinic_name, clinic_email, participation_status")
      .order("clinic_name", { ascending: true });
    clinics = ((clinicRows ?? []) as Array<{
      id: string;
      clinic_name: string | null;
      clinic_email: string | null;
      participation_status: string | null;
    }>).map((c) => ({
      id: c.id,
      clinicName: c.clinic_name ?? "",
      email: c.clinic_email ?? null,
      status: c.participation_status ?? null,
    }));
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24">
      <header className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
          HairAudit
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Surgery Upload Portal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Capture surgery photos and case details from your phone, during or right
          after the procedure.
        </p>
        {canEditDefaults && (
          <Link
            href="/dashboard/surgery-upload/defaults"
            className="mt-3 inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-300"
          >
            Surgery defaults
          </Link>
        )}
      </header>

      <div className="sticky top-2 z-10 mt-5">
        <StartSurgeryUploadButton isAuditor={actor.isAuditor} clinics={clinics} />
      </div>

      <SurgeryUploadIndexClient
        rows={list as SurgeryUploadListRow[]}
        requiredDoneByCase={requiredDoneByCase}
        requiredTotalByCase={requiredTotalByCase}
        requiredPhotoTotal={REQUIRED_PHOTO_TOTAL}
        procedureLabels={PROCEDURE_LABELS}
        isAuditor={actor.isAuditor}
      />
    </div>
  );
}
