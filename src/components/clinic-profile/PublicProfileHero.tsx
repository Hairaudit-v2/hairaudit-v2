import Link from "next/link";
import CertificationBadge from "./CertificationBadge";
import CertificationExplainerLink from "./CertificationExplainerLink";
import TransparencyStatusBadge from "./TransparencyStatusBadge";
import type { AwardTier } from "@/lib/transparency/awardRules";

import { CERTIFICATION_TRUST_LINE } from "@/lib/clinics/certificationCopy";
const PATIENT_EXPLAINER =
  "Clinics that actively participate in HairAudit demonstrate transparency, quality assurance, and confidence in their work.";

type PublicProfileHeroProps = {
  clinicName: string;
  city?: string | null;
  country?: string | null;
  currentAwardTier: AwardTier | string | null;
  participationStatus: string | null | undefined;
  /** Public audited case count (audit_mode = 'public') */
  publicAuditedCaseCount?: number;
  /** Show Founding Clinic tag (display-only, e.g. for early adopters) */
  showFoundingTag?: boolean;
};

export default function PublicProfileHero({
  clinicName,
  city,
  country,
  currentAwardTier,
  participationStatus,
  publicAuditedCaseCount = 0,
  showFoundingTag = false,
}: PublicProfileHeroProps) {
  const location = [city, country].filter(Boolean).join(", ") || null;

  return (
    <header className="relative px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <CertificationBadge tier={(currentAwardTier ?? "VERIFIED") as AwardTier} variant="full" />
          {showFoundingTag && (
            <span className="inline-flex flex-col rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
              <span className="text-xs font-bold text-amber-200">Founding Clinic</span>
              <span className="text-[10px] text-amber-300/90">Early leader in global surgical transparency</span>
            </span>
          )}
          <TransparencyStatusBadge participationStatus={participationStatus} />
        </div>
        <div className="flex flex-wrap items-baseline gap-2 mb-4">
          <CertificationExplainerLink />
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
          {clinicName}
        </h1>
        {location && (
          <p className="mt-3 text-lg text-slate-400">{location}</p>
        )}

        {publicAuditedCaseCount > 0 && (
          <p className="mt-3 text-sm text-slate-300">
            <span className="font-medium text-white">{publicAuditedCaseCount}</span>{" "}
            {publicAuditedCaseCount === 1 ? "case" : "cases"} publicly verified
          </p>
        )}

        <p className="mt-4 text-slate-400 text-sm leading-relaxed max-w-2xl">
          {CERTIFICATION_TRUST_LINE}
        </p>
        <p className="mt-3 text-slate-400 text-sm leading-relaxed max-w-2xl">
          {PATIENT_EXPLAINER}
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/certification-explained"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-600 text-slate-200 text-sm font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
          >
            What this recognition means
          </Link>
          <Link
            href="/clinics"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-600 text-slate-200 text-sm font-medium hover:border-slate-500 hover:bg-white/5 transition-colors"
          >
            Explore More Clinics
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-slate-400 text-sm font-medium hover:text-slate-200 transition-colors"
          >
            ← HairAudit
          </Link>
        </div>
      </div>
    </header>
  );
}
