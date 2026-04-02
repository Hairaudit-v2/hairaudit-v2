"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Mod = {
  id: string;
  title: string;
  status: string;
  requires_assignment: boolean;
};

export default function AdminModulesClient() {
  const [modules, setModules] = useState<Mod[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toISOString().slice(0, 10));
  const [readOnlineUrl, setReadOnlineUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [status, setStatus] = useState<"approved" | "draft">("draft");
  const [mandatory, setMandatory] = useState(false);
  const [recommended, setRecommended] = useState(false);
  const [requiresAssignment, setRequiresAssignment] = useState(false);
  const [weeks, setWeeks] = useState("1,2,3,4");
  const [ladderKeys, setLadderKeys] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/academy/admin/modules");
    const j = await res.json();
    if (j.modules) setModules(j.modules);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createModule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const weekNums = weeks
        .split(/[, ]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => n >= 1 && n <= 12);
      const keys = ladderKeys
        .split(/[, ]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/academy/admin/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.trim(),
          title: title.trim(),
          short_description: shortDescription.trim(),
          category: category.trim() || "General",
          last_updated: lastUpdated,
          read_online_url: readOnlineUrl.trim() || null,
          download_url: downloadUrl.trim() || null,
          status,
          mandatory,
          recommended,
          requires_assignment: requiresAssignment,
          recommended_weeks: weekNums,
          related_competency_ladder_keys: keys,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      setMsg("Module created.");
      setId("");
      setTitle("");
      setShortDescription("");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Published modules (database)</h2>
        <p className="text-xs text-slate-600 mt-1">
          Entries here override JSON catalog entries with the same id. Remaining modules still load from{" "}
          <code className="text-[11px] bg-slate-100 px-1 rounded">public/training/doctors/modules.json</code>.
        </p>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {modules.length === 0 ? (
            <li className="py-2 text-slate-500">No database modules yet.</li>
          ) : (
            modules.map((m) => (
              <li key={m.id} className="py-2 flex flex-wrap justify-between gap-2">
                <Link href={`/academy/admin/library/${encodeURIComponent(m.id)}`} className="font-medium text-amber-800 hover:underline">
                  {m.title}
                </Link>
                <span className="text-xs text-slate-500">
                  {m.status}
                  {m.requires_assignment ? " · restricted" : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">New module</h2>
        <p className="text-xs text-slate-600 mt-1">
          URLs must stay under <code className="bg-slate-100 px-1 rounded">/training/doctors/</code>. Assign people or cohorts on the
          edit screen.
        </p>
        <form onSubmit={createModule} className="mt-3 grid gap-3 max-w-xl">
          <div>
            <label className="text-xs font-medium text-slate-600">Id (slug) *</label>
            <input
              required
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. my-module-slug"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Title *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Short description *</label>
            <textarea
              required
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Last updated</label>
              <input
                type="date"
                value={lastUpdated}
                onChange={(e) => setLastUpdated(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Read online URL</label>
            <input
              value={readOnlineUrl}
              onChange={(e) => setReadOnlineUrl(e.target.value)}
              placeholder="/training/doctors/..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Download URL</label>
            <input
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              placeholder="/training/doctors/..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Recommended weeks (1–12, comma-separated)</label>
            <input
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Related competency ladder keys (comma-separated)</label>
            <input
              value={ladderKeys}
              onChange={(e) => setLadderKeys(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="draft">Draft (staff-only preview)</option>
              <option value="approved">Approved (library)</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />
              Mandatory flag
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={recommended} onChange={(e) => setRecommended(e.target.checked)} />
              Recommended flag
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresAssignment}
                onChange={(e) => setRequiresAssignment(e.target.checked)}
              />
              Restrict to assigned trainees/cohorts
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create module"}
          </button>
        </form>
      </section>
      {msg ? <p className="text-sm text-slate-700">{msg}</p> : null}
    </div>
  );
}
