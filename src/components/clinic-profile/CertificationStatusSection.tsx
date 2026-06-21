/**
 * Certification detail area: tier, explanation, trust line.
 * Public profile only; display-only. Wording from @/lib/clinics/certificationCopy.
 */

import CertificationBadge from "./CertificationBadge";
import type { AwardTier } from "@/lib/transparency/awardRules";
import { CERTIFICATION_COPY, CERTIFICATION_TRUST_LINE } from "@/lib/clinics/certificationCopy";

const PARTICIPATION_MESSAGE =
  "Participating clinics demonstrate transparency, accountability, and confidence in their work. This is documentation of participation—not a HairAudit endorsement.";

type CertificationStatusSectionProps = {
  certificationTier: AwardTier | string | null;
  /** Engine-derived certification score (0–100). Only shown when a tier is present. */
  certificationScore?: number | null;
  /** Engine-derived count of eligible public cases. Only shown when a tier is present. */
  eligiblePublicCases?: number | null;
};

export default function CertificationStatusSection({
  certificationTier,
  certificationScore,
  eligiblePublicCases,
}: CertificationStatusSectionProps) {
  const tier = certificationTier as AwardTier | null;
  const hasTier = tier != null;
  const copy = hasTier ? (CERTIFICATION_COPY[tier as AwardTier] ?? CERTIFICATION_COPY.VERIFIED) : CERTIFICATION_COPY.VERIFIED;

  return (
    <section className="relative px-4 sm:px-6 py-12 sm:py-16">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-4">
          Certification Status
        </h2>
        <div className="rounded-2xl border border-border/50 bg-card/70 p-6 shadow-fi-panel sm:p-8">
          {!hasTier ? (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-bold bg-muted/50 text-muted-foreground border border-border/50">
                  No certification yet
                </span>
              </div>
              <p className="text-sm font-medium text-foreground max-w-2xl">
                This clinic has not yet built enough eligible public evidence to begin certification.
              </p>
              <p className="mt-4 text-xs text-muted-foreground max-w-2xl">
                {CERTIFICATION_TRUST_LINE}
              </p>
              <p className="mt-6 text-sm text-muted-foreground italic max-w-2xl">
                {PARTICIPATION_MESSAGE}
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <CertificationBadge tier={tier ?? "VERIFIED"} variant="full" />
              </div>
              <p className="text-sm font-medium text-foreground max-w-2xl">
                {copy.title}
              </p>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {copy.shortDescription}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 max-w-2xl">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Certification score
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {typeof certificationScore === "number" ? `${certificationScore.toFixed(1)}/100` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Eligible public cases
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {typeof eligiblePublicCases === "number" ? eligiblePublicCases : "—"}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground max-w-2xl">
                {CERTIFICATION_TRUST_LINE}
              </p>
              <p className="mt-6 text-sm text-muted-foreground italic max-w-2xl">
                {PARTICIPATION_MESSAGE}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
