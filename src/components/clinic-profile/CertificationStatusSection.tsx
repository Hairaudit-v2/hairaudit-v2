/**
 * Certification detail area: tier, explanation, trust line.
 * Public profile only; display-only.
 */

import CertificationBadge from "./CertificationBadge";
import type { AwardTier } from "@/lib/transparency/awardRules";

const TRUST_LINE =
  "Based on independently audited surgical data and verified case submissions.";

const PARTICIPATION_MESSAGE =
  "Participating clinics demonstrate transparency, accountability, and confidence in their work.";

const TIER_EXPLANATIONS: Record<string, string> = {
  PLATINUM:
    "Highest recognition for sustained transparency, documentation quality, and performance across verified cases.",
  GOLD:
    "High recognition for documentation quality, audit consistency, and validated participation.",
  SILVER:
    "Recognised for consistent transparency and validated participation in the HairAudit ecosystem.",
  VERIFIED:
    "Participating clinic with verified case submissions and a commitment to transparency.",
};

type CertificationStatusSectionProps = {
  certificationTier: AwardTier | string | null;
};

export default function CertificationStatusSection({
  certificationTier,
}: CertificationStatusSectionProps) {
  const tier = (certificationTier ?? "VERIFIED") as AwardTier;
  const explanation = TIER_EXPLANATIONS[tier] ?? TIER_EXPLANATIONS.VERIFIED;

  return (
    <section className="relative px-4 sm:px-6 py-12 sm:py-16">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-4">
          Certification Status
        </h2>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <CertificationBadge tier={tier} variant="full" />
          </div>
          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
            {explanation}
          </p>
          <p className="mt-4 text-xs text-slate-500 max-w-2xl">
            {TRUST_LINE}
          </p>
          <p className="mt-6 text-sm text-slate-400 italic max-w-2xl">
            {PARTICIPATION_MESSAGE}
          </p>
        </div>
      </div>
    </section>
  );
}
