import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import { SURGERY_PROCEDURE_TYPES } from "@/lib/surgeryUpload/fields";
import { parseSurgeryUploadSearchParams } from "@/lib/surgeryUpload/listParams";
import { loadSurgeryUploadIndex } from "@/lib/surgeryUpload/listQuery";
import StartSurgeryUploadButton from "./StartSurgeryUploadButton";
import type { ClinicPickerOption } from "./defaults/ClinicDefaultsPicker";
import SurgeryUploadIndexClient from "./SurgeryUploadIndexClient";

export const dynamic = "force-dynamic";

const PROCEDURE_LABELS = Object.fromEntries(
  SURGERY_PROCEDURE_TYPES.map((p) => [p.value, p.label])
);

export default async function SurgeryUploadIndexPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const actor = await resolveSurgeryUploadActor(user);
  if (!actor.allowed) redirect("/dashboard");

  const admin = createSupabaseAdminClient();

  // All filtering + pagination happens server-side. Access is enforced inside the
  // loader (non-auditors are constrained to created_by = user.id); clinic_profile_id
  // is used only as a filter key, never as an access grant.
  const params = parseSurgeryUploadSearchParams(await Promise.resolve(searchParams ?? {}));
  const result = await loadSurgeryUploadIndex({
    admin,
    userId: user.id,
    isAuditor: actor.isAuditor,
    params,
  });

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
        <div className="mt-3 flex flex-wrap gap-2">
          {canEditDefaults && (
            <Link
              href="/dashboard/surgery-upload/defaults"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-300"
            >
              Surgery defaults
            </Link>
          )}
          {actor.isAuditor && (
            <Link
              href="/dashboard/surgery-upload/audit-intake"
              className="inline-flex items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:border-indigo-400"
            >
              Audit intake queue
            </Link>
          )}
        </div>
      </header>

      <div className="sticky top-2 z-10 mt-5">
        <StartSurgeryUploadButton isAuditor={actor.isAuditor} clinics={clinics} />
      </div>

      <SurgeryUploadIndexClient
        rows={result.rows}
        options={result.options}
        filters={params}
        page={result.page}
        pageSize={result.pageSize}
        totalCount={result.totalCount}
        totalCountApproximate={result.totalCountApproximate}
        hasPrevPage={result.hasPrevPage}
        hasNextPage={result.hasNextPage}
        totalPages={result.totalPages}
        procedureLabels={PROCEDURE_LABELS}
        isAuditor={actor.isAuditor}
      />
    </div>
  );
}
