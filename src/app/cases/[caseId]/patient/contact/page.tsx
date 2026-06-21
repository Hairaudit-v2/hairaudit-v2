import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import CaseNotFoundRecovery from "@/components/case/CaseNotFoundRecovery";
import PatientContactClient from "./PatientContactClient";

/**
 * Email-collection step of the friction-free first audit, shown after photos +
 * minimum questions and before report generation: "Where should we send your
 * report?". Submitting upgrades the anonymous session into a real account and
 * kicks off the audit.
 */
export default async function Page({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/cases/${caseId}/patient/photos`);

  const { data: c } = await supabase
    .from("cases")
    .select("id, user_id, patient_id")
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
  if (!allowed) redirect("/dashboard/patient");

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <PatientContactClient caseId={caseId} />
    </div>
  );
}
