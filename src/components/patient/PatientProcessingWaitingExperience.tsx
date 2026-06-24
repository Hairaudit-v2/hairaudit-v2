"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import PatientTrustBanner from "@/components/patient/PatientTrustBanner";
import { useI18n } from "@/components/i18n/I18nProvider";
import { usePatientCaseStatusPolling } from "@/hooks/usePatientCaseStatusPolling";
import {
  maskNotificationEmail,
  resolvePatientProcessingTimeline,
  type PatientProcessingTimelineStage,
  type PatientProcessingTimelineStepState,
} from "@/lib/patient/patientProcessingView";

export type PatientProcessingWaitingExperienceProps = {
  caseId: string;
  caseStatus: string;
  hasReportPdf?: boolean;
  notificationEmail?: string | null;
  submittedAt?: string | null;
  variant?: "case" | "dashboard";
  showReturnLink?: boolean;
  enablePolling?: boolean;
};

const AUTO_REDIRECT_DELAY_MS = 4000;

function stageLabelKey(stage: PatientProcessingTimelineStage): string {
  return `dashboard.patient.processing.timeline.${stage}`;
}

function StepIcon({ state }: { state: PatientProcessingTimelineStepState }) {
  if (state === "complete" || state === "ready") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-300/15 text-emerald-100">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3.25-3.25a1 1 0 1 1 1.414-1.414l2.543 2.543 6.543-6.543a1 1 0 0 1 1.408-.003Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }

  if (state === "active") {
    return (
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
        <span className="absolute inset-0 animate-pulse rounded-full border border-cyan-300/40 bg-cyan-300/10" />
        <span className="relative h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.65)]" />
      </span>
    );
  }

  if (state === "delayed") {
    return (
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-amber-300/40 bg-amber-300/10" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-amber-200 shadow-[0_0_10px_rgba(252,211,77,0.55)]" />
      </span>
    );
  }

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
      <span className="h-2 w-2 rounded-full bg-slate-500/80" />
    </span>
  );
}

function stepTextClass(state: PatientProcessingTimelineStepState): string {
  if (state === "ready" || state === "complete") return "text-sm font-medium text-emerald-100/90";
  if (state === "active") return "text-sm font-semibold text-cyan-50";
  if (state === "delayed") return "text-sm font-semibold text-amber-100";
  return "text-sm font-medium text-slate-400";
}

export default function PatientProcessingWaitingExperience({
  caseId,
  caseStatus,
  hasReportPdf = false,
  notificationEmail,
  submittedAt,
  variant = "case",
  showReturnLink = true,
  enablePolling = true,
}: PatientProcessingWaitingExperienceProps) {
  const { t } = useI18n();
  const router = useRouter();
  const compact = variant === "dashboard";
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialReportReady = caseStatus === "complete" && hasReportPdf;
  const { payload, isPolling, pollError } = usePatientCaseStatusPolling({
    caseId,
    caseStatus,
    hasReportPdf,
    notificationEmail,
    submittedAt,
    enabled: enablePolling && !initialReportReady,
    onReportReady: () => {
      if (variant === "case") {
        redirectTimeoutRef.current = setTimeout(() => {
          router.refresh();
        }, AUTO_REDIRECT_DELAY_MS);
      }
    },
  });

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current != null) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const reportReady = payload.reportReady;
  const trustTitle = payload.trustTitle;
  const trustSubcopy = payload.trustSubcopy;
  const showTrustBanner = payload.showTrustBanner;
  const timeline = reportReady
    ? payload.timeline
    : resolvePatientProcessingTimeline({
        caseStatus: payload.status || caseStatus,
        hasReportPdf: payload.reportReady || hasReportPdf,
        submittedAt: payload.submittedAt ?? submittedAt,
      });

  const maskedEmail = payload.maskedEmail ?? maskNotificationEmail(notificationEmail);
  const displaySubmittedAt = payload.submittedAt ?? submittedAt;
  const reportHref = payload.reportUrl ?? `/cases/${caseId}`;

  if (reportReady) {
    return (
      <div
        data-testid="patient-processing-timeline"
        data-processing-state="ready"
        className={
          compact
            ? "relative overflow-hidden rounded-xl border border-emerald-300/25 bg-gradient-to-br from-emerald-950/70 via-slate-900/80 to-slate-950/80 p-4"
            : "relative overflow-hidden rounded-2xl border border-emerald-300/30 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 p-5 sm:p-6"
        }
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-400/10 to-transparent" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/90">
          {t("dashboard.patient.processing.readyEyebrow")}
        </p>
        <h2 className={compact ? "mt-1 text-base font-semibold text-white" : "mt-2 text-xl font-semibold text-white"}>
          {t("dashboard.patient.processing.readyTitle")}
        </h2>
        <p className={compact ? "mt-1 text-xs leading-relaxed text-slate-200/85" : "mt-2 text-sm leading-relaxed text-slate-200/85"}>
          {t("dashboard.patient.processing.readyLead")}
        </p>
        <div className={compact ? "mt-4" : "mt-6"}>
          <Link
            href={reportHref}
            className={
              compact
                ? "inline-flex items-center rounded-lg px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200"
                : "inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200"
            }
          >
            {t("dashboard.patient.processing.viewReportCta")}
          </Link>
        </div>
        {variant === "case" ? (
          <p className={compact ? "mt-3 text-xs text-slate-300/75" : "mt-4 text-sm text-slate-300/80"}>
            {t("dashboard.patient.processing.autoRefreshHint")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-testid="patient-processing-timeline"
      data-processing-state="waiting"
      className={
        compact
          ? "relative overflow-hidden rounded-xl border border-cyan-300/20 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-950/80 p-4"
          : "relative overflow-hidden rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 sm:p-6"
      }
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/5 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/90">
            {t("dashboard.patient.processing.eyebrow")}
          </p>
          <h2 className={compact ? "mt-1 text-base font-semibold text-white" : "mt-2 text-xl font-semibold text-white"}>
          {trustTitle || t("dashboard.patient.processing.title")}
        </h2>
        </div>
        {isPolling ? (
          <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100/90">
            {t("dashboard.patient.processing.liveBadge")}
          </span>
        ) : null}
      </div>

      <p className={compact ? "mt-1 text-xs leading-relaxed text-slate-200/80" : "mt-2 text-sm leading-relaxed text-slate-200/85"}>
        {trustSubcopy || t("dashboard.patient.processing.lead")}
      </p>

      {showTrustBanner ? (
        <div className={compact ? "mt-3" : "mt-4"}>
          <PatientTrustBanner compact={compact} />
        </div>
      ) : null}

      {pollError ? (
        <p className={compact ? "mt-2 text-xs text-cyan-100/80" : "mt-3 text-sm text-cyan-100/85"} role="status">
          {trustSubcopy}
        </p>
      ) : null}

      <p className={compact ? "mt-2 text-xs text-cyan-100/80" : "mt-3 text-sm text-cyan-100/85"}>
        {t("dashboard.patient.processing.etaTypical")}
      </p>

      <ol className={compact ? "mt-4 space-y-2.5" : "mt-6 space-y-3.5"} aria-label={t("dashboard.patient.processing.timelineAria")}>
        {timeline.map((step, index) => (
          <li key={step.stage} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepIcon state={step.state} />
              {index < timeline.length - 1 ? (
                <span
                  className={`mt-1 w-px flex-1 ${
                    step.state === "complete" || step.state === "ready" ? "bg-emerald-300/30" : "bg-white/10"
                  }`}
                  style={{ minHeight: compact ? 10 : 14 }}
                  aria-hidden="true"
                />
              ) : null}
            </div>
            <div className="pb-1 pt-0.5">
              <p className={stepTextClass(step.state)}>{t(stageLabelKey(step.stage))}</p>
              {step.state === "active" || step.state === "delayed" ? (
                <p className="mt-0.5 text-xs text-slate-300/80">
                  {t(
                    step.state === "delayed"
                      ? `${stageLabelKey(step.stage)}DelayedHint`
                      : `${stageLabelKey(step.stage)}Hint`
                  )}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div
        className={
          compact
            ? "mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5"
            : "mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5"
        }
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {t("dashboard.patient.processing.emailEyebrow")}
        </p>
        <p className="mt-1 text-sm text-slate-100">
          {maskedEmail
            ? t("dashboard.patient.processing.emailConfirmed").replace("{{email}}", maskedEmail)
            : t("dashboard.patient.processing.emailFallback")}
        </p>
        {displaySubmittedAt ? (
          <p className="mt-1 text-xs text-slate-400">
            {t("dashboard.patient.processing.submittedAt")}{" "}
            {new Date(displaySubmittedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : null}
      </div>

      <div className={compact ? "mt-3 space-y-1.5" : "mt-4 space-y-2"}>
        <p className={compact ? "text-xs leading-relaxed text-slate-300/75" : "text-sm leading-relaxed text-slate-300/80"}>
          {t("dashboard.patient.processing.reassuranceClosePage")}
        </p>
        <p className={compact ? "text-xs leading-relaxed text-slate-300/75" : "text-sm leading-relaxed text-slate-300/80"}>
          {t("dashboard.patient.processing.reassuranceAutoOpen")}
        </p>
      </div>

      {showReturnLink ? (
        <div className={compact ? "mt-3" : "mt-5"}>
          <Link
            href="/dashboard/patient"
            className={
              compact
                ? "text-xs font-medium text-cyan-200 hover:text-cyan-100"
                : "text-sm font-medium text-cyan-200 hover:text-cyan-100"
            }
          >
            {t("dashboard.patient.nextAction.returnToDashboard")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
