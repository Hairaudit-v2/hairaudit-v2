"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Cohort = {
  id: string;
  name: string;
  academy_site_id: string | null;
  program_id: string | null;
  start_date: string | null;
  notes: string | null;
};

export default function AdminCohortEditClient({ cohortId }: { cohortId: string }) {
  const router = useRouter();
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [trainerIds, setTrainerIds] = useState<string[]>([]);
  const [traineeIds, setTraineeIds] = useState<string[]>([]);
  const [trainers, setTrainers] = useState<{ user_id: string; label: string }[]>([]);
  const [trainees, setTrainees] = useState<{ id: string; label: string }[]>([]);
  const [sites, setSites] = useState<{ id: string; label: string }[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [cRes, pRes, tRes, sRes, prRes] = await Promise.all([
      fetch(`/api/academy/admin/cohorts/${cohortId}`),
      fetch("/api/academy/admin/people"),
      fetch("/api/academy/trainees?status=all"),
      fetch("/api/academy/sites"),
      fetch("/api/academy/programs"),
    ]);
    const cj = await cRes.json();
    if (!cRes.ok) {
      setMsg(cj.error || "Not found");
      return;
    }
    setCohort(cj.cohort);
    setTrainerIds(cj.trainer_user_ids ?? []);
    setTraineeIds(cj.training_doctor_ids ?? []);

    const pj = await pRes.json();
    const peeps = (pj.people ?? []) as { user_id: string; display_name: string | null; email: string | null; academy_role: string }[];
    setTrainers(
      peeps
        .filter((x) => x.academy_role === "trainer")
        .map((x) => ({
          user_id: x.user_id,
          label: x.display_name?.trim() || x.email || x.user_id.slice(0, 8),
        }))
    );
    const tj = await tRes.json();
    const docs = (tj.trainees ?? []) as { id: string; full_name: string }[];
    setTrainees(docs.map((d) => ({ id: d.id, label: d.full_name })));
    const sj = await sRes.json();
    const siteRows = (sj.sites ?? []) as { id: string; name: string; display_name: string | null }[];
    setSites(siteRows.map((s) => ({ id: s.id, label: s.display_name?.trim() || s.name })));
    const prj = await prRes.json();
    setPrograms((prj.programs ?? []) as { id: string; name: string }[]);
  }, [cohortId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleTrainer(id: string) {
    setTrainerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleTrainee(id: string) {
    setTraineeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!cohort) return;
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/academy/admin/cohorts/${cohortId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(fd.get("name") || "").trim(),
          academy_site_id: String(fd.get("academy_site_id") || "").trim() || null,
          program_id: String(fd.get("program_id") || "").trim() || null,
          start_date: String(fd.get("start_date") || "").trim() || null,
          notes: String(fd.get("notes") || "").trim() || null,
          trainer_user_ids: trainerIds,
          training_doctor_ids: traineeIds,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      setMsg("Saved.");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this cohort? Trainees stay in the system; only the grouping is removed.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/academy/admin/cohorts/${cohortId}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Delete failed");
      router.push("/academy/admin/cohorts");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!cohort) {
    return <p className="text-sm text-slate-600">{msg || "Loading…"}</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/academy/admin/cohorts" className="text-sm font-medium text-amber-700 hover:underline">
        ← Cohorts
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">Edit cohort</h1>

      <form onSubmit={save} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 max-w-2xl">
        <div>
          <label className="text-xs font-medium text-slate-600">Name</label>
          <input
            name="name"
            defaultValue={cohort.name}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Academy site</label>
            <select
              name="academy_site_id"
              defaultValue={cohort.academy_site_id ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
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
              name="program_id"
              defaultValue={cohort.program_id ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
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
            name="start_date"
            type="date"
            defaultValue={cohort.start_date ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Notes</label>
          <textarea
            name="notes"
            defaultValue={cohort.notes ?? ""}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Trainers</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {trainers.map((t) => (
              <button
                key={t.user_id}
                type="button"
                onClick={() => toggleTrainer(t.user_id)}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                  trainerIds.includes(t.user_id)
                    ? "bg-amber-200 text-amber-950 ring-amber-400"
                    : "bg-slate-100 text-slate-700 ring-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Trainees</label>
          <div className="mt-1 flex flex-wrap gap-1 max-h-40 overflow-y-auto">
            {trainees.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTrainee(t.id)}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                  traineeIds.includes(t.id)
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
          {busy ? "Saving…" : "Save cohort"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => void remove()}
        disabled={busy}
        className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900"
      >
        Delete cohort
      </button>
      {msg ? <p className="text-sm text-slate-700">{msg}</p> : null}
    </div>
  );
}
