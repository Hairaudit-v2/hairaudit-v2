"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Program = {
  id: string;
  name: string;
  description: string | null;
  academy_site_id: string | null;
  is_active?: boolean;
};

type Site = { id: string; name: string; display_name: string | null };

export default function AdminProgramEditClient({ programId }: { programId: string }) {
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [traineeCount, setTraineeCount] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [pr, st, tr] = await Promise.all([
      fetch("/api/academy/programs"),
      fetch("/api/academy/sites"),
      fetch("/api/academy/trainees"),
    ]);
    const pj = await pr.json();
    const sj = await st.json();
    const tj = await tr.json();
    const list = (pj.programs ?? []) as Program[];
    setProgram(list.find((p) => p.id === programId) ?? null);
    if (sj.sites) setSites(sj.sites);
    const trainees = (tj.trainees ?? []) as { program_id: string | null }[];
    setTraineeCount(trainees.filter((t) => t.program_id === programId).length);
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!program) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/academy/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(fd.get("name") || "").trim(),
          description: String(fd.get("description") || "").trim() || null,
          academy_site_id: String(fd.get("academy_site_id") || "").trim() || null,
          is_active: fd.get("is_active") === "on",
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      setMsg("Saved.");
      router.refresh();
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this program? Trainee program_id will be set null by the database.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/academy/programs/${programId}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Delete failed");
      router.push("/academy/admin/programs");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (!program) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/academy/admin/programs" className="text-sm font-medium text-amber-700 hover:underline">
        ← Programs
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">Edit program</h1>
      {traineeCount != null ? (
        <p className="text-sm text-slate-600">
          Trainees on this program: <strong>{traineeCount}</strong>{" "}
          <Link href="/academy/trainees" className="text-amber-700 hover:underline">
            Open trainee list
          </Link>
        </p>
      ) : null}

      <form onSubmit={save} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 max-w-lg">
        <div>
          <label className="text-xs font-medium text-slate-600">Name</label>
          <input
            name="name"
            defaultValue={program.name}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Description</label>
          <textarea
            name="description"
            defaultValue={program.description ?? ""}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Academy site</label>
          <select
            name="academy_site_id"
            defaultValue={program.academy_site_id ?? ""}
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
        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_active" id="is_active" defaultChecked={program.is_active !== false} />
          <label htmlFor="is_active" className="text-sm text-slate-700">
            Active (show in trainee program dropdown)
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-50"
        >
          Delete program
        </button>
      </div>
      {msg ? <p className="text-sm text-slate-700">{msg}</p> : null}
    </div>
  );
}
