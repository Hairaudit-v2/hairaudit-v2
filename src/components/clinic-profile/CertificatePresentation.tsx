/**
 * Certificate-style presentation: clinic name, tier, HairAudit branding, recognition statement.
 * Display-only; suitable for wall certificate preview, future PDF, or share.
 */

import { CERTIFICATION_LABELS } from "./CertificationBadge";
import type { AwardTier } from "@/lib/transparency/awardRules";

const RECOGNITION_STATEMENT =
  "This clinic has participated in HairAudit independent audit and transparency verification. Recognition is based on documented case contribution and validated outcomes.";

type CertificatePresentationProps = {
  clinicName: string;
  certificationTier: AwardTier | string | null;
  /** Optional location for certificate display */
  location?: string | null;
};

export default function CertificatePresentation({
  clinicName,
  certificationTier,
  location,
}: CertificatePresentationProps) {
  const tier = (certificationTier ?? "VERIFIED") as AwardTier;
  const label = CERTIFICATION_LABELS[tier] ?? "Active";

  return (
    <div
      className="rounded-2xl border-2 border-white/20 bg-gradient-to-b from-white/10 to-white/5 p-8 sm:p-10 text-center shadow-xl"
      role="img"
      aria-label="HairAudit certification certificate"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-400/90">
        HairAudit
      </p>
      <p className="mt-2 text-xs text-slate-500 uppercase tracking-widest">
        Independent Surgical Transparency Verification
      </p>
      <div className="mt-8 mb-6 border-t border-b border-white/15 py-6">
        <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          {clinicName}
        </p>
        {location && (
          <p className="mt-1 text-sm text-slate-400">{location}</p>
        )}
        <p className="mt-4 inline-flex rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-2 text-sm font-bold text-cyan-200">
          {label} Certification
        </p>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
        {RECOGNITION_STATEMENT}
      </p>
      <p className="mt-6 text-[10px] text-slate-500 uppercase tracking-wider">
        Evidence-based recognition · Not purchased
      </p>
    </div>
  );
}
