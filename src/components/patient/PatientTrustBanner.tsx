"use client";

import {
  PATIENT_TRUST_BANNER_COPY,
  type PatientTrustStatusTranslation,
} from "@/lib/patient/patientTrustStatusTranslator";

export type PatientTrustBannerProps = {
  /** Optional status-specific title/subcopy above the standard banner. */
  status?: Pick<PatientTrustStatusTranslation, "title" | "subcopy">;
  compact?: boolean;
  className?: string;
};

/**
 * Visible trust banner for non-completed patient case states (HA-TRUST-4).
 */
export default function PatientTrustBanner({
  status,
  compact = false,
  className = "",
}: PatientTrustBannerProps) {
  return (
    <div
      data-testid="patient-trust-banner"
      className={
        compact
          ? `rounded-lg border border-cyan-300/15 bg-cyan-300/5 px-3 py-3 ${className}`
          : `rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-slate-950/80 px-4 py-4 sm:px-5 sm:py-5 ${className}`
      }
      role="status"
      aria-live="polite"
    >
      {status ? (
        <div className={compact ? "mb-2" : "mb-3"}>
          <p className={compact ? "text-sm font-semibold text-cyan-50" : "text-base font-semibold text-white"}>
            {status.title}
          </p>
          <p className={compact ? "mt-0.5 text-xs leading-relaxed text-slate-200/85" : "mt-1 text-sm leading-relaxed text-slate-200/85"}>
            {status.subcopy}
          </p>
        </div>
      ) : null}

      <div className="border-t border-cyan-300/10 pt-3">
        <p className={compact ? "text-xs font-medium text-cyan-100/90" : "text-sm font-medium text-cyan-100/90"}>
          {PATIENT_TRUST_BANNER_COPY.headline}
        </p>
        <p className={compact ? "mt-1.5 text-xs leading-relaxed text-slate-300/80" : "mt-2 text-sm leading-relaxed text-slate-300/80"}>
          {PATIENT_TRUST_BANNER_COPY.body}
        </p>
        <p className={compact ? "mt-1 text-xs text-slate-400/80" : "mt-1.5 text-sm text-slate-400/80"}>
          {PATIENT_TRUST_BANNER_COPY.patience}
        </p>
        <p className={compact ? "mt-1 text-xs text-slate-400/80" : "mt-1.5 text-sm text-slate-400/80"}>
          {PATIENT_TRUST_BANNER_COPY.thanks}
        </p>
      </div>
    </div>
  );
}
