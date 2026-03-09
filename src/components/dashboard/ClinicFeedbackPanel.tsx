"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type ClinicFeedbackItem = {
  type: "override" | "section_feedback";
  caseId: string;
  reportId: string;
  sectionOrDomainKey: string;
  note: string;
  createdAt: string;
  visibilityScope: string;
  manualScore?: number;
  aiScore?: number;
};

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function formatSectionKey(key: string) {
  const labels: Record<string, string> = {
    SP: "Surgical Planning",
    DP: "Donor Preservation",
    GV: "Graft Handling",
    IC: "Implantation Quality",
    DI: "Documentation Integrity",
  };
  return labels[key] ?? key;
}

export default function ClinicFeedbackPanel() {
  const [items, setItems] = useState<ClinicFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auditor/clinic-feedback");
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "Failed to load feedback");
          return;
        }
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message ?? "Request failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Feedback Shared With Your Clinic
        </h2>
        <p className="mt-3 text-sm text-slate-500">Loading…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Feedback Shared With Your Clinic
        </h2>
        <p className="mt-3 text-sm text-amber-700">{error}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm overflow-hidden">
      <div className="border-b border-slate-200/80 bg-white/80 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Feedback Shared With Your Clinic
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Auditor notes shared for your cases (evidence-backed, visibility-safe).
        </p>
      </div>
      <div className="p-4">
        {items.length === 0 ? (
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 text-center">
            <p className="text-slate-600 text-sm">
              No clinic-visible feedback available yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              When auditors share feedback with your clinic, it will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item, idx) => (
              <li
                key={`${item.type}-${item.reportId}-${item.sectionOrDomainKey}-${idx}`}
                className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {formatSectionKey(item.sectionOrDomainKey)}
                    {item.type === "override" ? " (score override)" : " (section feedback)"}
                  </span>
                  <span className="text-[10px] uppercase text-slate-400">
                    Shared with clinic
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-800 leading-snug">{item.note}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  <Link
                    href={`/cases/${item.caseId}`}
                    className="font-medium text-slate-600 hover:text-slate-900"
                  >
                    Case {shortId(item.caseId)}
                  </Link>
                  {item.type === "override" && item.manualScore != null && (
                    <span className="text-slate-400">
                      Score: {item.manualScore}
                      {item.aiScore != null ? ` (AI: ${item.aiScore})` : ""}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
