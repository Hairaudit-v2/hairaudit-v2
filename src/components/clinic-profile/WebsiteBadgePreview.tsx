/**
 * Website badge asset preview: how the certification badge could appear on a clinic website.
 * Display-only; uses BadgeWidget in a simple mock context.
 */

import BadgeWidget from "./BadgeWidget";
import type { AwardTier } from "@/lib/transparency/awardRules";

type WebsiteBadgePreviewProps = {
  clinicName: string;
  clinicSlug: string;
  currentAwardTier: string | null;
  participationStatus: string | null;
  baseUrl?: string;
};

export default function WebsiteBadgePreview({
  clinicName,
  clinicSlug,
  currentAwardTier,
  participationStatus,
  baseUrl = "",
}: WebsiteBadgePreviewProps) {
  return (
    <section className="relative px-4 sm:px-6 py-12 sm:py-16">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-4">
          Website badge preview
        </h2>
        <p className="text-sm text-slate-500 mb-4 max-w-2xl">
          How the certification badge could appear on your clinic website. Simple and professional.
        </p>
        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Example placement
          </p>
          <div className="inline-block rounded-lg border border-white/10 bg-white/5 p-4">
            <BadgeWidget
              clinicName={clinicName}
              clinicSlug={clinicSlug}
              currentAwardTier={currentAwardTier}
              participationStatus={participationStatus}
              variant="compact"
              style="dark"
              linkToProfile={false}
              baseUrl={baseUrl}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
