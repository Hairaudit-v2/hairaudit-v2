/**
 * Renders a premium, printable HairAudit certification certificate layout.
 * Static v1: display-only, no persistence. Tier-based styling.
 * Platinum uses an institutional, wall-ready design; other tiers use the standard layout.
 */

import type { ReactNode } from "react";
import type { CertificateData, CertificateTier } from "./types";
import {
  getCertificationFullDescription,
  getCertificationLabel,
  CERTIFICATION_TRUST_LINE,
} from "@/lib/clinics/certificationCopy";

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
    // Used only for non-Platinum layout fallback; Platinum has its own layout
    border: "border-stone-300",
    accent: "text-stone-600",
    labelBg: "bg-stone-200/80 border-stone-400",
    labelText: "text-stone-900",
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

/** Subtle diagonal SAMPLE watermark: large, low opacity, embedded-in-paper feel */
function SampleWatermark({ variant }: { variant: "default" | "platinum" }) {
  const isPlatinum = variant === "platinum";
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 overflow-hidden"
      aria-hidden
    >
      <span
        className={`
          font-semibold uppercase tracking-[0.2em]
          rotate-[-22deg] whitespace-nowrap
          ${isPlatinum ? "text-[10rem] text-stone-300/20" : "text-7xl sm:text-8xl text-white/[0.07]"}
        `}
      >
        Sample
      </span>
    </div>
  );
}

/** Platinum certificate: institutional, wall-ready layout */
function renderPlatinumCertificate(data: CertificateData): ReactNode {
  const {
    clinicName,
    score,
    caseCount,
    issuedAt,
    certificateId,
    isSample = false,
  } = data;
  const fullDescription = getCertificationFullDescription("PLATINUM", clinicName);
  const issuedDate = issuedAt
    ? new Date(issuedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div
      className={`
        certificate-layout certificate-layout--platinum
        relative w-full flex flex-col overflow-hidden
        aspect-[210/297] max-h-[840px]
        print:aspect-auto print:min-h-[297mm] print:max-h-none
        rounded-lg border-2 border-stone-300
        bg-stone-50 shadow-xl
        print:shadow-none print:rounded-none print:bg-white print:border-stone-400
      `}
      style={{ maxWidth: "min(100%, 210mm)" }}
      role="img"
      aria-label={`HairAudit Platinum certification certificate for ${clinicName}`}
    >
      {isSample && <SampleWatermark variant="platinum" />}

      {/* Inner frame */}
      <div className="relative z-0 flex-1 flex flex-col m-3 sm:m-4 md:m-5 border border-stone-300/80 print:border-stone-400 print:m-4">
        <div className="flex flex-col flex-1 p-6 sm:p-8 md:p-10 print:p-8">
          {/* Header: minimal */}
          <div className="text-center">
            <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-stone-500">
              HairAudit
            </p>
            <p className="mt-0.5 text-[9px] text-stone-400 uppercase tracking-widest">
              Independent Surgical Transparency Verification
            </p>
          </div>

          {/* Dominant: tier title */}
          <div className="mt-8 sm:mt-10 text-center">
            <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-stone-900">
              PLATINUM CERTIFICATION
            </h1>
            <p className="mt-2 text-sm font-medium uppercase tracking-widest text-stone-500">
              Certified Clinic
            </p>
          </div>

          {/* Second: clinic name */}
          <div className="mt-8 sm:mt-10 border-t border-b border-stone-300/70 py-6 sm:py-8">
            <p className="font-serif text-xl sm:text-2xl md:text-3xl font-semibold text-stone-900 text-center tracking-tight">
              {clinicName}
            </p>
          </div>

          {/* Supporting copy */}
          <p className="mt-6 text-xs text-stone-600 leading-relaxed max-w-md mx-auto text-center">
            {fullDescription}
          </p>

          {/* Score / case count: minimal, secondary */}
          {(score != null || caseCount != null) && (
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-[11px] text-stone-500">
              {typeof score === "number" && (
                <span>Score: {score.toFixed(1)}/100</span>
              )}
              {typeof caseCount === "number" && (
                <span>Verified cases: {caseCount}</span>
              )}
            </div>
          )}

          <p className="mt-6 text-[10px] text-stone-500 uppercase tracking-wider text-center max-w-md mx-auto">
            {CERTIFICATION_TRUST_LINE}
          </p>

          {/* Signature block */}
          <div className="mt-10 sm:mt-12 flex flex-col items-center">
            <p className="text-[10px] uppercase tracking-widest text-stone-500">
              Certified by
            </p>
            <div className="w-32 sm:w-40 mt-2 border-b border-stone-400" aria-hidden />
            <p className="mt-2 text-xs font-medium text-stone-700">
              HairAudit Certification Board
            </p>
            <p className="mt-2 text-[10px] text-stone-500">
              {issuedDate || "—"}
            </p>
          </div>

          {/* Footer: formal audit reference */}
          <div className="mt-auto pt-6 border-t border-stone-300/80 flex flex-wrap items-center justify-between gap-4 text-[10px] text-stone-500">
            <span>Issued: {issuedDate || "—"}</span>
            <span className="uppercase tracking-wider font-medium">
              Certificate ref. {certificateId}
            </span>
          </div>
          <p className="mt-2 text-[9px] text-stone-400 text-center">
            Evidence-based recognition · Not purchased
          </p>
        </div>
      </div>
    </div>
  );
}

/** Standard certificate layout for Verified, Silver, Gold */
function renderStandardCertificate(data: CertificateData): ReactNode {
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
  const backendTier =
    tier === "platinum"
      ? "PLATINUM"
      : tier === "gold"
        ? "GOLD"
        : tier === "silver"
          ? "SILVER"
          : "VERIFIED";
  const fullDescription = getCertificationFullDescription(backendTier, clinicName);
  const issuedDate = issuedAt
    ? new Date(issuedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div
      className={`
        certificate-layout relative w-full rounded-lg border-2 bg-gradient-to-b from-slate-900/95 to-slate-900/98
        text-white shadow-xl print:shadow-none print:rounded-none print:border-slate-600
        aspect-[210/297] max-h-[840px] flex flex-col overflow-hidden
        print:aspect-auto print:min-h-[297mm] print:max-h-none
        ${styles.border}
      `}
      style={{ maxWidth: "min(100%, 210mm)" }}
      role="img"
      aria-label={`HairAudit certification certificate for ${clinicName}`}
    >
      {isSample && <SampleWatermark variant="default" />}

      <div className="relative z-0 flex flex-col flex-1 p-6 sm:p-8 md:p-10 print:p-8">
        {/* Header */}
        <div className="text-center">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${styles.accent}`}
          >
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

export function renderCertificate(data: CertificateData): ReactNode {
  if (data.tier === "platinum") {
    return renderPlatinumCertificate(data);
  }
  return renderStandardCertificate(data);
}
