"use client";

import Link from "next/link";
import { useMemo } from "react";
import CreateCaseButton from "../create-case-button";
import DoctorOnboardingChecklist, { type OnboardingStep } from "./DoctorOnboardingChecklist";
import ParticipationStatusBanner, { type ParticipationApprovalStatus } from "@/components/dashboard/ParticipationStatusBanner";
import DoctorParticipationSummaryCard, { type ParticipationSummary } from "./DoctorParticipationSummaryCard";
import ProfileCompletenessCard from "@/components/dashboard/ProfileCompletenessCard";
import NextBestStepPanel from "@/components/dashboard/NextBestStepPanel";
import CertificationProgressCard from "@/components/dashboard/CertificationProgressCard";
import type { CertificationProgress } from "@/lib/certificationProgress";
import type { CertificationResult } from "@/lib/certification";
import { BENCHMARKING_GLOBAL_STANDARDS } from "@/lib/benchmarkingCopy";
import { useI18n } from "@/components/i18n/I18nProvider";

type CaseRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  submitted_at?: string | null;
  evidence_score_doctor?: string | null;
};

type ProfileCompleteness = {
  percentage: number;
  doneCount: number;
  totalChecks: number;
  nextActions: Array<{ label: string; href: string }>;
  nextBestStep: { label: string; href: string };
};

export default function DoctorDashboardProduction({
  cases,
  caseIdsWithUploads = [],
  participationApprovalStatus = "not_started",
  participationSummary = { casesSubmittedCount: 0, reportsCompletedCount: 0, benchmarkReadyCount: 0 },
  showWelcomeBanner = false,
  profileCompleteness,
  certificationProgress,
  certificationResult,
}: {
  cases: CaseRow[];
  caseIdsWithUploads?: string[];
  participationApprovalStatus?: ParticipationApprovalStatus;
  participationSummary?: ParticipationSummary;
  showWelcomeBanner?: boolean;
  profileCompleteness?: ProfileCompleteness;
  certificationProgress?: CertificationProgress;
  certificationResult?: CertificationResult | null;
}) {
  const { t } = useI18n();
  const hasCase = cases.length > 0;
  const firstCase = cases[0] ?? null;
  const firstCaseId = firstCase?.id ?? null;
  const hasEvidence = caseIdsWithUploads.length > 0;
  const hasSubmission = cases.some(
    (c) => c.submitted_at != null || String(c.status ?? "") === "submitted"
  );

  const steps: OnboardingStep[] = useMemo(
    () => [
      {
        id: "create_case",
        label: t("dashboard.doctor.onboardingCreateCase"),
        done: hasCase,
        href: "",
        cta: t("dashboard.doctor.onboardingCreateCta"),
      },
      {
        id: "upload_evidence",
        label: t("dashboard.doctor.onboardingUpload"),
        done: hasEvidence,
        href: firstCaseId ? `/cases/${firstCaseId}/doctor/photos` : "/dashboard/doctor",
        cta: firstCaseId ? t("dashboard.doctor.onboardingUploadCta") : t("dashboard.doctor.onboardingUploadNoCase"),
      },
      {
        id: "complete_submission",
        label: t("dashboard.doctor.onboardingSubmit"),
        done: hasSubmission,
        href: firstCaseId ? `/cases/${firstCaseId}` : "/dashboard/doctor",
        cta: firstCaseId ? t("dashboard.doctor.onboardingSubmitCta") : t("dashboard.doctor.onboardingSubmitNoCase"),
      },
      {
        id: "learn_benchmarking",
        label: t("dashboard.doctor.onboardingBenchmark"),
        done: hasSubmission,
        href: "/leaderboards/doctors",
        cta: t("dashboard.doctor.onboardingBenchmarkCta"),
      },
    ],
    [t, hasCase, hasEvidence, hasSubmission, firstCaseId]
  );

  const showOnboarding = !hasSubmission || !hasCase || !hasEvidence;

  return (
    <div className="space-y-6">
      <ParticipationStatusBanner status={participationApprovalStatus} role="doctor" />

      {showWelcomeBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">
          <p className="font-medium">{t("dashboard.doctor.profileActiveTitle")}</p>
          <p className="mt-1 text-sm text-emerald-800">{t("dashboard.doctor.profileActiveBody")}</p>
        </div>
      )}

      {profileCompleteness && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileCompletenessCard
            title={t("dashboard.doctor.profileCompleteness")}
            percentage={profileCompleteness.percentage}
            doneCount={profileCompleteness.doneCount}
            totalChecks={profileCompleteness.totalChecks}
            nextActions={profileCompleteness.nextActions}
          />
          <NextBestStepPanel action={profileCompleteness.nextBestStep} />
        </div>
      )}

      {certificationProgress && (
        <div>
          <CertificationProgressCard progress={certificationProgress} certificationResult={certificationResult ?? undefined} />
        </div>
      )}

      {showOnboarding && (
        <DoctorOnboardingChecklist steps={steps} showWhyItMatters />
      )}

      <DoctorParticipationSummaryCard
        participationSummary={participationSummary}
        participationApprovalStatus={participationApprovalStatus}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{t("dashboard.doctor.workspaceTitle")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("dashboard.doctor.workspaceSubtitle")}</p>
        <p className="mt-1 text-xs text-slate-500">{BENCHMARKING_GLOBAL_STANDARDS}</p>
        <div className="mt-4">
          <CreateCaseButton variant="premium" dashboardHref="/dashboard/doctor" />
        </div>
      </section>

      <section id="your-cases">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t("dashboard.doctor.yourCases")}</h2>
        {!cases || cases.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center">
            <p className="text-slate-700 font-semibold">{t("dashboard.doctor.noCasesTitle")}</p>
            <p className="mt-1 text-sm text-slate-600">{t("dashboard.doctor.noCasesBody")}</p>
            <div className="mt-4">
              <CreateCaseButton variant="premium" label={t("dashboard.doctor.submitFirstCase")} dashboardHref="/dashboard/doctor" />
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {cases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cases/${c.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-cyan-300 hover:shadow-sm transition-all"
                >
                  <span className="font-medium text-slate-900">
                    {c.title ?? "Untitled case"}
                  </span>
                  <span className="ml-2 text-slate-500 text-sm capitalize">
                    — {c.status ?? "draft"}
                  </span>
                  <div className="text-xs text-slate-400 mt-2">
                    Created: {new Date(c.created_at).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
