"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { academyRoleDisplayLabel, ACADEMY_ROLE_OPTIONS } from "@/lib/academy/academyRoleLabels";
import type { AcademyUserRole } from "@/lib/academy/constants";

type Person = {
  user_id: string;
  academy_role: string;
  display_name: string | null;
  email: string | null;
  profile_name: string | null;
  profile_role: string | null;
  trainee_profiles: {
    id: string;
    full_name: string;
    program_id: string | null;
    academy_site_id: string | null;
    assigned_trainer_id: string | null;
  }[];
};

type Unlinked = {
  id: string;
  full_name: string;
  email: string | null;
  program_id: string | null;
  academy_site_id: string | null;
  assigned_trainer_id: string | null;
};

export default function AdminPeopleClient() {
  const [people, setPeople] = useState<Person[]>([]);
  const [unlinked, setUnlinked] = useState<Unlinked[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"trainer" | "clinic_staff" | "trainee">("trainee");
  const [inviteName, setInviteName] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/academy/admin/people");
    const j = await res.json();
    if (j.people) setPeople(j.people);
    if (j.unlinked_trainees) setUnlinked(j.unlinked_trainees);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/academy/admin/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          academy_role: inviteRole,
          display_name: inviteName.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Invite failed");
      setMsg(j.result?.method ? `Sent (${j.result.method})` : "OK");
      setInviteEmail("");
      setInviteName("");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateRole(userId: string, role: AcademyUserRole) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/academy/admin/people/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Update failed");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Trainee roster hygiene</h2>
        <p className="mt-1 text-xs text-slate-600">
          Spot duplicate emails or logins, withdraw or archive mistaken rows, and hard-delete only empty profiles from{" "}
          <Link href="/academy/admin/trainees#duplicates" className="font-medium text-amber-900 underline hover:no-underline">
            Trainee roster & cleanup
          </Link>
          .
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Invite or link user</h2>
        <p className="mt-1 text-xs text-slate-600">
          Trainers, clinic coordinators / nurses, and trainees. Uses the same invite flow as Academy roster (Supabase invite or magic
          link).
        </p>
        <form onSubmit={invite} className="mt-3 grid gap-3 max-w-lg sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">Work email *</label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Academy role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="trainer">Trainer (surgeon / faculty)</option>
              <option value="clinic_staff">Clinic coordinator / nurse</option>
              <option value="trainee">Trainee</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Display name</label>
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Invite user"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-x-auto">
        <h2 className="text-sm font-semibold text-slate-900">Academy people</h2>
        <table className="mt-3 min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-slate-500">
              <th className="py-2 pr-2">Name / email</th>
              <th className="py-2 pr-2">Academy role</th>
              <th className="py-2 pr-2">HairAudit profile</th>
              <th className="py-2 pr-2">Trainee record</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.user_id} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  <div className="font-medium">{p.display_name || p.profile_name || "—"}</div>
                  <div className="text-xs text-slate-500">{p.email || "—"}</div>
                  <div className="text-[10px] font-mono text-slate-400">{p.user_id}</div>
                </td>
                <td className="py-2 pr-2">{academyRoleDisplayLabel(p.academy_role as AcademyUserRole)}</td>
                <td className="py-2 pr-2 text-xs">{p.profile_role || "—"}</td>
                <td className="py-2 pr-2 text-xs">
                  {p.trainee_profiles.length ? (
                    <ul>
                      {p.trainee_profiles.map((t) => (
                        <li key={t.id}>
                          <Link href={`/academy/trainees/${t.id}/edit`} className="text-amber-800 hover:underline">
                            {t.full_name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2">
                  <select
                    className="rounded border border-slate-300 px-1 py-1 text-xs"
                    value={p.academy_role}
                    onChange={(e) => void updateRole(p.user_id, e.target.value as AcademyUserRole)}
                    disabled={busy}
                  >
                    {ACADEMY_ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Trainee profiles without login</h2>
        <p className="text-xs text-slate-600 mt-1">Link a HairAudit user UUID on the edit screen so they can open their dashboard.</p>
        <ul className="mt-2 text-sm space-y-1">
          {unlinked.length === 0 ? (
            <li className="text-slate-500">None.</li>
          ) : (
            unlinked.map((u) => (
              <li key={u.id}>
                <Link href={`/academy/trainees/${u.id}/edit`} className="text-amber-800 font-medium hover:underline">
                  {u.full_name}
                </Link>
                {u.email ? <span className="text-slate-500"> · {u.email}</span> : null}
              </li>
            ))
          )}
        </ul>
      </section>

      {msg ? <p className="text-sm text-slate-700">{msg}</p> : null}
    </div>
  );
}
