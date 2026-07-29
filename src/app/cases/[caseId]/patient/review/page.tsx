import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import CaseNotFoundRecovery from "@/components/case/CaseNotFoundRecovery";
import PatientReviewSubmitClient from "./PatientReviewSubmitClient";
import { buildPatientLoginHref } from "@/lib/auth/patientLogin";
import { logIntakeAuthDiagnostic, patientReviewPath } from "@/lib/patient/intakeCaseOwnership";
import {
  isPatientReviewPathway,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";

/**
 * Final submission step after account confirmation (HA-AUTH-HANDOFF-FIX).
 */
export default async function Page({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildPatientLoginHref(patientReviewPath(caseId)));
  }

  const { data: c } = await supabase
    .from("cases")
    .select("id, user_id, patient_id, patient_review_pathway, status, submitted_at")
    .eq("id", caseId)
    .maybeSingle();

  if (!c) {
    return (
      <CaseNotFoundRecovery
        dashboardHref="/dashboard/patient"
        startNewHref="/request-review"
        showExistingCasesLink
        existingCasesHref="/dashboard/patient"
      />
    );
  }

  const allowed = c.user_id === user.id || c.patient_id === user.id;
  if (!allowed) {
    logIntakeAuthDiagnostic({
      authStateSource: "server_getUser",
      authenticatedUserId: user.id,
      caseId,
      ownershipResult: "not_owner",
      redirectReason: "dashboard_patient",
      intendedReturnRoute: patientReviewPath(caseId),
    });
    redirect("/dashboard/patient");
  }

  if (c.submitted_at || (c.status && c.status !== "draft")) {
    redirect(`/cases/${caseId}`);
  }

  const pathway: PatientReviewPathway = isPatientReviewPathway(c.patient_review_pathway)
    ? c.patient_review_pathway
    : "post_surgery";

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <PatientReviewSubmitClient caseId={caseId} pathway={pathway} />
    </div>
  );
}
