import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import CaseNotFoundRecovery from "@/components/case/CaseNotFoundRecovery";

/**
 * Canonical patient photo upload is /cases/[id]/patient/photos.
 * This route redirects there so bookmarked/legacy /cases/[id]/patient links
 * land on the same upload experience.
 */
export default async function Page({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: c } = await supabase
    .from("cases")
    .select("id, status, submitted_at, user_id, patient_id")
    .eq("id", caseId)
    .maybeSingle();

  if (!c) {
    console.error("[case_not_found] legacy patient route", {
      caseId,
      userId: user.id,
    });
    return <CaseNotFoundRecovery dashboardHref="/dashboard/patient" startNewHref="/dashboard/patient" showExistingCasesLink existingCasesHref="/dashboard/patient" />;
  }

  const allowed = c.user_id === user.id || c.patient_id === user.id;
  if (!allowed) redirect("/dashboard/patient");

  redirect(`/cases/${caseId}/patient/photos`);
}

