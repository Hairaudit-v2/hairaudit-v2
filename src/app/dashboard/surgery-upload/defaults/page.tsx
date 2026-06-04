import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import { resolveSurgeryClinicContext } from "@/lib/surgeryUpload/resolveClinicContext";
import type { SurgeryUploadClinicDefaults } from "@/lib/surgeryUpload/clinicDefaults";
import SurgeryDefaultsClient from "./SurgeryDefaultsClient";
import ClinicDefaultsPicker, { type ClinicPickerOption } from "./ClinicDefaultsPicker";

export const dynamic = "force-dynamic";

export default async function SurgeryDefaultsPage({
  searchParams,
}: {
  searchParams: Promise<{ clinicProfileId?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const actor = await resolveSurgeryUploadActor(user);
  if (!actor.allowed) redirect("/dashboard");

  const admin = createSupabaseAdminClient();

  // Resolve which clinic we're configuring.
  let clinicProfileId: string | null = null;
  let clinicName: string | null = null;
  let editable = false;
  let clinics: ClinicPickerOption[] = [];

  if (actor.isAuditor) {
    clinicProfileId = sp.clinicProfileId?.trim() || null;
    editable = Boolean(clinicProfileId);

    // Auditor clinic picker: list all clinics so an auditor can choose whose
    // defaults to manage without hand-editing the URL.
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

    if (clinicProfileId) {
      clinicName =
        clinics.find((c) => c.id === clinicProfileId)?.clinicName || null;
    }
  } else {
    const ctx = await resolveSurgeryClinicContext(admin, user.id, actor.role);
    clinicProfileId = ctx.clinicProfileId;
    clinicName = ctx.clinicName;
    // Clinic owners can edit; doctors can view only.
    editable = actor.role === "clinic" && Boolean(clinicProfileId);
  }

  let defaults: SurgeryUploadClinicDefaults | null = null;
  if (clinicProfileId) {
    const { data } = await admin
      .from("surgery_upload_clinic_defaults")
      .select("*")
      .eq("clinic_profile_id", clinicProfileId)
      .maybeSingle();
    defaults = (data as SurgeryUploadClinicDefaults | null) ?? null;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24">
      <div className="pt-2">
        <Link
          href="/dashboard/surgery-upload"
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← Surgery uploads
        </Link>
      </div>

      <header className="mt-2">
        <h1 className="text-2xl font-bold text-slate-900">Surgery defaults</h1>
        <p className="mt-1 text-sm text-slate-600">
          These defaults will pre-fill new surgery uploads but can be changed for each case.
        </p>
        {clinicName && (
          <p className="mt-1 text-sm font-medium text-slate-700">{clinicName}</p>
        )}
      </header>

      {actor.isAuditor && (
        <ClinicDefaultsPicker
          clinics={clinics}
          selectedClinicProfileId={clinicProfileId}
        />
      )}

      {!clinicProfileId ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          {actor.isAuditor ? (
            <>Select a clinic above to view or edit its surgery defaults.</>
          ) : (
            <>No clinic profile is linked to your account yet, so surgery defaults can&apos;t be configured.</>
          )}
        </div>
      ) : (
        <SurgeryDefaultsClient
          clinicProfileId={clinicProfileId}
          editable={editable}
          isAuditor={actor.isAuditor}
          initialDefaults={defaults}
        />
      )}
    </div>
  );
}
