"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_TRAINING_PROGRAM_ID } from "@/lib/academy/constants";
import type { TrainingDoctorRow } from "@/lib/academy/types";
import { traineeStatusLabel } from "@/lib/academy/traineeStatus";

type Opt = { id: string; name: string };
type SiteOpt = { id: string; label: string };
type TrainerOpt = { user_id: string; label: string };

export default function TraineeEditClient({
  doctorId,
  doctor,
  programOptions,
  siteOptions,
  trainerOptions,
  isAcademyAdmin,
}: {
  doctorId: string;
  doctor: TrainingDoctorRow;
  programOptions: Opt[];
  siteOptions: SiteOpt[];
  trainerOptions: TrainerOpt[];
  isAcademyAdmin: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/academy/trainees/${doctorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: String(fd.get("full_name") || "").trim(),
          email: String(fd.get("email") || "").trim() || null,
          phone: String(fd.get("phone") || "").trim() || null,
          country: String(fd.get("country") || "").trim() || null,
          clinic_name: String(fd.get("clinic_name") || "").trim() || null,
          registration_number: String(fd.get("registration_number") || "").trim() || null,
          start_date: String(fd.get("start_date") || "").trim() || null,
          competency_wave_start_date: String(fd.get("competency_wave_start_date") || "").trim() || null,
          program_id: String(fd.get("program_id") || "").trim() || null,
          academy_site_id: String(fd.get("academy_site_id") || "").trim() || null,
          assigned_trainer_id: String(fd.get("assigned_trainer_id") || "").trim() || null,
          auth_user_id: String(fd.get("auth_user_id") || "").trim() || null,
          current_stage: String(fd.get("current_stage") || "").trim(),
          status: String(fd.get("status") || "").trim(),
          notes: String(fd.get("notes") || "").trim() || null,
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

  async function patchStatusOnly(status: string, successNote: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/academy/trainees/${doctorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Update failed");
      setMsg(successNote);
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function hardDelete() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/academy/trainees/${doctorId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirm.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || j.hint || "Delete failed");
      router.push("/academy/trainees");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const withdrawnOrArchived = doctor.status === "withdrawn" || doctor.status === "archived";

  return (
    <div className="space-y-6 max-w-xl mx-auto px-4 sm:px-6">
      <Link href={`/academy/trainees/${doctorId}`} className="text-sm font-medium text-amber-700 hover:underline">
        ← {doctor.full_name}
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">Edit trainee</h1>
      <p className="text-sm text-slate-600">
        <Link href={`/academy/trainees/${doctorId}/competency`} className="text-amber-800 font-medium hover:underline">
          Open competency dashboard
        </Link>{" "}
        (wave start can also be set there by staff).
      </p>

      <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Roster actions</h2>
        <p className="text-xs text-slate-600">
          Withdraw and archive keep all training history, cases, competency data, reviews, and assignments. They only change how this
          profile appears in default lists. Current status:{" "}
          <span className="font-medium text-slate-800">{traineeStatusLabel(doctor.status)}</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void patchStatusOnly("withdrawn", "Marked as withdrawn.")}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            Withdraw from active roster
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void patchStatusOnly("archived", "Archived (hidden from default lists).")}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            Archive record
          </button>
          <button
            type="button"
            disabled={busy || !withdrawnOrArchived}
            onClick={() => void patchStatusOnly("active", "Restored to active.")}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Restore to active
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          Tip: use <strong className="font-medium">Archive</strong> for operational cleanup; <strong className="font-medium">Withdraw</strong> when someone
          leaves the program. You can still adjust status from the form below.
        </p>
      </section>

      <form onSubmit={save} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Profile details</h2>
        <div>
          <label className="block text-xs font-medium text-slate-600">Full name *</label>
          <input
            name="full_name"
            required
            defaultValue={doctor.full_name}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Email</label>
            <input name="email" type="email" defaultValue={doctor.email ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Phone</label>
            <input name="phone" defaultValue={doctor.phone ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Country</label>
            <input name="country" defaultValue={doctor.country ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Clinic</label>
            <input name="clinic_name" defaultValue={doctor.clinic_name ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Registration #</label>
          <input name="registration_number" defaultValue={doctor.registration_number ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Start date</label>
            <input name="start_date" type="date" defaultValue={doctor.start_date ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Competency wave start</label>
            <input
              name="competency_wave_start_date"
              type="date"
              defaultValue={doctor.competency_wave_start_date ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Program</label>
            <select name="program_id" defaultValue={doctor.program_id ?? DEFAULT_TRAINING_PROGRAM_ID} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {programOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Academy site override</label>
            <select name="academy_site_id" defaultValue={doctor.academy_site_id ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">— Inherit from program —</option>
              {siteOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Assigned trainer</label>
          <select name="assigned_trainer_id" defaultValue={doctor.assigned_trainer_id ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">— None —</option>
            {trainerOptions.map((t) => (
              <option key={t.user_id} value={t.user_id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Current stage</label>
            <input name="current_stage" defaultValue={doctor.current_stage} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Status</label>
            <select name="status" defaultValue={doctor.status} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="graduated">graduated</option>
              <option value="withdrawn">withdrawn</option>
              <option value="archived">archived</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Linked auth user id (trainee login)</label>
          <input
            name="auth_user_id"
            defaultValue={doctor.auth_user_id ?? ""}
            placeholder="UUID"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Readiness (view)</label>
          <p className="mt-1 text-xs text-slate-600">
            Status: {doctor.competency_final_readiness_status ?? "—"} ·{" "}
            <Link href={`/academy/trainees/${doctorId}/competency`} className="text-amber-800 hover:underline">
              Edit on competency page
            </Link>
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Trainer notes</label>
          <textarea name="notes" defaultValue={doctor.notes ?? ""} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>

      {isAcademyAdmin ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-rose-950">Destructive cleanup (academy admin)</h2>
          <p className="text-xs text-rose-900/90">
            Hard delete removes this trainee row from the database. It is only allowed when there are no cases, competency rows, weekly
            reviews, cohort membership, or stage history. If anything is linked, the server will refuse and you should use archive or
            withdraw instead.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDeleteOpen(true);
              setDeleteConfirm("");
            }}
            className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
          >
            Delete trainee permanently…
          </button>
        </section>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-trainee-title">
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-3">
            <h3 id="delete-trainee-title" className="text-lg font-semibold text-slate-900">
              Delete trainee permanently?
            </h3>
            <p className="text-sm text-slate-600">
              This cannot be undone. The API will reject the request if the trainee has any training history or cohort links. To hide
              them from lists without deleting data, cancel and use <strong className="font-medium">Archive</strong> or{" "}
              <strong className="font-medium">Withdraw</strong> above.
            </p>
            <p className="text-sm text-slate-800">
              Type the full name exactly to confirm: <span className="font-mono font-medium">{doctor.full_name}</span>
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Full name"
              autoComplete="off"
            />
            <div className="flex flex-wrap gap-2 justify-end pt-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || deleteConfirm.trim() !== doctor.full_name.trim()}
                onClick={() => void hardDelete()}
                className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {msg ? <p className="text-sm text-slate-700">{msg}</p> : null}
    </div>
  );
}
