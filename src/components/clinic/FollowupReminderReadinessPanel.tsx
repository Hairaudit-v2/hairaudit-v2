import type { FollowupReminderReadiness } from "@/lib/audit/followupReminderReadinessFromTimeline";

export default function FollowupReminderReadinessPanel({ readiness }: { readiness: FollowupReminderReadiness }) {
  if (!readiness.summaryLines.length) return null;

  return (
    <section
      className="rounded-2xl border border-cyan-900/30 bg-slate-950/40 p-5"
      aria-label="Follow-up reminder readiness"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-700/90">Follow-up reminder readiness</h2>
      <p className="mt-1 text-xs text-slate-500">
        Planning hints from the photo timeline and optional intake dates. Informational only — no emails or SMS are sent
        from HairAudit in this release, and nothing here affects scores or submission rules.
      </p>
      {readiness.monthsPostOpEstimate != null ? (
        <p className="mt-2 text-xs text-slate-400">
          Estimated time since procedure (from intake): ~{Math.round(readiness.monthsPostOpEstimate * 10) / 10} mo
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Procedure timing not estimated from intake — sequence hints only.</p>
      )}
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-snug text-slate-300">
        {readiness.summaryLines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
