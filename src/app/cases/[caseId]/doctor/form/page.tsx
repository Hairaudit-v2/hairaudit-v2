import Link from "next/link";
import { redirect } from "next/navigation";
import DoctorAuditFormClient from "@/components/audit-form/DoctorAuditFormClient";
import { getTranslation } from "@/lib/i18n/getTranslation";
import { resolvePublicSeoLocale } from "@/lib/seo/localeMetadata";
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
  const locale = await resolvePublicSeoLocale();
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
          ← {getTranslation("dashboard.doctor.forms.caseAudit.page.backToCase", locale)}
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">{getTranslation("dashboard.doctor.forms.caseAudit.page.title", locale)}</h1>
      <p className="text-gray-600 mb-8">{getTranslation("dashboard.doctor.forms.caseAudit.page.description", locale)}</p>

      <DoctorAuditFormClient
        caseId={caseId}
        caseStatus={c.status ?? "draft"}
        submittedAt={c.submitted_at}
        loadUrl={`/api/doctor-answers?caseId=${caseId}`}
        saveUrl={`/api/doctor-answers?caseId=${caseId}`}
        backHref={`/cases/${caseId}`}
        photosNav={{
          href: `/cases/${caseId}/doctor/photos`,
          label: getTranslation("dashboard.doctor.forms.caseAudit.page.photosNavLabel", locale),
          description: getTranslation("dashboard.doctor.forms.caseAudit.page.photosNavDescription", locale),
        }}
        primaryCtaHref={`/cases/${caseId}/doctor/photos`}
        primaryCtaLabel={getTranslation("dashboard.doctor.forms.caseAudit.page.primaryCtaLabel", locale)}
        isFollowupAudit={isFollowupAudit}
      />
    </div>
  );
}

