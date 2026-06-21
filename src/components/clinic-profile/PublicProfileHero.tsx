import Link from "next/link";
import CertificationBadge from "./CertificationBadge";
import CertificationExplainerLink from "./CertificationExplainerLink";
import TransparencyStatusBadge from "./TransparencyStatusBadge";
import type { AwardTier } from "@/lib/transparency/awardRules";

import { CERTIFICATION_TRUST_LINE } from "@/lib/clinics/certificationCopy";
import { cn } from "@/lib/utils";
import { networkButtonVariants } from "@/packages/ui";

const PATIENT_EXPLAINER =
  "Participating clinics contribute documentation for independent review. Profiles reflect transparency participation—not a HairAudit endorsement to choose a clinic.";

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

        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {clinicName}
        </h1>
        {location && (
          <p className="mt-3 text-lg text-muted-foreground">{location}</p>
        )}

        {publicAuditedCaseCount > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{publicAuditedCaseCount}</span>{" "}
            {publicAuditedCaseCount === 1 ? "case" : "cases"} publicly verified
          </p>
        )}

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground max-w-2xl">
          {CERTIFICATION_TRUST_LINE}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground max-w-2xl">
          {PATIENT_EXPLAINER}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/certification-explained"
            className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
          >
            What this recognition means
          </Link>
          <Link
            href="/clinics"
            className={cn(networkButtonVariants({ variant: "secondary", size: "md" }))}
          >
            Explore More Clinics
          </Link>
        </div>
      </div>
    </header>
  );
}
