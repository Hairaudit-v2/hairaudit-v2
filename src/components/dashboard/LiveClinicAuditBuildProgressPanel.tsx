import {
  CLINIC_AUDIT_BUILD_PROGRESS_NOTE,
  CLINIC_AUDIT_BUILD_PROGRESS_TRACKERS,
} from "@/content/clinicAuditBuildProgress";
import { cn } from "@/lib/utils";

const TRACKER_ORDER = ["hairaudit", "fiOsEcosystem"] as const;

type LiveClinicAuditBuildProgressPanelProps = {
  variant?: "dashboard" | "platform";
};

export default function LiveClinicAuditBuildProgressPanel({
  variant = "dashboard",
}: LiveClinicAuditBuildProgressPanelProps) {
  const isPlatform = variant === "platform";

  return (
    <section
      className={cn(
        "rounded-xl p-4 sm:p-5",
        isPlatform
          ? "rounded-3xl border border-sky-300/20 bg-sky-300/[0.06] shadow-fi-panel sm:p-8"
          : "border border-slate-200 bg-white"
      )}
      aria-labelledby="live-build-progress-heading"
      data-testid="live-clinic-audit-build-progress"
    >
      <header className="mb-4">
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            isPlatform ? "tracking-[0.18em] text-sky-200/90" : "text-slate-500"
          )}
        >
          Platform build
        </p>
        <h2
          id="live-build-progress-heading"
          className={cn(
            "mt-1 font-semibold",
            isPlatform ? "font-display text-2xl text-foreground sm:text-3xl" : "text-base text-slate-900"
          )}
        >
          Live clinic/audit build progress
        </h2>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {TRACKER_ORDER.map((key) => {
          const tracker = CLINIC_AUDIT_BUILD_PROGRESS_TRACKERS[key];
          return (
            <article
              key={tracker.id}
              className={cn(
                "rounded-lg p-4",
                isPlatform ? "border border-border/40 bg-background/40" : "border border-slate-100 bg-slate-50/80"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className={cn("text-sm font-medium", isPlatform ? "text-foreground" : "text-slate-800")}>
                  {tracker.label}
                </h3>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    isPlatform ? "font-display text-2xl text-foreground" : "text-lg text-slate-900"
                  )}
                >
                  {tracker.completionPercent}%
                </span>
              </div>
              <div
                className={cn(
                  "mt-3 h-2 overflow-hidden rounded-full",
                  isPlatform ? "bg-white/10" : "bg-slate-200"
                )}
                role="progressbar"
                aria-valuenow={tracker.completionPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={tracker.label}
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    isPlatform
                      ? "bg-gradient-to-r from-sky-300/90 to-emerald-300/90"
                      : "bg-gradient-to-r from-sky-500 to-emerald-500"
                  )}
                  style={{ width: `${tracker.completionPercent}%` }}
                />
              </div>
            </article>
          );
        })}
      </div>

      <p
        className={cn(
          "mt-4 text-sm leading-relaxed",
          isPlatform ? "text-muted-foreground sm:text-base" : "text-slate-600"
        )}
        data-testid="live-build-progress-note"
      >
        {CLINIC_AUDIT_BUILD_PROGRESS_NOTE}
      </p>
    </section>
  );
}
