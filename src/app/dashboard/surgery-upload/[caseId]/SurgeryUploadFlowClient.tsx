"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UploadedThumb from "@/components/uploads/UploadedThumb";
import { UPLOAD_LIMITS, UploadQueue, formatUploadErrorForUser } from "@/lib/uploads/safeUpload";
import {
  SURGERY_PHOTO_SLOTS,
  slotFromSurgeryType,
  getMissingRequiredSurgerySlots,
  type SurgeryPhotoSlot,
  type SurgeryPhotoSlotKey,
} from "@/lib/surgeryUpload/checklist";
import { SURGERY_PROCEDURE_TYPES, type SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";

export type SurgeryUploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata: unknown;
  created_at: string;
};

const uploadQueue = new UploadQueue(UPLOAD_LIMITS.MAX_CONCURRENT_UPLOADS);
const PHOTO_API = "/api/surgery-upload/photos";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SurgeryUploadFlowClient({
  caseId,
  initialDetails,
  initialUploads,
}: {
  caseId: string;
  initialDetails: SurgeryUploadDetails;
  initialUploads: SurgeryUploadRow[];
}) {
  const router = useRouter();
  const [details, setDetails] = useState<SurgeryUploadDetails>(initialDetails);
  const [uploads, setUploads] = useState<SurgeryUploadRow[]>(initialUploads);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busySlots, setBusySlots] = useState<Record<string, boolean>>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const locked = details.status === "submitted";

  const uploadsBySlot = useMemo(() => {
    const map: Record<string, SurgeryUploadRow[]> = {};
    for (const u of uploads) {
      const slot = slotFromSurgeryType(u.type);
      if (!slot) continue;
      (map[slot] ||= []).push(u);
    }
    return map;
  }, [uploads]);

  const missingRequired = useMemo(
    () => getMissingRequiredSurgerySlots(uploads),
    [uploads]
  );
  const requiredTotal = SURGERY_PHOTO_SLOTS.filter((s) => s.required).length;
  const requiredDone = requiredTotal - missingRequired.length;
  const canSubmit = !locked && missingRequired.length === 0;

  // ---- Details autosave ------------------------------------------------------
  const saveField = useCallback(
    async (patch: Record<string, unknown>) => {
      if (locked) return;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/surgery-upload/cases/${caseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Could not save");
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch {
        setSaveState("error");
      }
    },
    [caseId, locked]
  );

  const onText = (field: keyof SurgeryUploadDetails) => ({
    value: (details[field] as string | number | null) ?? "",
    disabled: locked,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDetails((d) => ({ ...d, [field]: e.target.value })),
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      saveField({ [field]: e.target.value === "" ? null : e.target.value }),
  });

  const onBool = (field: "prp_used" | "exosomes_used", value: boolean) => {
    setDetails((d) => ({ ...d, [field]: value }));
    saveField({ [field]: value });
  };

  const onSelectProcedure = (value: string) => {
    setDetails((d) => ({ ...d, procedure_type: (value || null) as SurgeryUploadDetails["procedure_type"] }));
    saveField({ procedure_type: value || null });
  };

  const onDate = (value: string) => {
    setDetails((d) => ({ ...d, surgery_date: value || null }));
    saveField({ surgery_date: value || null });
  };

  // ---- Photo upload ----------------------------------------------------------
  const uploadFiles = useCallback(
    async (slot: SurgeryPhotoSlotKey, files: File[]) => {
      if (locked || files.length === 0) return;
      setBusySlots((m) => ({ ...m, [slot]: true }));
      setSlotErrors((m) => {
        const { [slot]: _omit, ...rest } = m;
        return rest;
      });

      const errors: string[] = [];
      for (const file of files) {
        try {
          await uploadQueue.execute(async () => {
            const fd = new FormData();
            fd.append("caseId", caseId);
            fd.append("category", slot);
            fd.append("files[]", file);
            const res = await fetch(PHOTO_API, { method: "POST", body: fd });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(
                formatUploadErrorForUser({
                  code: json?.code ?? "UNKNOWN_ERROR",
                  message: json?.error ?? "Upload failed",
                  retryable: false,
                })
              );
            }
            if (json.saved?.length) {
              setUploads((prev) => [...json.saved, ...prev]);
            }
          });
        } catch (e) {
          errors.push(`${file.name}: ${(e as Error)?.message ?? "Upload failed"}`);
        }
      }

      setBusySlots((m) => {
        const { [slot]: _omit, ...rest } = m;
        return rest;
      });
      if (errors.length) setSlotErrors((m) => ({ ...m, [slot]: errors[0] }));
    },
    [caseId, locked]
  );

  const onDeleted = useCallback((uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  }, []);

  // ---- Submit ----------------------------------------------------------------
  const submit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/surgery-upload/cases/${caseId}/submit`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.missingRequiredSlots?.length) {
          throw new Error("Some required photos are still missing.");
        }
        throw new Error(json?.error ?? "Could not submit");
      }
      setDetails((d) => ({
        ...d,
        status: "submitted",
        submitted_at: json?.details?.submitted_at ?? new Date().toISOString(),
      }));
      router.refresh();
    } catch (e) {
      setSubmitError((e as Error)?.message ?? "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, submitting, caseId, router]);

  if (locked) {
    return <SubmittedConfirmation details={details} photoCount={uploads.length} />;
  }

  return (
    <div className="mt-3 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Surgery upload</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            Draft
          </span>
          {details.prefilled_from_clinic_defaults && (
            <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-800">
              Using clinic defaults
            </span>
          )}
          <SaveIndicator state={saveState} />
        </div>
      </header>

      {/* Progress */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">Required photos</span>
          <span className="font-semibold text-slate-900">
            {requiredDone} / {requiredTotal}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-cyan-500 transition-all"
            style={{ width: `${requiredTotal ? (requiredDone / requiredTotal) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Section 1: case basics */}
      <Section title="Case details" subtitle="Who and what this surgery was for.">
        <Field label="Patient / case reference">
          <input className={inputCls} placeholder="e.g. HT-1042 or initials" {...onText("patient_reference")} />
        </Field>
        <Field label="Clinic">
          <input className={inputCls} placeholder="Clinic name" {...onText("clinic_name")} />
        </Field>
        <Field label="Doctor / surgeon">
          <input className={inputCls} placeholder="Surgeon name" {...onText("surgeon_name")} />
        </Field>
        <Field label="Surgery date">
          <input
            type="date"
            className={inputCls}
            value={details.surgery_date ?? ""}
            disabled={locked}
            onChange={(e) => onDate(e.target.value)}
          />
        </Field>
        <Field label="Procedure type">
          <select
            className={inputCls}
            value={details.procedure_type ?? ""}
            disabled={locked}
            onChange={(e) => onSelectProcedure(e.target.value)}
          >
            <option value="">Select…</option>
            {SURGERY_PROCEDURE_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <textarea className={textareaCls} rows={3} placeholder="General notes" {...onText("notes")} />
        </Field>
      </Section>

      {/* Section 2: surgery preferences/details */}
      <Section
        title="Surgery details"
        subtitle="Equipment and intra-operative details. Change for this case only — clinic defaults are unaffected."
      >
        {details.prefilled_from_clinic_defaults && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-cyan-800">
            <p className="text-sm font-semibold">Using clinic defaults</p>
            <p className="mt-0.5 text-xs">
              These values were copied from the clinic&apos;s saved preferences. Changes
              here apply to this surgery only.
            </p>
          </div>
        )}
        <Field label="Extraction machine used">
          <input className={inputCls} placeholder="e.g. WAW, Devroye, manual" {...onText("extraction_machine")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Punch size">
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder="e.g. 0.8, 0.9, 1.0"
              {...onText("punch_size")}
            />
          </Field>
          <Field label="Punch type / brand">
            <input className={inputCls} placeholder="Optional" {...onText("punch_type")} />
          </Field>
        </div>
        <Field label="Implantation method / device">
          <input className={inputCls} placeholder="e.g. implanter pens, forceps" {...onText("implantation_method")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <ToggleField
            label="PRP used intra-op"
            value={details.prp_used}
            disabled={locked}
            onChange={(v) => onBool("prp_used", v)}
          />
          <ToggleField
            label="Exosomes used"
            value={details.exosomes_used}
            disabled={locked}
            onChange={(v) => onBool("exosomes_used", v)}
          />
        </div>
        <Field label="ATP / HypoThermosol / storage solution">
          <input className={inputCls} placeholder="Storage solution used" {...onText("storage_solution")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Planned grafts">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputCls}
              {...onText("planned_grafts")}
            />
          </Field>
          <Field label="Actual grafts">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputCls}
              {...onText("actual_grafts")}
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Extraction start">
            <input type="time" className={inputCls} {...onText("extraction_start_time")} />
          </Field>
          <Field label="Implantation start">
            <input type="time" className={inputCls} {...onText("implantation_start_time")} />
          </Field>
          <Field label="Finish">
            <input type="time" className={inputCls} {...onText("surgery_finish_time")} />
          </Field>
        </div>
        <Field label="Notes / complications">
          <textarea
            className={textareaCls}
            rows={3}
            placeholder="Optional"
            {...onText("complication_notes")}
          />
        </Field>
      </Section>

      {/* Section 3: required photos */}
      <Section title="Required photos" subtitle="All six are needed before you can submit.">
        <div className="space-y-3">
          {SURGERY_PHOTO_SLOTS.filter((s) => s.required).map((slot) => (
            <PhotoSlotCard
              key={slot.key}
              slot={slot}
              existing={uploadsBySlot[slot.key] ?? []}
              busy={!!busySlots[slot.key]}
              error={slotErrors[slot.key]}
              locked={locked}
              onUpload={(files) => uploadFiles(slot.key, files)}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      </Section>

      {/* Section 4: optional photos */}
      <Section title="Optional photos" subtitle="Add any that apply.">
        <div className="space-y-3">
          {SURGERY_PHOTO_SLOTS.filter((s) => !s.required).map((slot) => (
            <PhotoSlotCard
              key={slot.key}
              slot={slot}
              existing={uploadsBySlot[slot.key] ?? []}
              busy={!!busySlots[slot.key]}
              error={slotErrors[slot.key]}
              locked={locked}
              onUpload={(files) => uploadFiles(slot.key, files)}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      </Section>

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs text-slate-500">
            {canSubmit ? (
              <span className="font-medium text-emerald-700">Ready to submit</span>
            ) : (
              <span>{missingRequired.length} required photo(s) remaining</span>
            )}
            {submitError && <p className="text-red-600">{submitError}</p>}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || submitting}
            className={`shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-white transition ${
              canSubmit && !submitting
                ? "bg-cyan-600 active:scale-[0.99]"
                : "cursor-not-allowed bg-slate-300"
            }`}
          >
            {submitting ? "Submitting…" : "Submit for review"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500";
const textareaCls = `${inputCls} resize-y`;

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean | null;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex overflow-hidden rounded-xl border border-slate-300">
        {[
          { v: true, label: "Yes" },
          { v: false, label: "No" },
        ].map((opt) => {
          const active = value === opt.v;
          return (
            <button
              key={opt.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.v)}
              className={`flex-1 px-3 py-3 text-sm font-semibold transition ${
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

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <span className="text-xs text-slate-400">Saving…</span>;
  if (state === "saved") return <span className="text-xs text-emerald-600">Saved ✓</span>;
  if (state === "error")
    return <span className="text-xs text-red-600">Save failed — retry</span>;
  return null;
}

function PhotoSlotCard({
  slot,
  existing,
  busy,
  error,
  locked,
  onUpload,
  onDeleted,
}: {
  slot: SurgeryPhotoSlot;
  existing: SurgeryUploadRow[];
  busy: boolean;
  error?: string;
  locked: boolean;
  onUpload: (files: File[]) => void;
  onDeleted: (id: string) => void;
}) {
  const remaining = Math.max(0, slot.maxFiles - existing.length);
  const disabled = locked || remaining <= 0 || busy;
  const done = existing.length > 0;

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    if (files.length) onUpload(files);
    e.target.value = "";
  }

  return (
    <div
      className={`rounded-xl border p-3 ${
        slot.required && !done ? "border-amber-300 bg-amber-50/40" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">
            {slot.label}
            {slot.required && <span className="ml-1 text-xs text-amber-700">(required)</span>}
          </p>
          <p className="text-xs text-slate-500">{slot.help}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            done ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
          }`}
        >
          {done ? `${existing.length} ✓` : "0"}
        </span>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {existing.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {existing.map((u) => (
            <UploadedThumb key={u.id} upload={u} locked={locked} onDeleted={() => onDeleted(u.id)} />
          ))}
        </div>
      )}

      {!locked && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {/* Camera capture (mobile) */}
          <label
            className={`flex items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm font-semibold text-cyan-800 ${
              disabled ? "opacity-60" : "active:scale-[0.99]"
            }`}
          >
            {busy ? "Uploading…" : "Take photo"}
            <input
              type="file"
              accept={slot.accept}
              capture="environment"
              className="hidden"
              disabled={disabled}
              onChange={handleInput}
            />
          </label>
          {/* Gallery / multiple */}
          <label
            className={`flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700 ${
              disabled ? "opacity-60" : "active:scale-[0.99]"
            }`}
          >
            Choose
            <input
              type="file"
              accept={slot.accept}
              multiple
              className="hidden"
              disabled={disabled}
              onChange={handleInput}
            />
          </label>
        </div>
      )}
      {remaining <= 0 && !locked && (
        <p className="mt-2 text-xs text-slate-400">Maximum reached</p>
      )}
    </div>
  );
}

function SubmittedConfirmation({
  details,
  photoCount,
}: {
  details: SurgeryUploadDetails;
  photoCount: number;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
        ✓
      </div>
      <h1 className="mt-4 text-xl font-bold text-slate-900">Submitted for review</h1>
      <p className="mt-1 text-sm text-slate-600">
        {details.patient_reference?.trim() || "This surgery upload"} has been submitted with{" "}
        {photoCount} photo{photoCount === 1 ? "" : "s"}. It is now locked to preserve
        integrity.
      </p>
      {details.submitted_at && (
        <p className="mt-2 text-xs text-slate-400">
          Submitted {new Date(details.submitted_at).toLocaleString()}
        </p>
      )}
      <Link
        href="/dashboard/surgery-upload"
        className="mt-5 inline-flex rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white"
      >
        Back to surgery uploads
      </Link>
    </div>
  );
}
