/**
 * Renders a premium, printable HairAudit certification certificate layout.
 * Static v1: display-only, no persistence. Tier-based styling.
 */

import type { ReactNode } from "react";
import type { CertificateData, CertificateTier } from "./types";
import { getCertificationFullDescription, getCertificationLabel } from "@/lib/clinics/certificationCopy";
import { CERTIFICATION_TRUST_LINE } from "@/lib/clinics/certificationCopy";

const TIER_STYLES: Record<
  CertificateTier,
  { border: string; accent: string; labelBg: string; labelText: string }
> = {
  verified: {
    border: "border-cyan-500/30",
    accent: "text-cyan-400",
    labelBg: "bg-cyan-500/15 border-cyan-500/40",
    labelText: "text-cyan-200",
  },
  silver: {
    border: "border-slate-400/40",
    accent: "text-slate-300",
    labelBg: "bg-slate-500/20 border-slate-400/50",
    labelText: "text-slate-200",
  },
  gold: {
    border: "border-amber-500/40",
    accent: "text-amber-400",
    labelBg: "bg-amber-500/20 border-amber-500/50",
    labelText: "text-amber-200",
  },
  platinum: {
    border: "border-amber-400/50",
    accent: "text-amber-300",
    labelBg: "bg-amber-500/25 border-amber-400/60",
    labelText: "text-amber-100",
  },
};

/** Map CertificateTier to backend label (Active, Silver Certified, etc.) */
function tierToBackendLabel(tier: CertificateTier): string {
  const map: Record<CertificateTier, string> = {
    verified: "VERIFIED",
    silver: "SILVER",
    gold: "GOLD",
    platinum: "PLATINUM",
  };
  return getCertificationLabel(map[tier]);
}

export function renderCertificate(data: CertificateData): ReactNode {
  const {
    clinicName,
    tier,
    score,
    caseCount,
    issuedAt,
    certificateId,
    isSample = false,
  } = data;
  const styles = TIER_STYLES[tier];
  const label = tierToBackendLabel(tier);
  const backendTier = tier === "platinum" ? "PLATINUM" : tier === "gold" ? "GOLD" : tier === "silver" ? "SILVER" : "VERIFIED";
  const fullDescription = getCertificationFullDescription(backendTier, clinicName);
  const issuedDate = issuedAt ? new Date(issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div
      className={`
        relative w-full rounded-lg border-2 bg-gradient-to-b from-slate-900/95 to-slate-900/98
        text-white shadow-xl print:shadow-none print:rounded-none print:border-slate-600
        aspect-[210/297] max-h-[840px] flex flex-col overflow-hidden
        ${styles.border}
      `}
      style={{ maxWidth: "min(100%, 210mm)" }}
      role="img"
      aria-label={`HairAudit certification certificate for ${clinicName}`}
    >
      {/* SAMPLE watermark */}
      {isSample && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10"
          aria-hidden
        >
          <span className="text-6xl sm:text-7xl font-bold text-white/10 rotate-[-20deg] tracking-widest uppercase">
            Sample
          </span>
        </div>
      )}

      <div className="relative z-0 flex flex-col flex-1 p-6 sm:p-8 md:p-10 print:p-8">
        {/* Header */}
        <div className="text-center">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${styles.accent}`}>
            HairAudit
          </p>
          <p className="mt-1 text-[10px] text-slate-500 uppercase tracking-widest">
            Independent Surgical Transparency Verification
          </p>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col justify-center mt-6 sm:mt-8">
          <div className="border-t border-b border-white/15 py-6 sm:py-8">
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight text-center">
              {clinicName}
            </p>
            <p
              className={`
                mt-4 inline-flex mx-auto rounded-xl border px-5 py-2.5 text-sm font-bold
                ${styles.labelBg} ${styles.labelText}
              `}
            >
              {label}
            </p>
          </div>

          <p className="mt-6 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto text-center">
            {fullDescription}
          </p>

          {(score != null || caseCount != null) && (
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs text-slate-500">
              {typeof score === "number" && (
                <span>Certification score: {score.toFixed(1)}/100</span>
              )}
              {typeof caseCount === "number" && (
                <span>Eligible public cases: {caseCount}</span>
              )}
            </div>
          )}

          <p className="mt-6 text-[10px] text-slate-500 uppercase tracking-wider text-center">
            {CERTIFICATION_TRUST_LINE}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-[10px] text-slate-500">
          <span>Issued: {issuedDate || "—"}</span>
          <span className="uppercase tracking-wider">ID: {certificateId}</span>
        </div>
        <p className="mt-2 text-[10px] text-slate-600 text-center">
          Evidence-based recognition · Not purchased
        </p>
      </div>
    </div>
  );
}
