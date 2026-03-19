/**
 * Renders a premium, printable HairAudit certification certificate layout.
 * Static v1: display-only, no persistence. Tier-based styling.
 * Platinum uses an institutional, wall-ready design; other tiers use the standard layout.
 */

import type { ReactNode } from "react";
import type { CertificateData, CertificateTier } from "./types";
import {
  getCertificationFullDescription,
  CERTIFICATION_TRUST_LINE,
} from "@/lib/clinics/certificationCopy";
import CertificationSeal from "@/components/certificates/CertificationSeal";

/** Institutional, print-safe tier styling for standard layout (Verified, Silver, Gold). */
const TIER_STYLES: Record<
  CertificateTier,
  {
    outerBorder: string;
    innerBorder: string;
    headerAccent: string;
    titleColor: string;
    nameplateBorder: string;
    bgFrom: string;
    bgTo: string;
    footerBorder: string;
    sigLine: string;
  }
> = {
  verified: {
    outerBorder: "border-slate-300 print:border-slate-400",
    innerBorder: "border-slate-200/80 print:border-slate-300",
    headerAccent: "text-slate-600",
    titleColor: "text-slate-800",
    nameplateBorder: "border-slate-200",
    bgFrom: "from-stone-50",
    bgTo: "to-slate-50/40",
    footerBorder: "border-slate-200/80",
    sigLine: "border-slate-300",
  },
  silver: {
    outerBorder: "border-slate-400/90 print:border-slate-500",
    innerBorder: "border-slate-300/70 print:border-slate-400",
    headerAccent: "text-slate-600",
    titleColor: "text-slate-800",
    nameplateBorder: "border-slate-300",
    bgFrom: "from-slate-50/95",
    bgTo: "to-stone-50/50",
    footerBorder: "border-slate-300/80",
    sigLine: "border-slate-400",
  },
  gold: {
    outerBorder: "border-amber-200/90 print:border-amber-300",
    innerBorder: "border-amber-100/80 print:border-amber-200",
    headerAccent: "text-amber-900/90",
    titleColor: "text-amber-950",
    nameplateBorder: "border-amber-200/90",
    bgFrom: "from-amber-50/30",
    bgTo: "to-stone-50/60",
    footerBorder: "border-amber-200/70",
    sigLine: "border-amber-300/90",
  },
  platinum: {
    outerBorder: "border-stone-300",
    innerBorder: "border-stone-200/90",
    headerAccent: "text-stone-600",
    titleColor: "text-stone-900",
    nameplateBorder: "border-stone-200/80",
    bgFrom: "from-stone-50",
    bgTo: "to-stone-100/30",
    footerBorder: "border-stone-200/80",
    sigLine: "border-stone-300",
  },
};

/** Title line for standard tiers (Platinum uses its own in renderPlatinumCertificate). */
const TIER_TITLE: Record<CertificateTier, string> = {
  verified: "VERIFIED CERTIFICATION",
  silver: "SILVER CERTIFICATION",
  gold: "GOLD CERTIFICATION",
  platinum: "PLATINUM CERTIFICATION",
};

const CERTIFICATE_LOGO_PATH = "/logos/hairaudit-logo.png";

/** Logo-based accreditation header: same for all tiers. Print-safe, institutional. */
function CertificateLogoHeader({
  accentClass = "text-stone-600",
  subClass = "text-stone-400",
}: {
  accentClass?: string;
  subClass?: string;
}) {
  return (
    <header className="text-center pb-3">
      <img
        src={CERTIFICATE_LOGO_PATH}
        alt="HairAudit"
        width={160}
        height={48}
        className="w-[140px] sm:w-[160px] md:w-[180px] h-auto mx-auto object-contain print:w-[160px] print:h-auto"
        style={{ minHeight: 32 }}
      />
      <p className={`mt-4 text-[10px] font-medium uppercase tracking-[0.2em] ${accentClass}`}>
        HairAudit Certification
      </p>
      <p className={`mt-1 text-[9px] ${subClass} tracking-[0.02em]`}>
        Independently verified surgical performance certification
      </p>
    </header>
  );
}

/** Subtle diagonal SAMPLE watermark: large, low opacity, embedded-in-paper feel; lighter than Platinum for standard tiers */
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
          ${isPlatinum ? "text-[10rem] text-stone-300/[0.14]" : "text-7xl sm:text-8xl text-slate-300/[0.08]"}
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
        rounded-sm border border-stone-300
        bg-gradient-to-b from-stone-50 to-stone-100/30
        shadow-[0_1px_3px_rgba(0,0,0,0.04)]
        print:shadow-none print:rounded-none print:bg-white print:border-stone-400
      `}
      style={{ maxWidth: "min(100%, 210mm)" }}
      role="img"
      aria-label={`HairAudit Platinum certification certificate for ${clinicName}`}
    >
      {isSample && <SampleWatermark variant="platinum" />}
      <CertificationSeal tier="platinum" />

      {/* Inner frame: thin, elegant */}
      <div className="relative z-0 flex-1 flex flex-col m-4 sm:m-5 md:m-6 border border-stone-200/90 print:border-stone-300 print:m-5">
        <div className="flex flex-col flex-1 p-6 sm:p-8 md:p-10 print:p-8">
          <CertificateLogoHeader accentClass="text-stone-600" subClass="text-stone-400" />

          {/* Title and subtitle: tight relationship */}
          <div className="mt-6 sm:mt-7 text-center">
            <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-stone-900">
              PLATINUM CERTIFICATION
            </h1>
            <p className="mt-1.5 text-[11px] font-normal uppercase tracking-wider text-stone-400">
              Certified Clinic
            </p>
          </div>

          {/* Clinic name: nameplate treatment */}
          <div className="mt-6 sm:mt-8 border-t border-b border-stone-200/80 py-7 sm:py-9">
            <p className="font-serif text-xl sm:text-2xl md:text-3xl font-semibold text-stone-900 text-center tracking-tight">
              {clinicName}
            </p>
          </div>

          {/* Supporting copy */}
          <p className="mt-6 text-xs text-stone-600 leading-relaxed max-w-md mx-auto text-center">
            {fullDescription}
          </p>

          {/* Score / case count: supporting layer only */}
          {(score != null || caseCount != null) && (
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-[10px] text-stone-400">
              {typeof score === "number" && (
                <span>Score: {score.toFixed(1)}/100</span>
              )}
              {typeof caseCount === "number" && (
                <span>Verified cases: {caseCount}</span>
              )}
            </div>
          )}

          <p className="mt-5 text-[10px] text-stone-500 uppercase tracking-wider text-center max-w-md mx-auto">
            {CERTIFICATION_TRUST_LINE}
          </p>

          {/* Signature block: ceremonial, understated */}
          <div className="mt-8 sm:mt-10 flex flex-col items-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
              Certified by
            </p>
            <div className="w-36 sm:w-44 mt-3 border-b border-stone-300" aria-hidden />
            <p className="mt-3 text-xs font-medium text-stone-700">
              HairAudit Certification Board
            </p>
            <p className="mt-2.5 text-[10px] text-stone-500">
              {issuedDate || "—"}
            </p>
          </div>

          {/* Footer: formal, traceable reference */}
          <div className="mt-auto pt-6 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-4 text-[10px] text-stone-500">
            <span>Issued: {issuedDate || "—"}</span>
            <span className="uppercase tracking-wider font-medium text-stone-600">
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

/** Standard certificate layout for Verified, Silver, Gold — aligned with Platinum structure, tier-specific styling */
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
  const titleLine = TIER_TITLE[tier];

  return (
    <div
      className={`
        certificate-layout certificate-layout--standard
        relative w-full flex flex-col overflow-hidden
        aspect-[210/297] max-h-[840px]
        print:aspect-auto print:min-h-[297mm] print:max-h-none
        rounded-sm border ${styles.outerBorder}
        bg-gradient-to-b ${styles.bgFrom} ${styles.bgTo}
        shadow-[0_1px_3px_rgba(0,0,0,0.04)]
        print:shadow-none print:rounded-none print:bg-white
      `}
      style={{ maxWidth: "min(100%, 210mm)" }}
      role="img"
      aria-label={`HairAudit ${titleLine} certificate for ${clinicName}`}
    >
      {isSample && <SampleWatermark variant="default" />}
      {tier !== "verified" && (
        <CertificationSeal tier={tier === "gold" ? "gold" : "silver"} />
      )}

      {/* Inner frame: thin, lighter than Platinum */}
      <div
        className={`relative z-0 flex-1 flex flex-col m-4 sm:m-5 md:m-6 border ${styles.innerBorder} print:m-5`}
      >
        <div className="flex flex-col flex-1 p-6 sm:p-8 md:p-10 print:p-8">
          <CertificateLogoHeader
            accentClass={styles.headerAccent}
            subClass="text-slate-500"
          />

          {/* Main title (tier-based) + Certified Clinic */}
          <div className="mt-6 sm:mt-7 text-center">
            <h1
              className={`font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight ${styles.titleColor}`}
            >
              {titleLine}
            </h1>
            <p className="mt-1.5 text-[11px] font-normal uppercase tracking-wider text-slate-400">
              Certified Clinic
            </p>
          </div>

          {/* Clinic name: prominent, slightly less dominant than Platinum */}
          <div
            className={`mt-6 sm:mt-8 border-t border-b ${styles.nameplateBorder} py-6 sm:py-8`}
          >
            <p
              className={`font-serif text-lg sm:text-xl md:text-2xl font-semibold ${styles.titleColor} text-center tracking-tight`}
            >
              {clinicName}
            </p>
          </div>

          {/* Certification statement */}
          <p className="mt-6 text-xs text-slate-600 leading-relaxed max-w-md mx-auto text-center">
            {fullDescription}
          </p>

          {/* Score + verified cases: minimal, secondary */}
          {(score != null || caseCount != null) && (
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-[10px] text-slate-400">
              {typeof score === "number" && (
                <span>Score: {score.toFixed(1)}/100</span>
              )}
              {typeof caseCount === "number" && (
                <span>Verified cases: {caseCount}</span>
              )}
            </div>
          )}

          <p className="mt-5 text-[10px] text-slate-500 uppercase tracking-wider text-center max-w-md mx-auto">
            {CERTIFICATION_TRUST_LINE}
          </p>

          {/* Signature block: same structure as Platinum, slightly lighter */}
          <div className="mt-8 sm:mt-10 flex flex-col items-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Certified by
            </p>
            <div
              className={`w-36 sm:w-44 mt-3 border-b ${styles.sigLine}`}
              aria-hidden
            />
            <p className="mt-3 text-xs font-medium text-slate-700">
              HairAudit Certification Board
            </p>
            <p className="mt-2.5 text-[10px] text-slate-500">
              {issuedDate || "—"}
            </p>
          </div>

          {/* Footer: certificate reference */}
          <div
            className={`mt-auto pt-6 border-t ${styles.footerBorder} flex flex-wrap items-center justify-between gap-4 text-[10px] text-slate-500`}
          >
            <span>Issued: {issuedDate || "—"}</span>
            <span className="uppercase tracking-wider font-medium text-slate-600">
              Certificate ref. {certificateId}
            </span>
          </div>
          <p className="mt-2 text-[9px] text-slate-400 text-center">
            Evidence-based recognition · Not purchased
          </p>
        </div>
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
