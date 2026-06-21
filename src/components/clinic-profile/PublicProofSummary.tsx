/**
 * Compact proof summary: public case count, certification, founding status.
 * Public-UI only; no internal data.
 */

import CertificationBadge from "./CertificationBadge";
import type { AwardTier } from "@/lib/transparency/awardRules";

type PublicProofSummaryProps = {
  publicCaseCount: number;
  certificationTier: AwardTier | string | null;
  showFoundingTag?: boolean;
};

export default function PublicProofSummary({
  publicCaseCount,
  certificationTier,
  showFoundingTag = false,
}: PublicProofSummaryProps) {
  return (
    <section className="relative px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-xl border border-border/50 bg-card/70 p-5 shadow-fi-panel flex flex-wrap items-center gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Publicly verified cases
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">{publicCaseCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Certification
            </p>
            <div className="mt-1">
              <CertificationBadge tier={certificationTier} variant="compact" />
            </div>
          </div>
          {showFoundingTag && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
              <p className="text-xs font-bold text-amber-200">Founding Clinic</p>
              <p className="text-[10px] text-amber-300/90">Early leader in global surgical transparency</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
