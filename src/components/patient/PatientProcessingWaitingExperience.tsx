"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  maskNotificationEmail,
  resolvePatientProcessingTimeline,
  type PatientProcessingTimelineStage,
} from "@/lib/patient/patientProcessingView";

export type PatientProcessingWaitingExperienceProps = {
  caseStatus: string;
  hasReportPdf?: boolean;
  notificationEmail?: string | null;
  submittedAt?: string | null;
  variant?: "case" | "dashboard";
  showReturnLink?: boolean;
};

function stageLabelKey(stage: PatientProcessingTimelineStage): string {
  return `dashboard.patient.processing.timeline.${stage}`;
}

function StepIcon({ state }: { state: "complete" | "active" | "upcoming" }) {
  if (state === "complete") {
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
        <span className="absolute inset-0 rounded-full border border-cyan-300/40 bg-cyan-300/10" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.65)]" />
      </span>
    );
  }

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
      <span className="h-2 w-2 rounded-full bg-slate-500/80" />
    </span>
  );
}

export default function PatientProcessingWaitingExperience({
  caseStatus,
  hasReportPdf = false,
  notificationEmail,
  submittedAt,
  variant = "case",
  showReturnLink = true,
}: PatientProcessingWaitingExperienceProps) {
  const { t } = useI18n();
  const compact = variant === "dashboard";
  const timeline = resolvePatientProcessingTimeline({ caseStatus, hasReportPdf });
  const maskedEmail = maskNotificationEmail(notificationEmail);

  return (
    <div
      className={
        compact
          ? "relative overflow-hidden rounded-xl border border-cyan-300/20 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-950/80 p-4"
          : "relative overflow-hidden rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 sm:p-6"
      }
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/5 to-transparent" />

      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/90">
        {t("dashboard.patient.processing.eyebrow")}
      </p>
      <h2 className={compact ? "mt-1 text-base font-semibold text-white" : "mt-2 text-xl font-semibold text-white"}>
        {t("dashboard.patient.processing.title")}
      </h2>
      <p className={compact ? "mt-1 text-xs leading-relaxed text-slate-200/80" : "mt-2 text-sm leading-relaxed text-slate-200/85"}>
        {t("dashboard.patient.processing.lead")}
      </p>

      <ol className={compact ? "mt-4 space-y-3" : "mt-6 space-y-4"} aria-label={t("dashboard.patient.processing.timelineAria")}>
        {timeline.map((step, index) => (
          <li key={step.stage} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepIcon state={step.state} />
              {index < timeline.length - 1 ? (
                <span
                  className={`mt-1 w-px flex-1 ${step.state === "complete" ? "bg-emerald-300/30" : "bg-white/10"}`}
                  style={{ minHeight: compact ? 12 : 16 }}
                  aria-hidden="true"
                />
              ) : null}
            </div>
            <div className="pb-1 pt-0.5">
              <p
                className={
                  step.state === "active"
                    ? "text-sm font-semibold text-cyan-50"
                    : step.state === "complete"
                      ? "text-sm font-medium text-emerald-100/90"
                      : "text-sm font-medium text-slate-400"
                }
              >
                {t(stageLabelKey(step.stage))}
              </p>
              {step.state === "active" ? (
                <p className="mt-0.5 text-xs text-slate-300/80">{t(`${stageLabelKey(step.stage)}Hint`)}</p>
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
        {submittedAt ? (
          <p className="mt-1 text-xs text-slate-400">
            {t("dashboard.patient.processing.submittedAt")}{" "}
            {new Date(submittedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : null}
      </div>

      <p className={compact ? "mt-3 text-xs leading-relaxed text-slate-300/75" : "mt-4 text-sm leading-relaxed text-slate-300/80"}>
        {t("dashboard.patient.processing.reassurance")}
      </p>

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
