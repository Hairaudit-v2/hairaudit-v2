"use client";

import React, { useMemo, useState } from "react";
import type { SurgeryUploadClinicDefaults } from "@/lib/surgeryUpload/clinicDefaults";
import {
  getResolvedSurgeryChecklist,
  coerceMinCount,
  LOCKED_REQUIRED_SURGERY_SLOTS,
  OPTIONAL_SURGERY_SLOT_KEYS,
  SURGERY_PHOTO_SLOTS,
  CHECKLIST_CONFIG_VERSION,
  DEFAULT_SLOT_MIN_COUNT,
  MIN_SLOT_MIN_COUNT,
  MAX_SLOT_MIN_COUNT,
  type SurgerySlotState,
  type SurgeryPhotoSlotKey,
  type SurgeryChecklistConfig,
} from "@/lib/surgeryUpload/checklist";

const MIN_COUNT_HELP =
  "Minimum photo count helps ensure enough angles are captured for reliable review.";

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

const SLOT_LABELS = new Map<SurgeryPhotoSlotKey, string>(
  SURGERY_PHOTO_SLOTS.map((s) => [s.key, s.label])
);
const SLOT_HELP = new Map<SurgeryPhotoSlotKey, string>(
  SURGERY_PHOTO_SLOTS.map((s) => [s.key, s.help])
);

type SlotPref = { state: SurgerySlotState; minCount: number };
type ChecklistState = Record<SurgeryPhotoSlotKey, SlotPref>;

function initChecklist(d: SurgeryUploadClinicDefaults | null): ChecklistState {
  const resolved = getResolvedSurgeryChecklist(d?.default_photo_checklist_config);
  const state = {} as ChecklistState;
  for (const slot of resolved) {
    state[slot.key] = { state: slot.state, minCount: slot.minCount };
  }
  return state;
}

/** True when this slot's minCount actually applies (only required slots require photos). */
function minCountApplies(pref: SlotPref): boolean {
  return pref.state === "required";
}

/**
 * Build the config to persist from the editable slot prefs. Locked slots are always
 * required. Returns null when the result is equivalent to the HairAudit base (all
 * optional slots "optional" AND every minCount at the default of 1), keeping the
 * stored value clean for reset-to-default.
 */
function buildChecklistPayload(state: ChecklistState): SurgeryChecklistConfig | null {
  const optionalAllBase = OPTIONAL_SURGERY_SLOT_KEYS.every(
    (k) => state[k]?.state === "optional"
  );
  const minCountsAllDefault = SURGERY_PHOTO_SLOTS.every(
    (s) => (state[s.key]?.minCount ?? DEFAULT_SLOT_MIN_COUNT) === DEFAULT_SLOT_MIN_COUNT
  );
  if (optionalAllBase && minCountsAllDefault) return null;

  const slots: SurgeryChecklistConfig["slots"] = {};
  SURGERY_PHOTO_SLOTS.forEach((slot, index) => {
    const locked = LOCKED_REQUIRED_SURGERY_SLOTS.includes(slot.key);
    const pref = state[slot.key] ?? { state: "optional", minCount: DEFAULT_SLOT_MIN_COUNT };
    slots[slot.key] = {
      state: locked ? "required" : pref.state,
      order: index,
      minCount: coerceMinCount(pref.minCount),
    };
  });
  return { version: CHECKLIST_CONFIG_VERSION, slots };
}

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
  const [checklist, setChecklist] = useState<ChecklistState>(() =>
    initChecklist(initialDefaults)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = !editable || saving;
  const noDefaultsSaved = initialDefaults === null;

  const isChecklistBase = useMemo(
    () =>
      OPTIONAL_SURGERY_SLOT_KEYS.every((k) => checklist[k]?.state === "optional") &&
      SURGERY_PHOTO_SLOTS.every(
        (s) => (checklist[s.key]?.minCount ?? DEFAULT_SLOT_MIN_COUNT) === DEFAULT_SLOT_MIN_COUNT
      ),
    [checklist]
  );

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function setSlotState(key: SurgeryPhotoSlotKey, value: SurgerySlotState) {
    setChecklist((c) => ({ ...c, [key]: { ...c[key], state: value } }));
    setSaved(false);
  }

  function setSlotMinCount(key: SurgeryPhotoSlotKey, value: number) {
    setChecklist((c) => ({ ...c, [key]: { ...c[key], minCount: coerceMinCount(value) } }));
    setSaved(false);
  }

  function resetChecklist() {
    setChecklist((c) => {
      const next = { ...c };
      for (const s of SURGERY_PHOTO_SLOTS) {
        const locked = LOCKED_REQUIRED_SURGERY_SLOTS.includes(s.key);
        next[s.key] = {
          state: locked ? "required" : "optional",
          minCount: DEFAULT_SLOT_MIN_COUNT,
        };
      }
      return next;
    });
    setSaved(false);
  }

  async function save() {
    if (!editable || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      // Stage 3: persist photo checklist preferences. Locked HairAudit minimum slots
      // are always required; null resets to the HairAudit default.
      payload.default_photo_checklist_config = buildChecklistPayload(checklist);
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

      {/* Stage 3: per-clinic photo checklist preferences */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Photo checklist preferences</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              HairAudit&apos;s core evidence photos stay required to protect audit
              quality. You can make extra categories required or hide optional
              categories your clinic does not use.
            </p>
          </div>
          {editable && !isChecklistBase && (
            <button
              type="button"
              onClick={resetChecklist}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-cyan-300"
            >
              Reset to HairAudit default
            </button>
          )}
        </div>

        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {MIN_COUNT_HELP}
        </p>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            HairAudit required (locked)
          </p>
          <div className="space-y-2">
            {LOCKED_REQUIRED_SURGERY_SLOTS.map((key) => (
              <div
                key={key}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 block text-sm font-medium text-slate-800">
                    {SLOT_LABELS.get(key) ?? key}
                  </span>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    Required • locked
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600">
                    Minimum photos
                  </span>
                  <MinCountStepper
                    value={checklist[key]?.minCount ?? DEFAULT_SLOT_MIN_COUNT}
                    disabled={disabled}
                    onChange={(v) => setSlotMinCount(key, v)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Optional categories
          </p>
          <div className="space-y-3">
            {OPTIONAL_SURGERY_SLOT_KEYS.map((key) => {
              const pref = checklist[key] ?? {
                state: "optional" as SurgerySlotState,
                minCount: DEFAULT_SLOT_MIN_COUNT,
              };
              const applies = minCountApplies(pref);
              return (
                <div key={key} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-800">
                    {SLOT_LABELS.get(key) ?? key}
                  </p>
                  {SLOT_HELP.get(key) && (
                    <p className="text-xs text-slate-500">{SLOT_HELP.get(key)}</p>
                  )}
                  <div className="mt-2">
                    <SlotStateToggle
                      value={pref.state}
                      disabled={disabled}
                      onChange={(v) => setSlotState(key, v)}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-medium ${
                        applies ? "text-slate-600" : "text-slate-400"
                      }`}
                    >
                      Minimum photos {applies ? "" : "(set to Required to use)"}
                    </span>
                    <MinCountStepper
                      value={pref.minCount}
                      disabled={disabled || !applies}
                      onChange={(v) => setSlotMinCount(key, v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
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

function MinCountStepper({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const dec = () => onChange(Math.max(MIN_SLOT_MIN_COUNT, value - 1));
  const inc = () => onChange(Math.min(MAX_SLOT_MIN_COUNT, value + 1));
  return (
    <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-slate-300">
      <button
        type="button"
        disabled={disabled || value <= MIN_SLOT_MIN_COUNT}
        onClick={dec}
        aria-label="Decrease minimum"
        className="h-10 w-10 text-lg font-semibold text-slate-700 disabled:opacity-40"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-semibold text-slate-900" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        disabled={disabled || value >= MAX_SLOT_MIN_COUNT}
        onClick={inc}
        aria-label="Increase minimum"
        className="h-10 w-10 text-lg font-semibold text-slate-700 disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

function SlotStateToggle({
  value,
  disabled,
  onChange,
}: {
  value: SurgerySlotState;
  disabled: boolean;
  onChange: (v: SurgerySlotState) => void;
}) {
  const options: { v: SurgerySlotState; label: string }[] = [
    { v: "required", label: "Required" },
    { v: "optional", label: "Optional" },
    { v: "hidden", label: "Hidden" },
  ];
  return (
    <div className="flex overflow-hidden rounded-xl border border-slate-300">
      {options.map((opt) => {
        const active = value === opt.v;
        return (
          <button
            key={opt.v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.v)}
            className={`flex-1 px-2 py-2.5 text-sm font-semibold transition ${
              active ? "bg-cyan-600 text-white" : "bg-white text-slate-600"
            } disabled:opacity-60`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
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
