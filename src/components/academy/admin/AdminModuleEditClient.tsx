"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type DbModule = {
  id: string;
  title: string;
  short_description: string;
  category: string;
  last_updated: string;
  read_online_url: string | null;
  download_url: string | null;
  cover_image_url: string | null;
  status: string;
  mandatory: boolean;
  recommended: boolean;
  recommended_weeks: number[];
  related_competency_ladder_keys: string[];
  requires_assignment: boolean;
};

export default function AdminModuleEditClient({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const [mod, setMod] = useState<DbModule | null>(null);
  const [userAssign, setUserAssign] = useState<string[]>([]);
  const [cohortAssign, setCohortAssign] = useState<string[]>([]);
  const [people, setPeople] = useState<{ user_id: string; label: string }[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [mRes, pRes, cRes] = await Promise.all([
      fetch("/api/academy/admin/modules"),
      fetch("/api/academy/admin/people"),
      fetch("/api/academy/admin/cohorts"),
    ]);
    const mj = await mRes.json();
    const list = (mj.modules ?? []) as DbModule[];
    const found = list.find((m) => m.id === moduleId) ?? null;
    setMod(found);
    const uAs = (mj.userAssignments ?? []) as { module_id: string; user_id: string }[];
    const cAs = (mj.cohortAssignments ?? []) as { module_id: string; cohort_id: string }[];
    setUserAssign(uAs.filter((x) => x.module_id === moduleId).map((x) => x.user_id));
    setCohortAssign(cAs.filter((x) => x.module_id === moduleId).map((x) => x.cohort_id));

    const pj = await pRes.json();
    const peeps = (pj.people ?? []) as { user_id: string; display_name: string | null; email: string | null; academy_role: string }[];
    setPeople(
      peeps
        .filter((x) => x.academy_role === "trainee")
        .map((x) => ({
          user_id: x.user_id,
          label: `${x.display_name?.trim() || x.email || x.user_id.slice(0, 8)} (trainee login)`,
        }))
    );

    const cj = await cRes.json();
    setCohorts((cj.cohorts ?? []) as { id: string; name: string }[]);
  }, [moduleId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleUser(uid: string) {
    setUserAssign((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  }

  function toggleCohort(cid: string) {
    setCohortAssign((prev) => (prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!mod) return;
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    setBusy(true);
    setMsg(null);
    try {
      const weeksStr = String(fd.get("weeks") || "");
      const weekNums = weeksStr
        .split(/[, ]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => n >= 1 && n <= 12);
      const keysStr = String(fd.get("ladder_keys") || "");
      const keys = keysStr
        .split(/[, ]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch(`/api/academy/admin/modules/${encodeURIComponent(moduleId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(fd.get("title") || "").trim(),
          short_description: String(fd.get("short_description") || "").trim(),
          category: String(fd.get("category") || "").trim() || "General",
          last_updated: String(fd.get("last_updated") || "").trim().slice(0, 10),
          read_online_url: String(fd.get("read_online_url") || "").trim() || null,
          download_url: String(fd.get("download_url") || "").trim() || null,
          cover_image_url: String(fd.get("cover_image_url") || "").trim() || null,
          status: fd.get("status") === "draft" ? "draft" : "approved",
          mandatory: fd.get("mandatory") === "on",
          recommended: fd.get("recommended") === "on",
          requires_assignment: fd.get("requires_assignment") === "on",
          recommended_weeks: weekNums,
          related_competency_ladder_keys: keys,
          assigned_user_ids: userAssign,
          assigned_cohort_ids: cohortAssign,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      setMsg("Saved.");
      router.refresh();
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this module from the database? JSON fallback may reappear for this id.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/academy/admin/modules/${encodeURIComponent(moduleId)}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Delete failed");
      router.push("/academy/admin/library");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!mod) {
    return <p className="text-sm text-slate-600">Loading or module not in database…</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/academy/admin/library" className="text-sm font-medium text-amber-700 hover:underline">
        ← Training library admin
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">Edit module</h1>
      <p className="text-xs font-mono text-slate-500">{mod.id}</p>

      <form onSubmit={save} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 max-w-xl">
        <div>
          <label className="text-xs font-medium text-slate-600">Title</label>
          <input
            name="title"
            defaultValue={mod.title}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Short description</label>
          <textarea
            name="short_description"
            defaultValue={mod.short_description}
            required
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Category</label>
            <input
              name="category"
              defaultValue={mod.category}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Last updated</label>
            <input
              name="last_updated"
              type="date"
              defaultValue={String(mod.last_updated).slice(0, 10)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Read online URL</label>
          <input
            name="read_online_url"
            defaultValue={mod.read_online_url ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Download URL</label>
          <input
            name="download_url"
            defaultValue={mod.download_url ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Cover image URL</label>
          <input
            name="cover_image_url"
            defaultValue={mod.cover_image_url ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Recommended weeks (comma-separated)</label>
          <input
            name="weeks"
            defaultValue={(mod.recommended_weeks ?? []).join(",")}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Ladder keys (comma-separated)</label>
          <input
            name="ladder_keys"
            defaultValue={(mod.related_competency_ladder_keys ?? []).join(",")}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Status</label>
          <select
            name="status"
            defaultValue={mod.status}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="mandatory" defaultChecked={mod.mandatory} />
            Mandatory
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="recommended" defaultChecked={mod.recommended} />
            Recommended
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="requires_assignment" defaultChecked={mod.requires_assignment} />
            Restrict to assignments below
          </label>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Assigned trainee logins (auth user ids)</label>
          <div className="mt-1 flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {people.length === 0 ? (
              <span className="text-xs text-slate-500">No trainee academy users — invite trainees first.</span>
            ) : (
              people.map((p) => (
                <button
                  key={p.user_id}
                  type="button"
                  onClick={() => toggleUser(p.user_id)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                    userAssign.includes(p.user_id)
                      ? "bg-emerald-200 text-emerald-950 ring-emerald-400"
                      : "bg-slate-100 text-slate-700 ring-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))
            )}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Assigned cohorts</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {cohorts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCohort(c.id)}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                  cohortAssign.includes(c.id)
                    ? "bg-violet-200 text-violet-950 ring-violet-400"
                    : "bg-slate-100 text-slate-700 ring-slate-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save module"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => void remove()}
        disabled={busy}
        className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900"
      >
        Delete from database
      </button>
      {msg ? <p className="text-sm text-slate-700">{msg}</p> : null}
    </div>
  );
}
