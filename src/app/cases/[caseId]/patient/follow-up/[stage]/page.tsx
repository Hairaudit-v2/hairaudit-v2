import Link from "next/link";
import { redirect } from "next/navigation";
import { buildPatientLoginHref } from "@/lib/auth/patientLogin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadGuidedLongitudinalCapture } from "@/lib/outcomeIntelligence/guidedCaptureLoad.server";
import { isGuidedCaptureUiEnabled } from "@/lib/outcomeIntelligence/guidedCaptureConfig";
import { isLongitudinalOutcomeStage } from "@/lib/outcomeIntelligence/guidedCaptureBuilder";
import { assertPatientGuidedCaptureDtoSafe } from "@/lib/outcomeIntelligence/guidedCaptureSafety";
import GuidedCaptureWizard from "@/components/patient/longitudinal/GuidedCaptureWizard";

type PageProps = {
  params: Promise<{ caseId: string; stage: string }>;
};

export default async function GuidedFollowUpStagePage({ params }: PageProps) {
  const { caseId, stage: stageParam } = await params;
  const stage = String(stageParam ?? "").trim();

  if (!isLongitudinalOutcomeStage(stage)) {
    redirect(`/cases/${caseId}/patient/follow-up`);
  }

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      buildPatientLoginHref(`/cases/${caseId}/patient/follow-up/${stage}`)
    );
  }

  const { data: c } = await supabase
    .from("cases")
    .select("id, status, submitted_at, user_id, patient_id")
    .eq("id", caseId)
    .maybeSingle();

  const allowed = !!c && (c.user_id === user.id || c.patient_id === user.id);
  if (!allowed) redirect("/dashboard");

  if (!isGuidedCaptureUiEnabled()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold text-slate-900">Follow-up photos</h1>
        <p className="mt-2 text-sm text-slate-600">
          The guided follow-up photo experience is not enabled for this environment yet.
        </p>
        <Link
          href={`/cases/${caseId}/patient/photos`}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-slate-800 underline"
        >
          Open standard photo upload
        </Link>
      </div>
    );
  }

  const admin = tryCreateSupabaseAdminClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-slate-700">Service temporarily unavailable.</p>
      </div>
    );
  }

  const patientId = String(c.patient_id ?? c.user_id ?? user.id);
  const loaded = await loadGuidedLongitudinalCapture({
    admin,
    caseId,
    patientId,
    caseRow: c,
    stage,
  });

  if (!loaded.ok) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10" data-testid="guided-capture-unavailable">
        <h1 className="text-xl font-semibold text-slate-900">Follow-up photos</h1>
        <p className="mt-2 text-sm text-slate-600">
          {loaded.code === "PROJECTION_NOT_FOUND" || loaded.code === "STAGE_NOT_ON_PLAN"
            ? "This follow-up stage isn’t available for your HairAudit case yet."
            : "We couldn’t load this follow-up right now. Please try again later."}
        </p>
        <Link
          href={`/cases/${caseId}/patient/follow-up`}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-slate-800 underline"
        >
          Back to follow-ups
        </Link>
      </div>
    );
  }

  const safety = assertPatientGuidedCaptureDtoSafe(loaded.guided);
  if (!safety.ok) {
    console.error("[guided-capture page] DTO safety failed", safety.violations);
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-slate-700">Could not load follow-up capture.</p>
      </div>
    );
  }

  return (
    <GuidedCaptureWizard
      caseId={caseId}
      initialDto={loaded.guided}
      backHref={`/cases/${caseId}/patient/follow-up`}
    />
  );
}
