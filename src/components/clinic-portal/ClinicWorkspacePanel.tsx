"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type WorkspaceItem = {
  caseId: string;
  title: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  visibilityScope: string;
  submissionChannel: string;
  clinicResponseStatus: string;
  clinicResponseSummary: string;
  trainingFlag: boolean;
  benchmarkInclude: boolean;
  whiteLabelScope: string;
};

export default function ClinicWorkspacePanel() {
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCaseId, setSavingCaseId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clinic-portal/workspaces");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Unable to load clinic workspaces.");
        if (!cancelled) setItems(Array.isArray(json?.items) ? (json.items as WorkspaceItem[]) : []);
      } catch (error: unknown) {
        if (!cancelled) setMessage((error as Error)?.message ?? "Unable to load clinic workspaces.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveWorkspace(item: WorkspaceItem) {
    setSavingCaseId(item.caseId);
    setMessage("");
    try {
      const res = await fetch("/api/clinic-portal/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId: item.caseId,
          visibilityScope: item.visibilityScope,
          clinicResponseStatus: item.clinicResponseStatus,
          clinicResponseSummary: item.clinicResponseSummary,
          trainingFlag: item.trainingFlag,
          benchmarkInclude: item.benchmarkInclude,
          whiteLabelScope: item.whiteLabelScope,
          submissionChannel: item.submissionChannel,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Unable to save workspace.");
      setMessage(`Saved workspace settings for ${item.title}.`);
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? "Unable to save workspace.");
    } finally {
      setSavingCaseId(null);
    }
  }

  function updateItem(caseId: string, patch: Partial<WorkspaceItem>) {
    setItems((prev) => prev.map((item) => (item.caseId === caseId ? { ...item, ...patch } : item)));
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading clinic workspaces...</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Clinic case workspaces</h2>
      <p className="mt-1 text-sm text-slate-600">
        Respond to patient-submitted audits, set public/internal visibility, and mark training or benchmark intent.
      </p>

      <div className="mt-4 space-y-4">
        {items.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No clinic-linked cases yet.
          </p>
        ) : (
          items.map((item) => (
            <article key={item.caseId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    Status: {item.status} | Created: {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Link
                  href={`/cases/${item.caseId}`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Open case
                </Link>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs text-slate-600">
                  Visibility
                  <select
                    value={item.visibilityScope}
                    onChange={(event) => updateItem(item.caseId, { visibilityScope: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="internal">Internal only</option>
                    <option value="public">Public</option>
                  </select>
                </label>

                <label className="text-xs text-slate-600">
                  Response status
                  <select
                    value={item.clinicResponseStatus}
                    onChange={(event) =>
                      updateItem(item.caseId, { clinicResponseStatus: event.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="not_requested">Not requested</option>
                    <option value="pending_response">Pending response</option>
                    <option value="responded">Responded</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={item.trainingFlag}
                    onChange={(event) => updateItem(item.caseId, { trainingFlag: event.target.checked })}
                  />
                  Include in training
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={item.benchmarkInclude}
                    onChange={(event) => updateItem(item.caseId, { benchmarkInclude: event.target.checked })}
                  />
                  Include in benchmark sets
                </label>
              </div>

              <label className="mt-3 block text-xs text-slate-600">
                Clinic response summary
                <textarea
                  rows={3}
                  value={item.clinicResponseSummary}
                  onChange={(event) =>
                    updateItem(item.caseId, { clinicResponseSummary: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="How your clinic interprets this case and what process improvements were actioned."
                />
              </label>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => saveWorkspace(item)}
                  disabled={savingCaseId === item.caseId}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingCaseId === item.caseId ? "Saving..." : "Save workspace settings"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">{message}</p>
    </section>
  );
}
