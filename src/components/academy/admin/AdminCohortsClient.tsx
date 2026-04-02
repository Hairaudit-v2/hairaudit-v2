"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Cohort = {
  id: string;
  name: string;
  academy_site_id: string | null;
  program_id: string | null;
  start_date: string | null;
  notes: string | null;
};

export default function AdminCohortsClient() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [trainers, setTrainers] = useState<{ user_id: string; label: string }[]>([]);
  const [trainees, setTrainees] = useState<{ id: string; label: string }[]>([]);
  const [sites, setSites] = useState<{ id: string; label: string }[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState("");
  const [programId, setProgramId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selTrainers, setSelTrainers] = useState<string[]>([]);
  const [selTrainees, setSelTrainees] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [cRes, pRes, tRes, sRes, prRes] = await Promise.all([
      fetch("/api/academy/admin/cohorts"),
      fetch("/api/academy/admin/people"),
      fetch("/api/academy/trainees?status=all"),
      fetch("/api/academy/sites"),
      fetch("/api/academy/programs"),
    ]);
    const cj = await cRes.json();
    const pj = await pRes.json();
    const tj = await tRes.json();
    const sj = await sRes.json();
    const prj = await prRes.json();
    if (cj.cohorts) setCohorts(cj.cohorts);
    const peeps = (pj.people ?? []) as { user_id: string; display_name: string | null; email: string | null; academy_role: string }[];
    setTrainers(
      peeps
        .filter((x) => x.academy_role === "trainer")
        .map((x) => ({
          user_id: x.user_id,
          label: x.display_name?.trim() || x.email || x.user_id.slice(0, 8),
        }))
    );
    const docs = (tj.trainees ?? []) as { id: string; full_name: string }[];
    setTrainees(docs.map((d) => ({ id: d.id, label: d.full_name })));
    const siteRows = (sj.sites ?? []) as { id: string; name: string; display_name: string | null }[];
    setSites(siteRows.map((s) => ({ id: s.id, label: s.display_name?.trim() || s.name })));
    const progRows = (prj.programs ?? []) as { id: string; name: string }[];
    setPrograms(progRows);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleTrainer(id: string) {
    setSelTrainers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleTrainee(id: string) {
    setSelTrainees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function createCohort(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/academy/admin/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          academy_site_id: siteId.trim() || null,
          program_id: programId.trim() || null,
          start_date: startDate.trim() || null,
          notes: notes.trim() || null,
          trainer_user_ids: selTrainers,
          training_doctor_ids: selTrainees,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      setName("");
      setSiteId("");
      setProgramId("");
      setStartDate("");
      setNotes("");
      setSelTrainers([]);
      setSelTrainees([]);
      setMsg("Cohort created.");
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
        <h2 className="text-sm font-semibold text-slate-900">Cohorts</h2>
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {cohorts.length === 0 ? (
            <li className="py-2 text-slate-500">No cohorts yet.</li>
          ) : (
            cohorts.map((c) => (
              <li key={c.id} className="py-2 flex justify-between gap-2">
                <Link href={`/academy/admin/cohorts/${c.id}`} className="font-medium text-amber-800 hover:underline">
                  {c.name}
                </Link>
                <span className="text-xs text-slate-400 font-mono">{c.id.slice(0, 8)}…</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">New cohort / intake</h2>
        <form onSubmit={createCohort} className="mt-3 space-y-3 max-w-2xl">
          <div>
            <label className="text-xs font-medium text-slate-600">Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. London fellowship — April 2026"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Academy site</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— Optional —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Program</label>
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— Optional —</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Trainers (tap to toggle)</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {trainers.length === 0 ? (
                <span className="text-xs text-slate-500">No trainers in academy yet.</span>
              ) : (
                trainers.map((t) => (
                  <button
                    key={t.user_id}
                    type="button"
                    onClick={() => toggleTrainer(t.user_id)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                      selTrainers.includes(t.user_id)
                        ? "bg-amber-200 text-amber-950 ring-amber-400"
                        : "bg-slate-100 text-slate-700 ring-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Trainees (tap to toggle)</label>
            <div className="mt-1 flex flex-wrap gap-1 max-h-40 overflow-y-auto">
              {trainees.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTrainee(t.id)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                    selTrainees.includes(t.id)
                      ? "bg-sky-200 text-sky-950 ring-sky-400"
                      : "bg-slate-100 text-slate-700 ring-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create cohort"}
          </button>
        </form>
      </section>
      {msg ? <p className="text-sm text-slate-700">{msg}</p> : null}
    </div>
  );
}
