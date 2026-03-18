"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ClinicConversionPanel from "@/components/clinic-portal/ClinicConversionPanel";

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
  const [defaultWorkspace, setDefaultWorkspace] = useState({
    visibilityScope: "internal",
    clinicResponseStatus: "responded",
    trainingFlag: false,
    benchmarkInclude: true,
  });
  const pendingResponses = items.filter((item) => item.clinicResponseStatus === "pending_response").length;
  const publicCases = items.filter((item) => item.visibilityScope === "public").length;
  const trainingCount = items.filter((item) => item.trainingFlag).length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clinic-portal/workspaces");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Unable to load invited contributions.");
        if (!cancelled) setItems(Array.isArray(json?.items) ? (json.items as WorkspaceItem[]) : []);
      } catch (error: unknown) {
        if (!cancelled) setMessage((error as Error)?.message ?? "Unable to load invited contributions.");
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
      if (!res.ok) throw new Error(json?.error ?? "Unable to save settings.");
      setMessage(`Saved settings for ${item.title}.`);
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? "Unable to save settings.");
    } finally {
      setSavingCaseId(null);
    }
  }

  function updateItem(caseId: string, patch: Partial<WorkspaceItem>) {
    setItems((prev) => prev.map((item) => (item.caseId === caseId ? { ...item, ...patch } : item)));
  }

  function applyDefaultsToAll() {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        visibilityScope: defaultWorkspace.visibilityScope,
        clinicResponseStatus: defaultWorkspace.clinicResponseStatus,
        trainingFlag: defaultWorkspace.trainingFlag,
        benchmarkInclude: defaultWorkspace.benchmarkInclude,
      }))
    );
    setMessage("Applied defaults to all loaded invited contributions. Review and save affected cases.");
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading invited contributions...</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Your invited contributions</h2>
      <p className="mt-1 text-sm text-slate-600">
        Cases you were invited to contribute to. Control public/internal visibility and convert responses into quality intelligence.
      </p>

      <div className="mt-4">
        <ClinicConversionPanel
          title="Invited contribution trust conversion"
          subtitle="Responding quickly and with strong evidence on invited contributions builds patient trust and operational credibility."
          nextActions={[
            pendingResponses > 0
              ? { label: "Respond to invited contributions", href: "/dashboard/clinic/workspaces" }
              : { label: "Submit your first case (Submitted Case)", href: "/dashboard/clinic/submit-case" },
            { label: "Prepare your public profile", href: "/dashboard/clinic/profile" },
            { label: "Upload devices and technology", href: "/dashboard/clinic/profile#clinical-stack" },
          ]}
          readinessStates={[
            { label: "Basic Profile Complete", ready: items.length > 0 },
            { label: "Enhanced Trust Profile", ready: pendingResponses === 0 && items.length > 0 },
            { label: "Benchmark Ready", ready: items.some((item) => item.benchmarkInclude) },
            { label: "Public Listing In Progress", ready: publicCases > 0 },
            { label: "Training Ready", ready: trainingCount > 0 },
          ]}
        />
      </div>

      <div className="mt-4 space-y-4">
        <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-900">Defaults for invited contributions</p>
          <p className="mt-1 text-xs text-cyan-900/80">Set your typical visibility and response defaults once, then apply across invited cases.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-slate-700">
              Visibility default
              <select
                value={defaultWorkspace.visibilityScope}
                onChange={(event) =>
                  setDefaultWorkspace((prev) => ({ ...prev, visibilityScope: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="internal">Internal only</option>
                <option value="public">Public</option>
              </select>
            </label>
            <label className="text-xs text-slate-700">
              Response default
              <select
                value={defaultWorkspace.clinicResponseStatus}
                onChange={(event) =>
                  setDefaultWorkspace((prev) => ({ ...prev, clinicResponseStatus: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="not_requested">Not requested</option>
                <option value="pending_response">Pending response</option>
                <option value="responded">Responded</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={defaultWorkspace.trainingFlag}
                onChange={(event) => setDefaultWorkspace((prev) => ({ ...prev, trainingFlag: event.target.checked }))}
              />
              Default include in training
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={defaultWorkspace.benchmarkInclude}
                onChange={(event) => setDefaultWorkspace((prev) => ({ ...prev, benchmarkInclude: event.target.checked }))}
              />
              Default include in benchmark
            </label>
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={applyDefaultsToAll}
              className="rounded-lg border border-cyan-300 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
            >
              Apply defaults to loaded cases
            </button>
          </div>
        </section>
        {items.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No invited contributions yet. You can create <strong>Submitted Cases</strong> (your own cases) from Submit Case, or wait for patients to invite you—those cases will appear here.
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
                <div className="rounded-lg border border-slate-200 bg-white p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Visibility</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { value: "internal", label: "Internal" },
                      { value: "public", label: "Public" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateItem(item.caseId, { visibilityScope: opt.value })}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          item.visibilityScope === opt.value
                            ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                            : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Response</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { value: "not_requested", label: "Not requested" },
                      { value: "pending_response", label: "Pending" },
                      { value: "responded", label: "Responded" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateItem(item.caseId, { clinicResponseStatus: opt.value })}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          item.clinicResponseStatus === opt.value
                            ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                            : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={item.trainingFlag}
                    onChange={(event) => updateItem(item.caseId, { trainingFlag: event.target.checked })}
                  />
                  Include in training
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={item.benchmarkInclude}
                    onChange={(event) => updateItem(item.caseId, { benchmarkInclude: event.target.checked })}
                  />
                  Include in benchmark sets
                </label>
              </div>

              <details className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">Advanced metadata (optional)</summary>
                <label className="mt-2 block text-xs text-slate-600">
                  Clinic response summary
                  <textarea
                    rows={3}
                    value={item.clinicResponseSummary}
                    onChange={(event) =>
                      updateItem(item.caseId, { clinicResponseSummary: event.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Only add detailed free text when needed."
                  />
                </label>
              </details>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => saveWorkspace(item)}
                  disabled={savingCaseId === item.caseId}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingCaseId === item.caseId ? "Saving..." : "Save settings"}
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
