import CertificationBadge from "./CertificationBadge";
import type { AwardTier } from "@/lib/transparency/awardRules";

type RecognitionPanelProps = {
  currentAwardTier: AwardTier | string | null;
  nextMilestone: string | null;
  participationStatus: string | null | undefined;
};

export default function RecognitionPanel({
  currentAwardTier,
  nextMilestone,
  participationStatus,
}: RecognitionPanelProps) {
  const tier = (currentAwardTier ?? "VERIFIED") as AwardTier;
  const isActive =
    participationStatus === "high_transparency" || participationStatus === "active";

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
        Recognition
      </h2>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs text-slate-500">Certification level</p>
          <div className="mt-1">
            <CertificationBadge tier={tier} variant="full" />
          </div>
        </div>
        {isActive && (
          <span className="rounded-lg bg-cyan-500/15 border border-cyan-500/25 px-3 py-1.5 text-xs font-medium text-cyan-200">
            Active transparency participant
          </span>
        )}
      </div>
      <p className="mt-5 text-sm text-slate-400 leading-relaxed">
        This recognition reflects validated participation, documentation quality, and consistent
        performance across reviewed cases.
      </p>
      {nextMilestone && (
        <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
            Next milestone
          </p>
          <p className="mt-2 text-sm text-cyan-100/90">{nextMilestone}</p>
        </div>
      )}
    </section>
  );
}
