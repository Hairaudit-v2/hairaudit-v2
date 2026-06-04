// HairAudit Mobile Surgery Upload Portal — Stage 6A
// Read-only, mobile-friendly evidence-review history. Renders the sanitized
// view models produced by loadEvidenceEvents. This component is NEVER editable.
import { type EvidenceTimelineEvent } from "@/lib/surgeryUpload/evidenceEvents";

function badgeClass(eventType: string): string {
  switch (eventType) {
    case "evidence_review_status_changed":
      return "bg-cyan-100 text-cyan-800";
    case "slot_review_updated":
      return "bg-violet-100 text-violet-800";
    case "additional_evidence_uploaded":
      return "bg-amber-100 text-amber-800";
    case "evidence_resubmitted":
      return "bg-emerald-100 text-emerald-800";
    case "audit_handoff":
      return "bg-indigo-100 text-indigo-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function SurgeryUploadEvidenceTimeline({
  events,
  title = "Evidence history",
  subtitle = "A read-only record of evidence-review activity for this upload.",
  className = "",
}: {
  events: EvidenceTimelineEvent[];
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {events.length > 0 && (
          <span className="text-xs text-slate-400">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}

      {events.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-sm text-slate-500">No evidence review activity yet.</p>
        </div>
      ) : (
        <ol className="mt-3 space-y-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="relative rounded-xl border border-slate-200 bg-white p-3 pl-4"
            >
              {/* Timeline accent rail */}
              <span
                aria-hidden
                className="absolute inset-y-3 left-0 w-1 rounded-full bg-slate-200"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(event.eventType)}`}
                >
                  {event.label}
                </span>
                <time
                  dateTime={event.createdAt}
                  className="text-xs text-slate-400"
                >
                  {formatTimestamp(event.createdAt)}
                </time>
              </div>
              <p className="mt-1.5 text-sm text-slate-800">{event.summary}</p>
              {event.note && (
                <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                  {event.note}
                </p>
              )}
              <p className="mt-1.5 text-xs text-slate-400">{event.actorLabel}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
