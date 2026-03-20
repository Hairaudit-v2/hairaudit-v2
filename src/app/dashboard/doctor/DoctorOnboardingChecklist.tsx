"use client";

import Link from "next/link";
import CreateCaseButton from "../create-case-button";
import { useI18n } from "@/components/i18n/I18nProvider";

export type OnboardingStep = {
  id: string;
  label: string;
  done: boolean;
  href: string;
  cta: string;
};

type DoctorOnboardingChecklistProps = {
  steps: OnboardingStep[];
  showWhyItMatters?: boolean;
};

function CheckIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600" aria-hidden>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-slate-400" aria-hidden>
      <span className="h-2 w-2 rounded-full bg-slate-300" />
    </span>
  );
}

export default function DoctorOnboardingChecklist({
  steps,
  showWhyItMatters = true,
}: DoctorOnboardingChecklistProps) {
  const { t } = useI18n();
  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-label={t("dashboard.doctor.checklistTitle")}
    >
      <h2 className="text-lg font-semibold text-slate-900">{t("dashboard.doctor.checklistTitle")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("dashboard.doctor.checklistSubtitle")}</p>

      <ul className="mt-5 space-y-4" role="list">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3">
            <CheckIcon done={step.done} />
            <div className="min-w-0 flex-1">
              <span className={`font-medium ${step.done ? "text-slate-500 line-through" : "text-slate-900"}`}>
                {step.label}
              </span>
              {!step.done && (
                <div className="mt-1.5">
                  {step.id === "create_case" ? (
                    <CreateCaseButton variant="premium" className="!text-sm" dashboardHref="/dashboard/doctor" />
                  ) : (
                    <Link
                      href={step.href}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-600 hover:text-cyan-700"
                    >
                      {step.cta}
                      <span aria-hidden>→</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {showWhyItMatters && (
        <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <p className="text-sm text-slate-700">
            <strong className="font-medium text-slate-800">{t("dashboard.doctor.whyMattersLead")}</strong>{" "}
            {t("dashboard.doctor.whyMattersBody")}
          </p>
        </div>
      )}
    </section>
  );
}
