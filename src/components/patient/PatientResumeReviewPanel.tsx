"use client";

import Link from "next/link";
import PatientNewCasePathwayButtons from "@/components/patient/PatientNewCasePathwayButtons";
import type { PatientResumeReviewViewModel, PatientResumeStep } from "@/lib/patient/patientResumeReview";
import { cn } from "@/lib/utils";

const TOTAL_RESUME_STEPS = 4;

function activeProgressStep(step: PatientResumeStep): number {
  switch (step) {
    case "photos_incomplete":
      return 1;
    case "questions_incomplete":
      return 2;
    case "contact_pending":
      return 3;
    case "processing":
    case "report_ready":
      return 4;
    default:
      return 0;
  }
}

function otherCaseLabel(step: PatientResumeStep): string {
  switch (step) {
    case "photos_incomplete":
      return "Upload photos";
    case "questions_incomplete":
      return "Answer questions";
    case "contact_pending":
      return "Send report";
    case "processing":
      return "In progress";
    case "report_ready":
      return "Report ready";
    default:
      return "Review";
  }
}

export default function PatientResumeReviewPanel({
  model,
  className,
}: {
  model: PatientResumeReviewViewModel;
  className?: string;
}) {
  const progressStep = activeProgressStep(model.step);
  const showProgress = progressStep > 0 && model.step !== "report_ready";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8",
        className
      )}
      data-testid="patient-resume-review-panel"
      data-resume-step={model.step}
    >
      <div className="pointer-events-none absolute -top-20 -right-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-5">
        {model.pathwayLabel ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/90">{model.pathwayLabel}</p>
        ) : null}

        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">{model.headline}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-200/80 sm:text-base">{model.subtext}</p>
        </div>

        {showProgress ? (
          <div aria-label="Review progress" className="space-y-2">
            <div className="flex gap-2">
              {Array.from({ length: TOTAL_RESUME_STEPS }, (_, i) => {
                const stepNumber = i + 1;
                const done = stepNumber < progressStep;
                const active = stepNumber === progressStep;
                return (
                  <div
                    key={stepNumber}
                    className={cn(
                      "h-1.5 flex-1 rounded-full",
                      done ? "bg-emerald-400/80" : active ? "bg-cyan-300" : "bg-white/10"
                    )}
                  />
                );
              })}
            </div>
            {model.stepLabel ? (
              <p className="text-sm font-medium text-slate-200/90">{model.stepLabel}</p>
            ) : null}
          </div>
        ) : model.step === "report_ready" && model.stepLabel ? (
          <p className="text-sm font-medium text-emerald-200/90">{model.stepLabel}</p>
        ) : null}

        {model.photoProgress && model.step === "photos_incomplete" ? (
          <p className="text-sm text-slate-200/80">
            You have uploaded {model.photoProgress.completed} of {model.photoProgress.total} required photos.
          </p>
        ) : null}

        {model.step === "no_open_case" ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-200/90">Start a New Review</p>
            <PatientNewCasePathwayButtons variant="premium" layout="stack" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={model.primaryCtaHref}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:from-cyan-200 hover:to-emerald-200"
              data-testid="patient-resume-primary-cta"
            >
              {model.primaryCtaLabel}
            </Link>
          </div>
        )}

        <p className="text-xs leading-relaxed text-slate-300/70">{model.reassurance}</p>

        {model.otherCases.length > 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300/80">Other reviews</p>
            <ul className="mt-3 space-y-2">
              {model.otherCases.map((ctx) => (
                <li key={ctx.case.id}>
                  <Link
                    href={
                      ctx.step === "photos_incomplete"
                        ? `/cases/${ctx.case.id}/patient/photos`
                        : ctx.step === "questions_incomplete"
                          ? `/cases/${ctx.case.id}/patient/questions`
                          : ctx.step === "contact_pending"
                            ? `/cases/${ctx.case.id}/patient/contact`
                            : `/cases/${ctx.case.id}`
                    }
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition-colors hover:border-white/20 hover:bg-white/10"
                  >
                    <span className="font-medium">
                      {ctx.case.title?.trim() || "Hair transplant review"}
                    </span>
                    <span className="shrink-0 text-xs text-slate-300/80">{otherCaseLabel(ctx.step)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
