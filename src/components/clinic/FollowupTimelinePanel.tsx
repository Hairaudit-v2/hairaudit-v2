import type { FollowupTimelineResult, FollowupTimelineStatus } from "@/lib/audit/followupTimelineFromPatientUploads";

function statusStyle(status: FollowupTimelineStatus): string {
  switch (status) {
    case "completed":
      return "border-emerald-800/40 bg-emerald-950/25 text-emerald-100/90";
    case "recommended":
      return "border-amber-700/40 bg-amber-950/25 text-amber-100/90";
    case "upcoming":
      return "border-slate-700/50 bg-slate-900/40 text-slate-400";
    default:
      return "border-slate-700/50 bg-slate-900/40 text-slate-400";
  }
}

function statusLabel(status: FollowupTimelineStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "recommended":
      return "Suggested next";
    case "upcoming":
      return "Upcoming";
    default:
      return status;
  }
}

export default function FollowupTimelinePanel({ timeline }: { timeline: FollowupTimelineResult }) {
  if (!timeline.stages.length) return null;

  return (
    <section
      className="rounded-2xl border border-slate-700/80 bg-slate-950/40 p-5"
      aria-label="Patient follow-up photo milestones"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Follow-up photo milestones</h2>
      <p className="mt-1 text-xs text-slate-500">
        Derived from patient-submitted photo categories (day 1 → month 12). Informational only—not a checklist for
        mandatory uploads.
      </p>
      <ol className="mt-4 space-y-2">
        {timeline.stages.map((s) => (
          <li
            key={s.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${statusStyle(s.status)}`}
          >
            <div>
              <span className="font-medium text-slate-200">{s.label}</span>
              {s.matchedCategories.length > 0 ? (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {s.matchedCategories.length} categor{s.matchedCategories.length === 1 ? "y" : "ies"} matched
                </p>
              ) : null}
            </div>
            <span className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] font-medium capitalize">
              {statusLabel(s.status)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
