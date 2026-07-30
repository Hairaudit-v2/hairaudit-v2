import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAuditor } from "@/lib/auth/isAuditor";
import { canAccessCase } from "@/lib/case-access";
import { normalizePatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import CaseNotFoundRecovery from "@/components/case/CaseNotFoundRecovery";
import PreSurgeryIntelligenceWorkspace from "@/components/professional/PreSurgeryIntelligenceWorkspace";

/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Clinician-assisted Pre-Surgery Review workspace.
 * Authorised clinicians / auditors only. Extends existing Pre-Surgery Review; does not replace it.
 */
export default async function PreSurgeryProfessionalReviewPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/cases/${caseId}/professional/pre-surgery-review`)}`);
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const auditor = isAuditor({ profileRole: profile?.role, userEmail: user.email });

  const { data: caseRow } = await admin
    .from("cases")
    .select("id, title, user_id, patient_id, doctor_id, clinic_id, patient_review_pathway, status")
    .eq("id", caseId)
    .maybeSingle();

  if (!caseRow) {
    return (
      <CaseNotFoundRecovery
        dashboardHref="/dashboard/auditor"
        startNewHref="/dashboard"
        showExistingCasesLink
        existingCasesHref="/dashboard/auditor"
      />
    );
  }

  if (!(await canAccessCase(user.id, caseRow))) {
    redirect("/dashboard");
  }

  const isAssignedClinician = caseRow.doctor_id === user.id || caseRow.clinic_id === user.id;
  if (!auditor && !isAssignedClinician) {
    redirect(`/cases/${caseId}`);
  }

  const pathway = normalizePatientReviewPathway(caseRow.patient_review_pathway);
  if (pathway !== "pre_surgery") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold text-[var(--ha-foreground)]">Pre-Surgery Planning Workspace</h1>
        <p className="mt-3 text-sm text-[var(--ha-muted-foreground)]">
          This case is not on the pre-surgery pathway. Open the standard case review instead.
        </p>
        <Link href={`/cases/${caseId}`} className="mt-4 inline-block text-sm text-[var(--ha-primary)] underline">
          Back to case
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--ha-muted-foreground)]">
            Professional Pre-Surgery Review
          </p>
          <h1 className="text-2xl font-semibold text-[var(--ha-foreground)]">
            Planning workspace
          </h1>
          <p className="mt-1 text-sm text-[var(--ha-muted-foreground)]">
            {caseRow.title?.trim() || `Case ${caseId.slice(0, 8)}`} — AI proposes; you confirm. Illustrative
            projections are planning aids, not guaranteed outcomes.
          </p>
        </div>
        <Link
          href={`/cases/${caseId}`}
          className="rounded-md border border-[var(--ha-border)] px-3 py-1.5 text-sm text-[var(--ha-foreground)]"
        >
          Case report
        </Link>
      </div>
      <PreSurgeryIntelligenceWorkspace caseId={caseId} />
    </main>
  );
}
