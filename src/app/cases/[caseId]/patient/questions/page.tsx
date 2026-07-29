import Link from "next/link";
import { redirect } from "next/navigation";
import PatientAuditFormClient from "./PatientAuditFormClient";
import { buildPatientLoginHref } from "@/lib/auth/patientLogin";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import CaseNotFoundRecovery from "@/components/case/CaseNotFoundRecovery";
import { getTranslation } from "@/lib/i18n/getTranslation";
import type { TranslationKey } from "@/lib/i18n/translationKeys";
import { resolvePublicSeoLocale } from "@/lib/seo/localeMetadata";
import {
  getPathwayQuestionnairePageCopy,
  INVALID_PATIENT_REVIEW_PATHWAY_QUESTIONNAIRE_ERROR,
  resolveQuestionnairePathwayIgnoringClientOverrides,
} from "@/lib/patient/patientPathwayQuestionnaire";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { caseId } = await params;
  const query = searchParams ? await searchParams : {};
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(buildPatientLoginHref(`/cases/${caseId}/patient/questions`));

  const { data: c } = await supabase
    .from("cases")
    .select("id, status, submitted_at, user_id, patient_id, patient_review_pathway")
    .eq("id", caseId)
    .maybeSingle();

  if (!c) {
    console.error("[case_not_found] patient questions", {
      caseId,
      userId: user.id,
    });
    return <CaseNotFoundRecovery dashboardHref="/dashboard/patient" startNewHref="/dashboard/patient" showExistingCasesLink existingCasesHref="/dashboard/patient" />;
  }

  const allowed = c.user_id === user.id || c.patient_id === user.id;
  if (!allowed) redirect("/dashboard/patient");

  const seoLocale = await resolvePublicSeoLocale();
  const tr = (key: TranslationKey) => getTranslation(key, seoLocale);

  // Exclusive source of truth: cases.patient_review_pathway. URL/query ignored.
  const patientReviewPathway = resolveQuestionnairePathwayIgnoringClientOverrides({
    caseRow: c,
    urlPathway: query.pathway ?? query.patient_review_pathway,
  });

  if (!patientReviewPathway) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Link
          href={`/cases/${caseId}`}
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          {tr("dashboard.patient.forms.questionsPage.backToCase")}
        </Link>
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-lg font-semibold text-rose-900">Unable to load questionnaire</h1>
          <p className="mt-2 text-sm text-rose-800">
            {INVALID_PATIENT_REVIEW_PATHWAY_QUESTIONNAIRE_ERROR}
          </p>
          <Link
            href="/dashboard/patient"
            className="mt-4 inline-flex text-sm font-semibold text-rose-900 underline underline-offset-4"
          >
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const pageCopy = getPathwayQuestionnairePageCopy(patientReviewPathway);
  const titleTr = tr(pageCopy.titleKey as TranslationKey);
  const subtitleTr = tr(pageCopy.subtitleKey as TranslationKey);
  const title = titleTr === pageCopy.titleKey ? pageCopy.title : titleTr;
  const subtitle = subtitleTr === pageCopy.subtitleKey ? pageCopy.subtitle : subtitleTr;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <Link
        href={`/cases/${caseId}`}
        className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        {tr("dashboard.patient.forms.questionsPage.backToCase")}
      </Link>

      <section className="relative mt-4 overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">{title}</h1>
          <p className="mt-2 text-sm sm:text-base text-slate-200/70 max-w-2xl">{subtitle}</p>
        </div>
      </section>

      <div className="mt-6">
        <PatientAuditFormClient
          caseId={caseId}
          caseStatus={c.status ?? "draft"}
          submittedAt={c.submitted_at}
          minimal
          patientReviewPathway={patientReviewPathway}
          nextHref={`/cases/${caseId}/patient/contact`}
        />
      </div>
    </div>
  );
}
