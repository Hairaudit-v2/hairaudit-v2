"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Program = {
  id: string;
  name: string;
  description: string | null;
  academy_site_id: string | null;
  is_active?: boolean;
};

type Site = { id: string; name: string; display_name: string | null };

export default function AdminProgramsClient() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [siteId, setSiteId] = useState("");

  const load = useCallback(async () => {
    const [pr, st] = await Promise.all([fetch("/api/academy/programs"), fetch("/api/academy/sites")]);
    const pj = await pr.json();
    const sj = await st.json();
    if (pj.programs) setPrograms(pj.programs);
    if (sj.sites) setSites(sj.sites);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProgram(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/academy/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.trim() || null,
          academy_site_id: siteId.trim() || null,
          is_active: true,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      setName("");
      setDescription("");
      setSiteId("");
      setMsg("Program created.");
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
        <h2 className="text-sm font-semibold text-slate-900">Programs</h2>
        <p className="mt-1 text-xs text-slate-600">Inactive programs are hidden from the new-trainee dropdown.</p>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {programs.length === 0 ? (
            <li className="py-3 text-slate-500">No programs loaded.</li>
          ) : (
            programs.map((p) => (
              <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/academy/admin/programs/${p.id}`} className="font-medium text-amber-800 hover:underline">
                    {p.name}
                  </Link>
                  {p.is_active === false ? (
                    <span className="ml-2 text-xs font-semibold text-rose-700">Inactive</span>
                  ) : (
                    <span className="ml-2 text-xs text-emerald-700">Active</span>
                  )}
                </div>
                <span className="text-xs text-slate-500 font-mono truncate max-w-[200px]">{p.id}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">New program</h2>
        <form onSubmit={createProgram} className="mt-3 grid gap-3 max-w-lg">
          <div>
            <label className="text-xs font-medium text-slate-600">Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Academy site</label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name?.trim() || s.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create program"}
          </button>
          {msg ? <p className="text-sm text-slate-700">{msg}</p> : null}
        </form>
      </section>
    </div>
  );
}
