import Link from "next/link";
import { ArrowRight, Activity } from "lucide-react";

import { INTELLIGENCE_MODULES } from "@/content/platformProgress";
import { cn } from "@/lib/utils";
import { Badge, Section, networkButtonVariants } from "@/packages/ui";

function averageModuleCompletion(): number {
  return Math.round(
    INTELLIGENCE_MODULES.reduce((sum, m) => sum + m.completionPercent, 0) / INTELLIGENCE_MODULES.length
  );
}

export default function PlatformProgressTeaser() {
  const avgCompletion = averageModuleCompletion();
  const liveCount = INTELLIGENCE_MODULES.filter((m) => m.status === "Live" || m.status === "Production").length;

  return (
    <Section className="border-t border-border/30" aria-labelledby="platform-progress-teaser-heading">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-4">
          <Badge tone="accent">
            <span className="inline-flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              Platform engineering
            </span>
          </Badge>
          <h2
            id="platform-progress-teaser-heading"
            className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Built as living medical intelligence
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            HairAudit publishes engineering progress in public — intelligence modules, patient experience work, and
            shipped milestones for independent hair restoration review.
          </p>
          <Link
            href="/platform/progress"
            className={cn(networkButtonVariants({ variant: "secondary", size: "md" }), "inline-flex items-center gap-2")}
            prefetch
          >
            View platform progress
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="rounded-3xl border border-border/50 bg-card/60 p-6 shadow-fi-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Intelligence infrastructure
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Modules live</p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">{liveCount}</p>
            </div>
            <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Avg progress</p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">{avgCompletion}%</p>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300/90 via-sky-300/90 to-emerald-300/90"
              style={{ width: `${avgCompletion}%` }}
            />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Eight intelligence modules powering donor review, recipient analysis, and outcome signals — updated as
            engineering ships.
          </p>
        </div>
      </div>
    </Section>
  );
}
