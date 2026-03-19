/**
 * Certification detail area: tier, explanation, trust line.
 * Public profile only; display-only. Wording from @/lib/clinics/certificationCopy.
 */

import CertificationBadge from "./CertificationBadge";
import type { AwardTier } from "@/lib/transparency/awardRules";
import { CERTIFICATION_COPY, CERTIFICATION_TRUST_LINE } from "@/lib/clinics/certificationCopy";

const PARTICIPATION_MESSAGE =
  "Participating clinics demonstrate transparency, accountability, and confidence in their work.";

type CertificationStatusSectionProps = {
  certificationTier: AwardTier | string | null;
};

export default function CertificationStatusSection({
  certificationTier,
}: CertificationStatusSectionProps) {
  const tier = (certificationTier ?? "VERIFIED") as AwardTier;
  const copy = CERTIFICATION_COPY[tier] ?? CERTIFICATION_COPY.VERIFIED;

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
          <p className="text-sm font-medium text-slate-200 max-w-2xl">
            {copy.title}
          </p>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed max-w-2xl">
            {copy.shortDescription}
          </p>
          <p className="mt-4 text-xs text-slate-500 max-w-2xl">
            {CERTIFICATION_TRUST_LINE}
          </p>
          <p className="mt-6 text-sm text-slate-400 italic max-w-2xl">
            {PARTICIPATION_MESSAGE}
          </p>
        </div>
      </div>
    </section>
  );
}
