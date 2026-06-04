"use client";

import React, { useState } from "react";
import type { SurgeryUploadClinicDefaults } from "@/lib/surgeryUpload/clinicDefaults";

type FormState = {
  default_extraction_machine: string;
  default_punch_type: string;
  default_punch_size: string;
  default_implantation_method: string;
  default_prp_used: boolean | null;
  default_exosomes_used: boolean | null;
  default_storage_solution: string;
  default_notes: string;
};

function initFromDefaults(d: SurgeryUploadClinicDefaults | null): FormState {
  return {
    default_extraction_machine: d?.default_extraction_machine ?? "",
    default_punch_type: d?.default_punch_type ?? "",
    default_punch_size: d?.default_punch_size ?? "",
    default_implantation_method: d?.default_implantation_method ?? "",
    default_prp_used: d?.default_prp_used ?? null,
    default_exosomes_used: d?.default_exosomes_used ?? null,
    default_storage_solution: d?.default_storage_solution ?? "",
    default_notes: d?.default_notes ?? "",
  };
}

export default function SurgeryDefaultsClient({
  clinicProfileId,
  editable,
  isAuditor,
  initialDefaults,
}: {
  clinicProfileId: string;
  editable: boolean;
  isAuditor: boolean;
  initialDefaults: SurgeryUploadClinicDefaults | null;
}) {
  const [form, setForm] = useState<FormState>(initFromDefaults(initialDefaults));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = !editable || saving;
  const noDefaultsSaved = initialDefaults === null;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function save() {
    if (!editable || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (isAuditor) payload.clinicProfileId = clinicProfileId;
      const res = await fetch("/api/surgery-upload/defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Could not save defaults");
      setSaved(true);
    } catch (e) {
      setError((e as Error)?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      {!editable && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          You can view these clinic defaults but only the clinic owner (or an auditor)
          can change them.
        </div>
      )}

      {noDefaultsSaved && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          No clinic defaults saved yet.
          {editable
            ? " Fill in any values below and save to start pre-filling new surgery uploads."
            : ""}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Default surgery details</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          New surgery uploads start with these values. Each case can be changed individually.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Default extraction machine">
            <input
              className={inputCls}
              placeholder="e.g. WAW, Devroye, manual"
              value={form.default_extraction_machine}
              disabled={disabled}
              onChange={(e) => setField("default_extraction_machine", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Default punch size">
              <input
                className={inputCls}
                inputMode="decimal"
                placeholder="e.g. 0.9"
                value={form.default_punch_size}
                disabled={disabled}
                onChange={(e) => setField("default_punch_size", e.target.value)}
              />
            </Field>
            <Field label="Default punch type / brand">
              <input
                className={inputCls}
                placeholder="Optional"
                value={form.default_punch_type}
                disabled={disabled}
                onChange={(e) => setField("default_punch_type", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Default implantation method / device">
            <input
              className={inputCls}
              placeholder="e.g. implanter pens, forceps"
              value={form.default_implantation_method}
              disabled={disabled}
              onChange={(e) => setField("default_implantation_method", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <TriToggle
              label="PRP intra-op by default"
              value={form.default_prp_used}
              disabled={disabled}
              onChange={(v) => setField("default_prp_used", v)}
            />
            <TriToggle
              label="Exosomes by default"
              value={form.default_exosomes_used}
              disabled={disabled}
              onChange={(v) => setField("default_exosomes_used", v)}
            />
          </div>

          <Field label="Default storage solution (ATP / HypoThermosol / other)">
            <input
              className={inputCls}
              placeholder="Storage solution"
              value={form.default_storage_solution}
              disabled={disabled}
              onChange={(e) => setField("default_storage_solution", e.target.value)}
            />
          </Field>

          <Field label="Default notes">
            <textarea
              className={`${inputCls} resize-y`}
              rows={3}
              placeholder="Optional default notes for new uploads"
              value={form.default_notes}
              disabled={disabled}
              onChange={(e) => setField("default_notes", e.target.value)}
            />
          </Field>
        </div>
      </section>

      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1 text-xs">
              {saved && <span className="font-medium text-emerald-700">Defaults saved ✓</span>}
              {error && <span className="text-red-600">{error}</span>}
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="shrink-0 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save defaults"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function TriToggle({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean | null;
  disabled: boolean;
  onChange: (v: boolean | null) => void;
}) {
  const options: { v: boolean | null; label: string }[] = [
    { v: true, label: "Yes" },
    { v: false, label: "No" },
    { v: null, label: "—" },
  ];
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex overflow-hidden rounded-xl border border-slate-300">
        {options.map((opt) => {
          const active = value === opt.v;
          return (
            <button
              key={opt.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.v)}
              className={`flex-1 px-2 py-3 text-sm font-semibold transition ${
                active ? "bg-cyan-600 text-white" : "bg-white text-slate-600"
              } disabled:opacity-60`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
