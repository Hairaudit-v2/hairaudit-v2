import Link from "next/link";
import { redirect } from "next/navigation";
import DoctorAuditFormClient from "@/components/audit-form/DoctorAuditFormClient";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { canAccessCase } from "@/lib/case-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import CaseNotFoundRecovery from "@/components/case/CaseNotFoundRecovery";

export default async function DoctorFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ followup?: string }>;
}) {
  const { caseId } = await params;
  const resolvedSearch = await searchParams;
  const isFollowupAudit = resolvedSearch.followup === "1" || resolvedSearch.followup === "true";
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: c } = await admin
    .from("cases")
    .select("id, status, submitted_at, user_id, doctor_id, clinic_id")
    .eq("id", caseId)
    .maybeSingle();

  if (!c) {
    console.error("[case_not_found] doctor form", {
      caseId,
      userId: user.id,
    });
    return <CaseNotFoundRecovery dashboardHref="/dashboard/doctor" startNewHref="/dashboard/doctor" />;
  }

  const allowed = await canAccessCase(user.id, c);
  if (!allowed) redirect("/dashboard/doctor");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/cases/${caseId}`} className="text-sm text-gray-600 hover:underline">
          ← Back to case
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">Surgery Submission / Case Audit</h1>
      <p className="text-gray-600 mb-8">Target 6–8 minutes. Complete as the treating physician.</p>

      <DoctorAuditFormClient
        caseId={caseId}
        caseStatus={c.status ?? "draft"}
        submittedAt={c.submitted_at}
        loadUrl={`/api/doctor-answers?caseId=${caseId}`}
        saveUrl={`/api/doctor-answers?caseId=${caseId}`}
        backHref={`/cases/${caseId}`}
        photosNav={{
          href: `/cases/${caseId}/doctor/photos`,
          label: "→ Upload or view doctor images",
          description: "Pre-procedure, surgery, and post-procedure images.",
        }}
        primaryCtaHref={`/cases/${caseId}/doctor/photos`}
        primaryCtaLabel="Add your photos →"
        isFollowupAudit={isFollowupAudit}
      />
    </div>
  );
}

