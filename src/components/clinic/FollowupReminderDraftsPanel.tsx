"use client";

import { useState } from "react";
import type { FollowupReminderDraft } from "@/lib/audit/followupReminderDraftsFromReadiness";

function UrgencyBadge({ urgency }: { urgency: FollowupReminderDraft["urgency"] }) {
  const cls =
    urgency === "past_window"
      ? "border-amber-700/50 text-amber-200/90 bg-amber-950/30"
      : urgency === "due_soon"
        ? "border-sky-700/50 text-sky-100/90 bg-sky-950/25"
        : "border-slate-600/50 text-slate-300 bg-slate-900/50";
  const label =
    urgency === "past_window" ? "Past window" : urgency === "due_soon" ? "Due soon" : "Next in sequence";
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
  );
}

export default function FollowupReminderDraftsPanel({ drafts }: { drafts: FollowupReminderDraft[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!drafts.length) return null;

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section
      className="rounded-2xl border border-violet-900/35 bg-slate-950/45 p-5"
      aria-label="Follow-up reminder drafts"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-300/90">Follow-up reminder drafts</h2>
      <p className="mt-1 text-xs text-slate-500">
        Copy-ready text for <span className="text-slate-400">your</span> email or SMS tools. HairAudit does{" "}
        <span className="text-slate-300">not</span> send these automatically. Optional communication only—not required for
        audit submission or scoring.
      </p>

      <div className="mt-4 space-y-6">
        {drafts.map((d) => {
          const metaJson = JSON.stringify(d.metadata, null, 2);
          return (
            <div key={d.milestoneId} className="rounded-lg border border-slate-800/90 bg-slate-900/35 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-200">{d.milestoneLabel}</h3>
                <UrgencyBadge urgency={d.urgency} />
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Patient-friendly draft</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{d.patientMessageDraft}</p>
                <button
                  type="button"
                  onClick={() => void copyText(`pt-${d.milestoneId}`, d.patientMessageDraft)}
                  className="mt-2 text-xs text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline"
                >
                  {copied === `pt-${d.milestoneId}` ? "Copied" : "Copy patient draft"}
                </button>
              </div>

              <div className="mt-4 border-t border-slate-800/80 pt-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Coordinator / internal note</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400 whitespace-pre-wrap">{d.coordinatorNote}</p>
                <button
                  type="button"
                  onClick={() => void copyText(`co-${d.milestoneId}`, d.coordinatorNote)}
                  className="mt-2 text-xs text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline"
                >
                  {copied === `co-${d.milestoneId}` ? "Copied" : "Copy coordinator note"}
                </button>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-400">
                  Future automation metadata (reference)
                </summary>
                <pre className="mt-2 overflow-x-auto rounded border border-slate-800 bg-slate-950/60 p-2 text-[10px] text-slate-500">
                  {metaJson}
                </pre>
                <button
                  type="button"
                  onClick={() => void copyText(`js-${d.milestoneId}`, metaJson)}
                  className="mt-1 text-xs text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline"
                >
                  {copied === `js-${d.milestoneId}` ? "Copied" : "Copy metadata JSON"}
                </button>
              </details>
            </div>
          );
        })}
      </div>
    </section>
  );
}
