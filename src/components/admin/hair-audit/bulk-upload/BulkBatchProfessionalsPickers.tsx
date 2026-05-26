"use client";

import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BulkBatchDetailsInput } from "@/lib/hair-audit/bulkUpload/types";
import type { HairAuditCaseBatchRow } from "@/lib/hair-audit/bulkUpload/types";
import type { BulkClinicDuplicateMatch, BulkDoctorDuplicateMatch } from "@/lib/hair-audit/bulkUpload/professionalIntake";

export type BulkProfileDoctorOption = {
  profileId: string;
  name: string;
  userId: string;
  clinicProfileId?: string | null;
  city?: string | null;
  country?: string | null;
  doctor_email?: string | null;
};

export type BulkProfileClinicOption = {
  profileId: string;
  name: string;
  userId: string;
  city?: string | null;
  country?: string | null;
  clinic_email?: string | null;
};

type Props = {
  batch: HairAuditCaseBatchRow;
  batchDetails: BulkBatchDetailsInput;
  setBatchDetails: Dispatch<SetStateAction<BulkBatchDetailsInput>>;
  doctors: BulkProfileDoctorOption[];
  setDoctors: Dispatch<SetStateAction<BulkProfileDoctorOption[]>>;
  clinics: BulkProfileClinicOption[];
  setClinics: Dispatch<SetStateAction<BulkProfileClinicOption[]>>;
  setErr: (m: string | null) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
};



type DupState =
  | { kind: "doctor"; payload: Record<string, unknown>; message: string; matches?: BulkDoctorDuplicateMatch[] }
  | {
      kind: "clinic";
      payload: Record<string, unknown>;
      message: string;
      suggestions?: BulkClinicDuplicateMatch[];
      match?: BulkClinicDuplicateMatch;
    };

function Segmented<Entity extends string>(props: {
  value: Entity;
  onChange: (v: Entity) => void;
  options: { id: Entity; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-slate-950 p-1" role="group">
      {props.options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => props.onChange(o.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            props.value === o.id ? "bg-cyan-600 text-white" : "text-slate-300 hover:bg-white/5"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function fuzzyIncludes(hay: string | undefined | null, q: string): boolean {
  if (!q) return true;
  return (hay ?? "").toLowerCase().includes(q.toLowerCase());
}

export default function BulkBatchProfessionalsPickers({
  batch,
  batchDetails,
  setBatchDetails,
  doctors,
  setDoctors,
  clinics,
  setClinics,
  setErr,
  busy,
  setBusy,
}: Props) {
  const [doctorMode, setDoctorMode] = useState<"existing" | "new" | "unknown">(
    batch.doctor_id ? "existing" : "unknown"
  );
  const [clinicMode, setClinicMode] = useState<"existing" | "new" | "unknown">(
    batch.clinic_id ? "existing" : "unknown"
  );

  const [doctorQuery, setDoctorQuery] = useState("");
  const [clinicQuery, setClinicQuery] = useState("");

  const [doctorNew, setDoctorNew] = useState({
    doctor_name: "",
    doctor_email: "",
    intake_phone: "",
    country: "",
    city: "",
    bulk_intake_notes: "",
  });

  const [clinicNew, setClinicNew] = useState({
    clinic_name: "",
    clinic_email: "",
    clinic_phone: "",
    clinic_website: "",
    country: "",
    city: "",
    bulk_intake_notes: "",
  });

  const [doctorDup, setDoctorDup] = useState<DupState | null>(null);
  const [clinicDup, setClinicDup] = useState<DupState | null>(null);

  const filteredDoctors = useMemo(() => {
    const q = doctorQuery.trim();
    return doctors.filter(
      (d) =>
        fuzzyIncludes(d.name, q) ||
        fuzzyIncludes(d.doctor_email, q) ||
        fuzzyIncludes(d.city, q) ||
        fuzzyIncludes(d.country, q)
    );
  }, [doctors, doctorQuery]);

  const filteredClinics = useMemo(() => {
    const q = clinicQuery.trim();
    return clinics.filter(
      (c) =>
        fuzzyIncludes(c.name, q) ||
        fuzzyIncludes(c.clinic_email, q) ||
        fuzzyIncludes(c.city, q) ||
        fuzzyIncludes(c.country, q)
    );
  }, [clinicQuery, clinics]);

  function setDoctorExisting(id: string | null, label?: string | null) {
    setDoctorDup(null);
    setBatchDetails((d) => ({
      ...d,
      doctor_id: id ? id.trim() || null : null,
    }));
  }

  function setClinicExisting(id: string | null) {
    setClinicDup(null);
    setBatchDetails((d) => ({
      ...d,
      clinic_id: id ? id.trim() || null : null,
    }));
  }

  async function submitNewDoctor(confirmDuplicates: boolean) {
    setErr(null);
    setDoctorDup(null);
    const trimmed = doctorNew.doctor_name.trim();
    if (!trimmed) {
      setErr("Doctor display name is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/hair-audit/bulk-upload/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_name: trimmed,
          doctor_email: doctorNew.doctor_email.trim() || null,
          intake_phone: doctorNew.intake_phone.trim() || null,
          country: doctorNew.country.trim() || null,
          city: doctorNew.city.trim() || null,
          bulk_intake_notes: doctorNew.bulk_intake_notes.trim() || null,
          clinicUserId: batchDetails.clinic_id,
          confirmDuplicates,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 409 && j?.code) {
        setDoctorDup({
          kind: "doctor",
          payload: {
            doctor_name: trimmed,
            doctor_email: doctorNew.doctor_email.trim() || null,
            intake_phone: doctorNew.intake_phone.trim() || null,
            country: doctorNew.country.trim() || null,
            city: doctorNew.city.trim() || null,
            bulk_intake_notes: doctorNew.bulk_intake_notes.trim() || null,
          },
          message: typeof j.message === "string" ? j.message : "Possible duplicate.",
          matches:
            Array.isArray(j.matches) ? (j.matches as BulkDoctorDuplicateMatch[])
            : j.match ? [j.match as BulkDoctorDuplicateMatch]
            : undefined,
        });
        setErr(typeof j.message === "string" ? j.message : null);
        return;
      }
      if (!res.ok || j?.ok !== true) throw new Error(typeof j.error === "string" ? j.error : "Create failed");

      const doc = j.doctor as { userId: string; displayLabel: string; doctorProfileId: string };
      const userId = doc.userId;
      const profileId = doc.doctorProfileId;
      const displayLabel = doc.displayLabel ?? trimmed;

      setDoctors((prev) =>
        [{ profileId: profileId, name: displayLabel, userId, clinicProfileId: null }, ...prev].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setDoctorMode("existing");
      setBatchDetails((d) => ({
        ...d,
        doctor_id: userId,
      }));
      setDoctorNew({
        doctor_name: "",
        doctor_email: "",
        intake_phone: "",
        country: "",
        city: "",
        bulk_intake_notes: "",
      });
      setDoctorQuery(displayLabel.slice(0, 24));
      setDoctorDup(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Doctor create failed");
    } finally {
      setBusy(false);
    }
  }

  async function retryDoctorForce() {
    if (doctorDup?.kind !== "doctor") return;
    setBusy(true);
    setErr(null);
    try {
      const payload = doctorDup.payload;
      const res = await fetch("/api/admin/hair-audit/bulk-upload/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, confirmDuplicates: true, clinicUserId: batchDetails.clinic_id }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || j?.ok !== true) throw new Error(typeof j.error === "string" ? j.error : "Create failed");

      const doc = j.doctor as { userId: string; displayLabel: string; doctorProfileId: string };
      setDoctors((prev) =>
        [{ profileId: doc.doctorProfileId, name: doc.displayLabel, userId: doc.userId, clinicProfileId: null }, ...prev]
      );
      setDoctorMode("existing");
      setBatchDetails((d) => ({
        ...d,
        doctor_id: doc.userId,
      }));
      setDoctorDup(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Doctor create failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitNewClinic(confirmDuplicates: boolean) {
    setErr(null);
    setClinicDup(null);
    const trimmed = clinicNew.clinic_name.trim();
    if (!trimmed) {
      setErr("Clinic name is required.");
      return;
    }
    setBusy(true);
    try {
      const base = {
        clinic_name: trimmed,
        clinic_email: clinicNew.clinic_email.trim() || null,
        clinic_phone: clinicNew.clinic_phone.trim() || null,
        clinic_website: clinicNew.clinic_website.trim() || null,
        country: clinicNew.country.trim() || null,
        city: clinicNew.city.trim() || null,
        bulk_intake_notes: clinicNew.bulk_intake_notes.trim() || null,
        confirmDuplicates,
      };
      const res = await fetch("/api/admin/hair-audit/bulk-upload/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(base),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 409 && j?.code) {
        setClinicDup({
          kind: "clinic",
          payload: base,
          message: typeof j.message === "string" ? j.message : "Possible duplicate clinic.",
          match: (j.match as BulkClinicDuplicateMatch | undefined) ?? undefined,
          suggestions: Array.isArray(j.suggestions) ? (j.suggestions as BulkClinicDuplicateMatch[]) : [],
        });
        setErr(typeof j.message === "string" ? j.message : null);
        return;
      }
      if (!res.ok || j?.ok !== true) throw new Error(typeof j.error === "string" ? j.error : "Create failed");

      const cli = j.clinic as { userId: string; clinicProfileId: string; displayLabel: string };
      setClinics((prev) =>
        [
          {
            profileId: cli.clinicProfileId,
            name: cli.displayLabel,
            userId: cli.userId,
          },
          ...prev,
        ].sort((a, b) => a.name.localeCompare(b.name))
      );
      setClinicMode("existing");
      setBatchDetails((d) => ({
        ...d,
        clinic_id: cli.userId,
      }));
      setClinicNew({
        clinic_name: "",
        clinic_email: "",
        clinic_phone: "",
        clinic_website: "",
        country: "",
        city: "",
        bulk_intake_notes: "",
      });
      setClinicQuery(cli.displayLabel.slice(0, 24));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Clinic create failed");
    } finally {
      setBusy(false);
    }
  }

  async function retryClinicForce() {
    if (clinicDup?.kind !== "clinic") return submitNewClinic(true);
    setBusy(true);
    setErr(null);
    try {
      const payload = clinicDup.payload;
      const res = await fetch("/api/admin/hair-audit/bulk-upload/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, confirmDuplicates: true }),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || j?.ok !== true) throw new Error(typeof j.error === "string" ? j.error : "Create failed");

      const cli = j.clinic as { userId: string; clinicProfileId: string; displayLabel: string };
      setClinics((prev) =>
        [{ profileId: cli.clinicProfileId, name: cli.displayLabel, userId: cli.userId }, ...prev]
      );
      setClinicMode("existing");
      setBatchDetails((d) => ({
        ...d,
        clinic_id: cli.userId,
      }));
      setClinicDup(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Clinic create failed");
    } finally {
      setBusy(false);
    }
  }

  function selectedDoctorLabel() {
    if (!batchDetails.doctor_id) return null;
    return doctors.find((d) => d.userId === batchDetails.doctor_id)?.name ?? "Selected doctor";
  }

  function selectedClinicLabel() {
    if (!batchDetails.clinic_id) return null;
    return clinics.find((c) => c.userId === batchDetails.clinic_id)?.name ?? "Selected clinic";
  }

  return (
    <>
      {/* Clinic */}
      <div className="block md:col-span-2 space-y-2 rounded-lg border border-white/5 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clinic assignment</span>
          <Segmented
            value={clinicMode}
            onChange={(m) => {
              setClinicMode(m);
              setClinicDup(null);
              setErr(null);
              if (m === "unknown" || m === "new") {
                setBatchDetails((d) => ({
                  ...d,
                  clinic_id: null,
                }));
              }
            }}
            options={[
              { id: "existing", label: "Existing" },
              { id: "new", label: "New" },
              { id: "unknown", label: "Unknown" },
            ]}
          />
        </div>

        {clinicMode === "unknown" ? (
          <p className="rounded-md bg-slate-800/70 px-3 py-2 text-xs text-slate-300">
            You can continue without a clinic selected and add this later.
          </p>
        ) : null}

        {clinicMode === "existing" ? (
          <div className="space-y-2">
            {batchDetails.clinic_id ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-950/20 px-3 py-2">
                <span className="text-xs font-semibold text-cyan-100">{selectedClinicLabel()}</span>
                <button
                  type="button"
                  className="ml-auto rounded border border-white/10 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/5"
                  onClick={() => setClinicExisting(null)}
                  disabled={busy}
                >
                  Clear
                </button>
              </div>
            ) : (
              <>
                <input
                  value={clinicQuery}
                  onChange={(e) => setClinicQuery(e.target.value)}
                  placeholder="Search clinic, email, location…"
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <div className="max-h-40 overflow-auto rounded-lg border border-white/10 bg-slate-950">
                  {filteredClinics.length === 0 ? (
                    <p className="p-3 text-xs text-slate-500">No matches — widen search.</p>
                  ) : (
                    <ul className="divide-y divide-white/10 text-sm">
                      {filteredClinics.map((c) => (
                        <li key={c.userId}>
                          <button
                            type="button"
                            className={`block w-full px-3 py-2 text-left hover:bg-slate-800 text-slate-200 ${
                              batchDetails.clinic_id === c.userId ? "bg-slate-800" : ""
                            }`}
                            onClick={() => {
                              setClinicExisting(c.userId);
                              setClinicQuery(c.name);
                            }}
                          >
                            <span className="font-medium text-white">{c.name}</span>
                            {c.clinic_email ? (
                              <span className="ml-2 text-xs text-slate-400">{c.clinic_email}</span>
                            ) : null}
                            {c.city || c.country ? (
                              <span className="block text-[11px] text-slate-500">
                                {[c.city, c.country].filter(Boolean).join(", ")}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}

        {clinicMode === "new" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-400">Clinic name *</span>
              <input
                value={clinicNew.clinic_name}
                onChange={(e) => setClinicNew((n) => ({ ...n, clinic_name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Email</span>
              <input
                type="email"
                value={clinicNew.clinic_email}
                onChange={(e) => setClinicNew((n) => ({ ...n, clinic_email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Phone</span>
              <input
                type="tel"
                value={clinicNew.clinic_phone}
                onChange={(e) => setClinicNew((n) => ({ ...n, clinic_phone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-400">Website</span>
              <input
                value={clinicNew.clinic_website}
                onChange={(e) => setClinicNew((n) => ({ ...n, clinic_website: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                placeholder="example.com"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Country</span>
              <input
                value={clinicNew.country}
                onChange={(e) => setClinicNew((n) => ({ ...n, country: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">City</span>
              <input
                value={clinicNew.city}
                onChange={(e) => setClinicNew((n) => ({ ...n, city: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-400">Notes</span>
              <textarea
                rows={2}
                value={clinicNew.bulk_intake_notes}
                onChange={(e) => setClinicNew((n) => ({ ...n, bulk_intake_notes: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>

            {clinicDup?.kind === "clinic" ? (
              <div className="sm:col-span-2 rounded-lg border border-amber-400/35 bg-amber-950/20 p-3 text-xs text-amber-100 space-y-2">
                <p>{clinicDup.message}</p>
                {clinicDup.match ? (
                  <button
                    type="button"
                    className="rounded border border-white/10 px-2 py-1 text-[11px]"
                    onClick={() => {
                      setClinicMode("existing");
                      setClinicExisting(clinicDup.match!.userId);
                      setClinicQuery(clinicDup.match!.displayLabel);
                      setClinicDup(null);
                    }}
                  >
                    Use "{clinicDup.match.displayLabel}"
                  </button>
                ) : null}
                {clinicDup.suggestions?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {clinicDup.suggestions.map((s) => (
                      <button
                        type="button"
                        key={s.userId}
                        className="rounded border border-white/10 px-2 py-1 text-[11px]"
                        onClick={() => {
                          setClinicMode("existing");
                          setClinicExisting(s.userId);
                          setClinicDup(null);
                          setClinicQuery(s.displayLabel);
                        }}
                      >
                        {s.displayLabel}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void retryClinicForce()}
                  className="rounded bg-amber-800/70 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Create clinic anyway
                </button>
              </div>
            ) : null}

            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                onClick={() => void submitNewClinic(false)}
              >
                Create clinic & select
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Doctor */}
      <div className="block md:col-span-2 space-y-2 rounded-lg border border-white/5 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Doctor assignment</span>
          <Segmented
            value={doctorMode}
            onChange={(m) => {
              setDoctorMode(m);
              setDoctorDup(null);
              setErr(null);
              if (m === "unknown") {
                setBatchDetails((d) => ({
                  ...d,
                  doctor_id: null,
                }));
              }
              if (m === "new") {
                setBatchDetails((d) => ({
                  ...d,
                  doctor_id: null,
                }));
              }
            }}
            options={[
              { id: "existing", label: "Existing" },
              { id: "new", label: "New" },
              { id: "unknown", label: "Unknown" },
            ]}
          />
        </div>

        {doctorMode === "unknown" ? (
          <p className="rounded-md bg-slate-800/70 px-3 py-2 text-xs text-slate-300">
            You can continue without a doctor selected and add this later. The draft batch will save with doctor unset.
          </p>
        ) : null}

        {doctorMode === "existing" ? (
          <div className="space-y-2">
            {batchDetails.doctor_id ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-950/20 px-3 py-2">
                <span className="text-xs font-semibold text-cyan-100">{selectedDoctorLabel()}</span>
                <button
                  type="button"
                  className="ml-auto rounded border border-white/10 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/5"
                  onClick={() => setDoctorExisting(null)}
                  disabled={busy}
                >
                  Clear
                </button>
              </div>
            ) : (
              <>
                <input
                  value={doctorQuery}
                  onChange={(e) => setDoctorQuery(e.target.value)}
                  placeholder="Search name, email, location…"
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <div className="max-h-40 overflow-auto rounded-lg border border-white/10 bg-slate-950">
                  {filteredDoctors.length === 0 ? (
                    <p className="p-3 text-xs text-slate-500">No matches — try wider search.</p>
                  ) : (
                    <ul className="divide-y divide-white/10 text-sm">
                      {filteredDoctors.map((d) => (
                        <li key={d.userId}>
                          <button
                            type="button"
                            className={`block w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800 ${
                              batchDetails.doctor_id === d.userId ? "bg-slate-800" : ""
                            }`}
                            onClick={() => {
                              setDoctorExisting(d.userId, d.name);
                              setDoctorQuery(d.name);
                            }}
                          >
                            <span className="font-medium text-white">{d.name}</span>
                            {d.doctor_email ? (
                              <span className="ml-2 text-xs text-slate-400">{d.doctor_email}</span>
                            ) : null}
                            {d.city || d.country ? (
                              <span className="block text-[11px] text-slate-500">
                                {[d.city, d.country].filter(Boolean).join(", ")}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}

        {doctorMode === "new" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-400">Doctor full name *</span>
              <input
                value={doctorNew.doctor_name}
                onChange={(e) => setDoctorNew((n) => ({ ...n, doctor_name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Email</span>
              <input
                type="email"
                value={doctorNew.doctor_email}
                onChange={(e) => setDoctorNew((n) => ({ ...n, doctor_email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Phone</span>
              <input
                type="tel"
                value={doctorNew.intake_phone}
                onChange={(e) => setDoctorNew((n) => ({ ...n, intake_phone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Country</span>
              <input
                value={doctorNew.country}
                onChange={(e) => setDoctorNew((n) => ({ ...n, country: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">City</span>
              <input
                value={doctorNew.city}
                onChange={(e) => setDoctorNew((n) => ({ ...n, city: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-400">Notes</span>
              <textarea
                rows={2}
                value={doctorNew.bulk_intake_notes}
                onChange={(e) => setDoctorNew((n) => ({ ...n, bulk_intake_notes: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>

            <p className="text-[11px] text-slate-500 sm:col-span-2">
              If clinic is unknown, linking is skipped until a clinic exists. When an existing clinic is selected above,
              the new doctor attaches to their clinic_profile when permitted.
            </p>

            {doctorDup?.kind === "doctor" ? (
              <div className="sm:col-span-2 rounded-lg border border-amber-400/35 bg-amber-950/20 p-3 text-xs text-amber-100 space-y-2">
                <p>{doctorDup.message}</p>
                {doctorDup.matches?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {doctorDup.matches.map((m) => (
                      <button
                        type="button"
                        key={m.userId}
                        className="rounded border border-white/10 px-2 py-1 text-[11px]"
                        onClick={() => {
                          setDoctorMode("existing");
                          setDoctorDup(null);
                          setDoctorExisting(m.userId, m.displayLabel);
                          setDoctorQuery(m.displayLabel);
                        }}
                      >
                        Use "{m.displayLabel}"
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void retryDoctorForce()}
                  className="rounded bg-amber-800/70 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Create separately anyway
                </button>
              </div>
            ) : null}

            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                onClick={() => void submitNewDoctor(false)}
              >
                Create doctor & select
              </button>
            </div>
          </div>
        ) : null}
      </div>


    </>
  );
}
