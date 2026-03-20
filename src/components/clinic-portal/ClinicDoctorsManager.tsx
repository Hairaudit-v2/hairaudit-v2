"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

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
  const { t } = useI18n();
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
      setMessage(t("dashboard.clinic.forms.doctorsManager.requiredName"));
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
      if (!res.ok) throw new Error(json?.error ?? t("dashboard.clinic.forms.doctorsManager.saveFailed"));
      const saved = json?.item as DoctorItem;
      setItems((prev) => {
        if (!editingId) return [saved, ...prev];
        return prev.map((item) => (item.id === saved.id ? saved : item));
      });
      setMessage(editingId ? t("dashboard.clinic.forms.doctorsManager.messageUpdated") : t("dashboard.clinic.forms.doctorsManager.messageAdded"));
      resetForm();
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? t("dashboard.clinic.forms.doctorsManager.saveFailed"));
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
      if (!res.ok) throw new Error(json?.error ?? t("dashboard.clinic.forms.doctorsManager.statusUpdateFailed"));
      const saved = json?.item as DoctorItem;
      setItems((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      setMessage(
        isActive
          ? t("dashboard.clinic.forms.doctorsManager.messageReactivated")
          : t("dashboard.clinic.forms.doctorsManager.messageArchived")
      );
    } catch (error: unknown) {
      setMessage((error as Error)?.message ?? t("dashboard.clinic.forms.doctorsManager.statusUpdateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("dashboard.clinic.forms.doctorsManager.eyebrow")}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{t("dashboard.clinic.forms.doctorsManager.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("dashboard.clinic.forms.doctorsManager.subtitle")}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {t("dashboard.clinic.forms.doctorsManager.activeDoctorsPrefix")} <span className="font-semibold text-slate-900">{activeCount}</span> / {items.length}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-5">
            <p className="text-sm font-semibold text-cyan-900">
              {t("dashboard.clinic.forms.doctorsManager.emptyTitle")}
            </p>
            <p className="mt-1 text-xs text-cyan-800">
              {t("dashboard.clinic.forms.doctorsManager.emptyBody")}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">
            {editingId ? t("dashboard.clinic.forms.doctorsManager.editTitle") : t("dashboard.clinic.forms.doctorsManager.addTitle")}
          </h3>
          <p className="text-xs text-slate-500">{t("dashboard.clinic.forms.doctorsManager.yourRolePrefix")} {userRole}</p>
        </div>
        {!canManageDoctors ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {t("dashboard.clinic.forms.doctorsManager.ownerOnly")}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-600">
              {t("dashboard.clinic.forms.doctorsManager.fullName")}
              <input
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              {t("dashboard.clinic.forms.doctorsManager.professionalTitle")}
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={t("dashboard.clinic.forms.doctorsManager.professionalTitlePlaceholder")}
              />
            </label>
            <label className="text-xs text-slate-600">
              {t("dashboard.clinic.forms.doctorsManager.email")}
              <input
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              {t("dashboard.clinic.forms.doctorsManager.yearsExperience")}
              <input
                type="number"
                min={0}
                value={form.yearsExperience}
                onChange={(e) => setForm((prev) => ({ ...prev, yearsExperience: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600 md:col-span-2">
              {t("dashboard.clinic.forms.doctorsManager.specialties")}
              <input
                value={form.specialties}
                onChange={(e) => setForm((prev) => ({ ...prev, specialties: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={t("dashboard.clinic.forms.doctorsManager.specialtiesPlaceholder")}
              />
            </label>
            <label className="text-xs text-slate-600 md:col-span-2">
              {t("dashboard.clinic.forms.doctorsManager.profileImage")}
              <input
                value={form.profileImage}
                onChange={(e) => setForm((prev) => ({ ...prev, profileImage: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600 md:col-span-2">
              {t("dashboard.clinic.forms.doctorsManager.shortBio")}
              <textarea
                rows={3}
                value={form.shortBio}
                onChange={(e) => setForm((prev) => ({ ...prev, shortBio: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600 md:col-span-2">
              {t("dashboard.clinic.forms.doctorsManager.publicSummary")}
              <textarea
                rows={2}
                value={form.publicSummary}
                onChange={(e) => setForm((prev) => ({ ...prev, publicSummary: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600 md:col-span-2">
              {t("dashboard.clinic.forms.doctorsManager.associatedBranches")}
              <input
                value={form.associatedBranches}
                onChange={(e) => setForm((prev) => ({ ...prev, associatedBranches: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder={t("dashboard.clinic.forms.doctorsManager.associatedBranchesPlaceholder")}
              />
            </label>
            <label className="text-xs text-slate-600">
              {t("dashboard.clinic.forms.doctorsManager.clinicRole")}
              <select
                value={form.clinicRole}
                onChange={(e) => setForm((prev) => ({ ...prev, clinicRole: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="lead_surgeon">{t("dashboard.clinic.forms.doctorsManager.clinicRoleLead")}</option>
                <option value="surgeon">{t("dashboard.clinic.forms.doctorsManager.clinicRoleDoctor")}</option>
                <option value="assistant">{t("dashboard.clinic.forms.doctorsManager.clinicRoleAssistant")}</option>
                <option value="coordinator">{t("dashboard.clinic.forms.doctorsManager.clinicRoleCoordinator")}</option>
                <option value="admin">{t("dashboard.clinic.forms.doctorsManager.clinicRoleAdmin")}</option>
                <option value="other">{t("dashboard.clinic.forms.doctorsManager.clinicRoleOther")}</option>
              </select>
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("dashboard.clinic.forms.doctorsManager.cardPermissions")}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.canRespondToAudits}
                    onChange={(e) => setForm((prev) => ({ ...prev, canRespondToAudits: e.target.checked }))}
                  />
                  {t("dashboard.clinic.forms.doctorsManager.canRespondAudits")}
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.canSubmitCases}
                    onChange={(e) => setForm((prev) => ({ ...prev, canSubmitCases: e.target.checked }))}
                  />
                  {t("dashboard.clinic.forms.doctorsManager.canSubmitCases")}
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.canViewInternalCases}
                    onChange={(e) => setForm((prev) => ({ ...prev, canViewInternalCases: e.target.checked }))}
                  />
                  {t("dashboard.clinic.forms.doctorsManager.canViewInternalCases")}
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  {t("dashboard.clinic.forms.doctorsManager.isActive")}
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
            {saving ? t("dashboard.shared.auditForms.saving") : editingId ? t("dashboard.clinic.forms.doctorsManager.editTitle") : t("dashboard.clinic.forms.doctorsManager.addTitle")}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("dashboard.clinic.forms.doctorsManager.cancel")}
            </button>
          ) : null}
          <p className="text-xs text-slate-500">{message}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">{t("dashboard.clinic.forms.doctorsManager.title")}</h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("dashboard.clinic.forms.doctorsManager.searchPlaceholder")}
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {t("dashboard.clinic.forms.doctorsManager.noResults")}
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
                        {doctor.professional_title || t("dashboard.clinic.forms.doctorsManager.clinicRoleDoctor")} · {doctor.years_experience ?? "—"} yrs
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
                    {doctor.is_active ? t("dashboard.clinic.forms.doctorsManager.isActive") : t("dashboard.clinic.forms.doctorsManager.inactive")}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-600">
                  {doctor.short_bio || doctor.public_summary || t("dashboard.clinic.forms.doctorsManager.noBio")}
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
                  {t("dashboard.clinic.forms.doctorsManager.clinicRole")}: {doctor.clinic_role} · {t("dashboard.clinic.forms.doctorsManager.associatedBranches")}: {(doctor.associated_branches ?? []).join(", ") || "—"}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {canManageDoctors ? (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(doctor)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {t("dashboard.clinic.forms.doctorsManager.editAction")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDoctorActive(doctor, !doctor.is_active)}
                        disabled={saving}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {doctor.is_active ? t("dashboard.clinic.forms.doctorsManager.archiveAction") : t("dashboard.clinic.forms.doctorsManager.reactivateAction")}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">{t("dashboard.clinic.forms.doctorsManager.ownerOnly")}</span>
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
