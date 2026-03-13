"use client";

import { useMemo, useState } from "react";

export type DoctorItem = {
  id: string;
  doctor_name: string;
  doctor_email: string | null;
  profile_image_url: string | null;
  professional_title: string | null;
  short_bio: string | null;
  specialties: string[] | null;
  years_experience: number | null;
  public_summary: string | null;
  associated_branches: string[] | null;
  is_active: boolean;
  archived_at: string | null;
  clinic_role: string;
  case_permissions: Record<string, unknown> | null;
  can_respond_audits: boolean;
  can_submit_cases: boolean;
  can_view_internal_cases: boolean;
  updated_at?: string;
};

type Props = {
  initialItems: DoctorItem[];
  canManageDoctors: boolean;
  userRole: string;
};

type FormState = {
  id: string | null;
  fullName: string;
  email: string;
  profileImage: string;
  title: string;
  shortBio: string;
  specialties: string;
  yearsExperience: string;
  publicSummary: string;
  associatedBranches: string;
  clinicRole: string;
  canRespondToAudits: boolean;
  canSubmitCases: boolean;
  canViewInternalCases: boolean;
  isActive: boolean;
};

const defaultForm: FormState = {
  id: null,
  fullName: "",
  email: "",
  profileImage: "",
  title: "",
  shortBio: "",
  specialties: "",
  yearsExperience: "",
  publicSummary: "",
  associatedBranches: "",
  clinicRole: "doctor",
  canRespondToAudits: true,
  canSubmitCases: true,
  canViewInternalCases: false,
  isActive: true,
};

function parseCsv(input: string): string[] {
  return input
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function ClinicDoctorsManager({ initialItems, canManageDoctors, userRole }: Props) {
  const [items, setItems] = useState<DoctorItem[]>(initialItems);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [query, setQuery] = useState("");
  const activeCount = items.filter((d) => d.is_active).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((d) =>
      [d.doctor_name, d.professional_title ?? "", d.clinic_role ?? "", ...(d.specialties ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, query]);

  function startEdit(item: DoctorItem) {
    setEditingId(item.id);
    setForm({
      id: item.id,
      fullName: item.doctor_name ?? "",
      email: item.doctor_email ?? "",
      profileImage: item.profile_image_url ?? "",
      title: item.professional_title ?? "",
      shortBio: item.short_bio ?? "",
      specialties: (item.specialties ?? []).join(", "),
      yearsExperience: item.years_experience != null ? String(item.years_experience) : "",
      publicSummary: item.public_summary ?? "",
      associatedBranches: (item.associated_branches ?? []).join(", "),
      clinicRole: item.clinic_role ?? "doctor",
      canRespondToAudits: item.can_respond_audits !== false,
      canSubmitCases: item.can_submit_cases !== false,
      canViewInternalCases: Boolean(item.can_view_internal_cases),
      isActive: item.is_active !== false,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(defaultForm);
  }

  async function saveDoctor() {
    if (!canManageDoctors) return;
    if (!form.fullName.trim()) {
      setMessage("Doctor full name is required.");
      return;
    }
    setSaving(true);
    setMessage("");
    const payload = {
      id: form.id,
      fullName: form.fullName,
      email: form.email,
      profileImage: form.profileImage,
      title: form.title,
      shortBio: form.shortBio,
      specialties: parseCsv(form.specialties),
      yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : null,
      publicSummary: form.publicSummary,
      associatedBranches: parseCsv(form.associatedBranches),
      clinicRole: form.clinicRole,
      canRespondToAudits: form.canRespondToAudits,
      canSubmitCases: form.canSubmitCases,
      canViewInternalCases: form.canViewInternalCases,
      isActive: form.isActive,
    };
    try {
      const res = await fetch("/api/clinic-portal/doctors", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Unable to save doctor.");
      const saved = json?.item as DoctorItem;
      setItems((prev) => {
        if (!editingId) return [saved, ...prev];
        return prev.map((item) => (item.id === saved.id ? saved : item));
      });
      setMessage(editingId ? "Doctor updated." : "Doctor added.");
      resetForm();
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? "Unable to save doctor.");
    } finally {
      setSaving(false);
    }
  }

  async function setDoctorActive(item: DoctorItem, isActive: boolean) {
    if (!canManageDoctors) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/clinic-portal/doctors", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, isActive }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Unable to update doctor status.");
      const saved = json?.item as DoctorItem;
      setItems((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      setMessage(isActive ? "Doctor reactivated." : "Doctor archived/deactivated.");
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? "Unable to update doctor status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doctor Layer</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Clinic doctor roster</h2>
            <p className="mt-1 text-sm text-slate-600">
              Build doctor-level attribution and permissions now to prepare for benchmarking and training insights later.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Active doctors: <span className="font-semibold text-slate-900">{activeCount}</span> / {items.length}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-5">
            <p className="text-sm font-semibold text-cyan-900">
              Add your doctors to strengthen profile trust, improve case attribution, and prepare for benchmarking.
            </p>
            <p className="mt-1 text-xs text-cyan-800">
              This doctor layer is structured for future doctor benchmarking, case assignment, public profiles, and training intelligence.
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">
            {editingId ? "Edit doctor" : "Add doctor"}
          </h3>
          <p className="text-xs text-slate-500">Your role: {userRole}</p>
        </div>
        {!canManageDoctors ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Only clinic owner/admin can add, edit, or archive doctors.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-600">
              Full name
              <input
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Professional title / role
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Lead Hair Transplant Surgeon"
              />
            </label>
            <label className="text-xs text-slate-600">
              Email
              <input
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Years experience
              <input
                type="number"
                min={0}
                value={form.yearsExperience}
                onChange={(e) => setForm((prev) => ({ ...prev, yearsExperience: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600 md:col-span-2">
              Specialties (comma-separated)
              <input
                value={form.specialties}
                onChange={(e) => setForm((prev) => ({ ...prev, specialties: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="FUE, DHI, donor management"
              />
            </label>
            <label className="text-xs text-slate-600 md:col-span-2">
              Profile image URL
              <input
                value={form.profileImage}
                onChange={(e) => setForm((prev) => ({ ...prev, profileImage: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600 md:col-span-2">
              Short bio
              <textarea
                rows={3}
                value={form.shortBio}
                onChange={(e) => setForm((prev) => ({ ...prev, shortBio: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600 md:col-span-2">
              Public-facing summary
              <textarea
                rows={2}
                value={form.publicSummary}
                onChange={(e) => setForm((prev) => ({ ...prev, publicSummary: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600 md:col-span-2">
              Associated branches (comma-separated)
              <input
                value={form.associatedBranches}
                onChange={(e) => setForm((prev) => ({ ...prev, associatedBranches: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Istanbul Main Branch, Dubai Branch"
              />
            </label>
            <label className="text-xs text-slate-600">
              Clinic role
              <select
                value={form.clinicRole}
                onChange={(e) => setForm((prev) => ({ ...prev, clinicRole: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="lead_surgeon">Lead Surgeon</option>
                <option value="surgeon">Surgeon</option>
                <option value="assistant">Assistant</option>
                <option value="coordinator">Coordinator</option>
                <option value="admin">Admin</option>
                <option value="other">Other</option>
              </select>
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Internal permissions</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.canRespondToAudits}
                    onChange={(e) => setForm((prev) => ({ ...prev, canRespondToAudits: e.target.checked }))}
                  />
                  Can respond to audits
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.canSubmitCases}
                    onChange={(e) => setForm((prev) => ({ ...prev, canSubmitCases: e.target.checked }))}
                  />
                  Can submit cases
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.canViewInternalCases}
                    onChange={(e) => setForm((prev) => ({ ...prev, canViewInternalCases: e.target.checked }))}
                  />
                  Can view internal-only cases
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveDoctor}
            disabled={!canManageDoctors || saving}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : editingId ? "Update doctor" : "Add doctor"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel edit
            </button>
          ) : null}
          <p className="text-xs text-slate-500">{message}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">Doctors</h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search doctors or specialties..."
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No doctors match this view.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((doctor) => (
              <article key={doctor.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {doctor.profile_image_url ? (
                      <img
                        src={doctor.profile_image_url}
                        alt={doctor.doctor_name}
                        className="h-12 w-12 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-700">
                        {doctor.doctor_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-900">{doctor.doctor_name}</p>
                      <p className="text-xs text-slate-500">
                        {doctor.professional_title || "Doctor"} · {doctor.years_experience ?? "—"} yrs
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      doctor.is_active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-slate-200 text-slate-700"
                    }`}
                  >
                    {doctor.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-600">
                  {doctor.short_bio || doctor.public_summary || "No bio added yet."}
                </p>

                <div className="mt-2 flex flex-wrap gap-1">
                  {(doctor.specialties ?? []).slice(0, 4).map((specialty) => (
                    <span
                      key={`${doctor.id}-${specialty}`}
                      className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>

                <div className="mt-2 text-[11px] text-slate-500">
                  Clinic role: {doctor.clinic_role} · Branches: {(doctor.associated_branches ?? []).join(", ") || "—"}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {canManageDoctors ? (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(doctor)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Edit doctor
                      </button>
                      <button
                        type="button"
                        onClick={() => setDoctorActive(doctor, !doctor.is_active)}
                        disabled={saving}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {doctor.is_active ? "Archive / Deactivate" : "Reactivate"}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Read-only (owner/admin required to edit)</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
