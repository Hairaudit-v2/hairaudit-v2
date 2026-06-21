import type { IntelligenceModule } from "@/content/platformProgress";
import ProgressStatusBadge from "@/components/platform/ProgressStatusBadge";

type IntelligenceModuleCardProps = {
  module: IntelligenceModule;
};

export default function IntelligenceModuleCard({ module }: IntelligenceModuleCardProps) {
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-border/50 bg-card/70 p-5 shadow-fi-panel transition-colors hover:border-border/80 hover:bg-card/80 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold leading-snug text-foreground">{module.name}</h3>
        <ProgressStatusBadge status={module.status} />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{module.description}</p>

      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-[0.14em]">{module.stage}</span>
          <span className="font-display text-sm font-semibold tabular-nums text-foreground">
            {module.completionPercent}%
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={module.completionPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${module.name} completion`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-300/90 via-sky-300/90 to-emerald-300/90 transition-[width] duration-500"
            style={{ width: `${module.completionPercent}%` }}
          />
        </div>
      </div>
    </article>
  );
}
