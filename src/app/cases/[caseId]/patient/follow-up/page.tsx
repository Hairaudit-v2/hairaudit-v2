import Link from "next/link";
import { redirect } from "next/navigation";
import { buildPatientLoginHref } from "@/lib/auth/patientLogin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadGuidedCaptureLanding } from "@/lib/outcomeIntelligence/guidedCaptureLoad.server";
import { isGuidedCaptureUiEnabled } from "@/lib/outcomeIntelligence/guidedCaptureConfig";
import LongitudinalCaptureLanding from "@/components/patient/longitudinal/LongitudinalCaptureLanding";

type PageProps = {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ stage?: string }>;
};

export default async function FollowUpLandingPage({ params, searchParams }: PageProps) {
  const { caseId } = await params;
  const sp = await searchParams;
  const stage = String(sp.stage ?? "").trim();

  if (stage) {
    redirect(`/cases/${caseId}/patient/follow-up/${stage}`);
  }

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildPatientLoginHref(`/cases/${caseId}/patient/follow-up`));
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
  const loaded = await loadGuidedCaptureLanding({
    admin,
    caseId,
    patientId,
    caseRow: c,
  });

  if (!loaded.ok) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10" data-testid="guided-capture-unavailable">
        <h1 className="text-xl font-semibold text-slate-900">Follow-up photos</h1>
        <p className="mt-2 text-sm text-slate-600">
          {loaded.code === "PROJECTION_NOT_FOUND"
            ? "A HairAudit projection is needed before follow-up photo milestones are available."
            : "We couldn’t load your follow-up plan right now. Please try again later."}
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

  return (
    <LongitudinalCaptureLanding
      caseId={caseId}
      landing={loaded.landing}
      homeHref="/dashboard/patient"
    />
  );
}
