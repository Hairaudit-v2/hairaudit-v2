/**
 * HA-PATHWAY-FIX-2 — Pre-surgery patient case dashboard body.
 * Mounted only when cases.patient_review_pathway === pre_surgery.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import SubmitButton from "@/app/cases/[caseId]/submit-button";
import DownloadReport from "@/app/cases/[caseId]/download-report";
import InviteClinicContributionCard from "@/components/case/InviteClinicContributionCard";
import PatientNextActionPanel from "@/components/patient/PatientNextActionPanel";
import PreSurgeryPlanningAssessmentCard from "@/components/patient/PreSurgeryPlanningAssessmentCard";
import type { PatientInfoRequestDisplay } from "@/components/patient/PatientNextActionPanel";
import type { PatientCaseDashboardViewModel } from "@/lib/patient/patientCaseDashboard";
import { resolvePatientPhotoSatisfactionFromUploads } from "@/lib/patient/patientPhotoSatisfaction";
import {
  PATHWAY_EVIDENCE_PACKS,
  resolvePathwayPhotoSlotDef,
} from "@/lib/patient/patientReviewPathway";

export type PatientPreSurgeryCaseDashboardProps = {
  model: PatientCaseDashboardViewModel;
  caseId: string;
  caseStatus: string;
  submittedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  statusDisplayLabel: string;
  statusPillClass: string;
  pdfPath?: string | null;
  reportId?: string;
  notificationEmail?: string | null;
  patientInfoRequest?: PatientInfoRequestDisplay | null;
  uploads: Array<{ type?: string | null }>;
  /** When report content is delivered, show assessment as ready framing. */
  reportReady?: boolean;
  children?: ReactNode;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : "—";
}

export default function PatientPreSurgeryCaseDashboard({
  model,
  caseId,
  caseStatus,
  submittedAt,
  createdAt,
  updatedAt,
  statusDisplayLabel,
  statusPillClass,
  pdfPath,
  reportId,
  notificationEmail,
  patientInfoRequest,
  uploads,
  reportReady = false,
  children,
}: PatientPreSurgeryCaseDashboardProps) {
  const pack = PATHWAY_EVIDENCE_PACKS.pre_surgery;
  const satisfaction = resolvePatientPhotoSatisfactionFromUploads(uploads, {
    pathway: "pre_surgery",
    requiredKeys: pack.requiredPhotoKeys,
  });

  return (
    <>
      <section className="relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{model.headerEyebrow}</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">{model.headerTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">{model.headerDescription}</p>
              {model.pathwayLabel ? (
                <p className="mt-3 inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100">
                  {model.pathwayLabel}
                </p>
              ) : null}
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${statusPillClass}`}>
              {statusDisplayLabel}
            </span>
          </div>

          <PatientNextActionPanel
            status={caseStatus}
            caseId={caseId}
            pdfPath={pdfPath}
            reportId={reportId}
            variant="case"
            notificationEmail={notificationEmail}
            submittedAt={submittedAt}
            patientInfoRequest={patientInfoRequest}
            patientReviewPathway="pre_surgery"
            dashboardNextAction={model.nextAction}
          />

          {children}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="pre-surgery-case-summary">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Case reference</p>
              <p className="mt-1 truncate font-mono text-sm text-slate-100">{caseId}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Review type</p>
              <p className="mt-1 text-sm text-slate-100">{model.pathwayLabel ?? "Pre-Surgery Review"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
              <p className="mt-1 text-sm text-slate-100">{statusDisplayLabel}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Created date</p>
              <p className="mt-1 text-sm text-slate-100">{formatDate(createdAt)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Last updated</p>
              <p className="mt-1 text-sm text-slate-100">{formatDate(updatedAt ?? submittedAt ?? createdAt)}</p>
            </div>
          </div>

          {model.nextAction.id === "submit_review" ? (
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm">
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Submit</p>
              <SubmitButton
                caseId={caseId}
                caseStatus={caseStatus}
                submittedAt={submittedAt}
                compact
                patientReviewPathway="pre_surgery"
                submitLabel={model.submitLabel}
                resubmitLabel={model.submitResubmitLabel}
                whatHappensNext={model.submitWhatHappensNext}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-6" data-testid="pre-surgery-photo-evidence">
        <h2 className="text-lg font-semibold text-white">Photo evidence</h2>
        <p className="mt-1 text-sm text-slate-300">
          Required planning photos for your Pre-Surgery Review
          {model.photoProgress
            ? ` (${model.photoProgress.completedCount}/${model.photoProgress.totalRequired} complete)`
            : ""}
          .
        </p>
        <ul className="mt-4 space-y-2">
          {pack.requiredPhotoKeys.map((key) => {
            const done = satisfaction.satisfiedKeys.has(key);
            const label = resolvePathwayPhotoSlotDef("pre_surgery", key)?.title ?? key;
            return (
              <li
                key={key}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm"
              >
                <span className="text-slate-100">{label}</span>
                <span className={done ? "text-emerald-300" : "text-amber-200"}>
                  {done ? "Uploaded" : "Needed"}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/cases/${caseId}/patient/photos`}
            className="inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/25"
          >
            {model.photoProgress?.isComplete ? "Review Uploaded Photos" : "Complete Your Photos"}
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-6" data-testid="pre-surgery-questions">
        <h2 className="text-lg font-semibold text-white">{model.questionnaireLabel}</h2>
        <p className="mt-1 text-sm text-slate-300">
          {model.questionsComplete
            ? "Your pre-surgery questions are complete."
            : "Answer planning questions about your goals and hair-loss history."}
        </p>
        <div className="mt-4">
          <Link
            href={`/cases/${caseId}/patient/questions`}
            className="inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/25"
          >
            {model.questionsComplete ? "Review Questions" : "Continue Questions"}
          </Link>
        </div>
      </section>

      <InviteClinicContributionCard
        caseId={caseId}
        patientReviewPathway="pre_surgery"
        title={model.clinicContributionTitle}
        body={model.clinicContributionBody}
        allowSkip
      />

      <PreSurgeryPlanningAssessmentCard reportReady={reportReady} />

      <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-6" data-testid="pre-surgery-report-card">
        <h2 className="text-lg font-semibold text-white">{model.reportCardTitle}</h2>
        <p className="mt-2 text-sm text-slate-300">{model.reportCardPendingText}</p>
        {reportReady && reportId && pdfPath ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/cases/${caseId}`}
              className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300"
            >
              View Pre-Surgery Review Report
            </Link>
            <DownloadReport reportId={reportId} label="Download PDF" />
          </div>
        ) : null}
      </section>
    </>
  );
}
