"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DONOR_DEPLETION_LEVELS,
  MEDICATION_HISTORY_KEYS,
  RECIPIENT_ZONES,
  VISIBLE_SCARRING_LEVELS,
  type ClinicalHistorySnapshot,
  type MedicationHistoryKey,
} from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import { hasMeaningfulClinicalHistory } from "@/lib/hairaudit/clinical-history/clinicalHistoryUtils";
import {
  saveCaseClinicalHistoryAction,
  saveCaseClinicalHistoryAndRegenerateAction,
} from "@/app/cases/[caseId]/clinicalHistoryActions";

const MED_LABELS: Record<MedicationHistoryKey, string> = {
  finasteride: "Finasteride",
  dutasteride: "Dutasteride",
  topical_minoxidil: "Topical minoxidil",
  oral_minoxidil: "Oral minoxidil",
  saw_palmetto: "Saw palmetto",
  prp: "PRP",
  exosomes: "Exosomes",
  other: "Other",
};

const ZONE_LABELS: Record<(typeof RECIPIENT_ZONES)[number], string> = {
  frontal_hairline: "Frontal hairline",
  temples: "Temples",
  mid_scalp: "Mid scalp",
  crown: "Crown",
  donor: "Donor",
  unknown: "Unknown",
};

const LEVEL_LABELS: Record<string, string> = {
  none: "None",
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
  unknown: "Unknown",
};

type FormState = {
  priorSurgeryCount: string;
  priorProcedureType: string;
  priorSurgeryDate: string;
  priorClinicName: string;
  priorSurgeonName: string;
  priorGraftCount: string;
  estimatedHairCount: string;
  averageHairsPerGraft: string;
  donorGraftsRemoved: string;
  recipientZones: string[];
  donorDepletionLevel: string;
  visibleScarringLevel: string;
  medicationHistory: Record<string, boolean | string>;
  supportingDocumentNotes: string;
  clinicianSummary: string;
};

function snapshotToForm(snapshot: ClinicalHistorySnapshot | null): FormState {
  const meds: Record<string, boolean | string> = {};
  for (const key of MEDICATION_HISTORY_KEYS) {
    const v = snapshot?.medicationHistory?.[key];
    if (key === "other") {
      meds.other = typeof v === "string" ? v : v === true ? "" : "";
    } else {
      meds[key] = v === true;
    }
  }
  return {
    priorSurgeryCount: snapshot?.priorSurgeryCount != null ? String(snapshot.priorSurgeryCount) : "",
    priorProcedureType: snapshot?.priorProcedureType ?? "",
    priorSurgeryDate: snapshot?.priorSurgeryDate ?? "",
    priorClinicName: snapshot?.priorClinicName ?? "",
    priorSurgeonName: snapshot?.priorSurgeonName ?? "",
    priorGraftCount: snapshot?.priorGraftCount != null ? String(snapshot.priorGraftCount) : "",
    estimatedHairCount: snapshot?.estimatedHairCount != null ? String(snapshot.estimatedHairCount) : "",
    averageHairsPerGraft:
      snapshot?.averageHairsPerGraft != null ? String(snapshot.averageHairsPerGraft) : "",
    donorGraftsRemoved: snapshot?.donorGraftsRemoved != null ? String(snapshot.donorGraftsRemoved) : "",
    recipientZones: snapshot?.recipientZones ?? [],
    donorDepletionLevel: snapshot?.donorDepletionLevel ?? "",
    visibleScarringLevel: snapshot?.visibleScarringLevel ?? "",
    medicationHistory: meds,
    supportingDocumentNotes: snapshot?.supportingDocumentNotes ?? "",
    clinicianSummary: snapshot?.clinicianSummary ?? "",
  };
}

function formToPayload(form: FormState) {
  const medicationHistory: Record<string, boolean | string> = {};
  for (const key of MEDICATION_HISTORY_KEYS) {
    if (key === "other") {
      const note = String(form.medicationHistory.other ?? "").trim();
      if (note) medicationHistory.other = note;
      else if (form.medicationHistory.other === true) medicationHistory.other = true;
      continue;
    }
    if (form.medicationHistory[key]) medicationHistory[key] = true;
  }
  return {
    priorSurgeryCount: form.priorSurgeryCount.trim() ? Number(form.priorSurgeryCount) : null,
    priorProcedureType: form.priorProcedureType.trim() || null,
    priorSurgeryDate: form.priorSurgeryDate.trim() || null,
    priorClinicName: form.priorClinicName.trim() || null,
    priorSurgeonName: form.priorSurgeonName.trim() || null,
    priorGraftCount: form.priorGraftCount.trim() ? Number(form.priorGraftCount) : null,
    estimatedHairCount: form.estimatedHairCount.trim() ? Number(form.estimatedHairCount) : null,
    averageHairsPerGraft: form.averageHairsPerGraft.trim() ? Number(form.averageHairsPerGraft) : null,
    donorGraftsRemoved: form.donorGraftsRemoved.trim() ? Number(form.donorGraftsRemoved) : null,
    recipientZones: form.recipientZones,
    donorDepletionLevel: form.donorDepletionLevel || null,
    visibleScarringLevel: form.visibleScarringLevel || null,
    medicationHistory,
    supportingDocumentNotes: form.supportingDocumentNotes.trim() || null,
    clinicianSummary: form.clinicianSummary.trim() || null,
  };
}

export default function CaseClinicalHistoryPanel({
  caseId,
  initialSnapshot,
}: {
  caseId: string;
  initialSnapshot: ClinicalHistorySnapshot | null;
}) {
  const hasData = useMemo(() => hasMeaningfulClinicalHistory(initialSnapshot), [initialSnapshot]);
  const [form, setForm] = useState<FormState>(() => snapshotToForm(initialSnapshot));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleZone = (zone: string) => {
    setForm((prev) => {
      const set = new Set(prev.recipientZones);
      if (set.has(zone)) set.delete(zone);
      else set.add(zone);
      return { ...prev, recipientZones: Array.from(set) };
    });
  };

  const toggleMed = (key: MedicationHistoryKey) => {
    setForm((prev) => ({
      ...prev,
      medicationHistory: {
        ...prev.medicationHistory,
        [key]: key === "other" ? !prev.medicationHistory.other : !prev.medicationHistory[key],
      },
    }));
  };

  const handleSave = async (regenerate: boolean) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = formToPayload(form);
      const result = regenerate
        ? await saveCaseClinicalHistoryAndRegenerateAction(caseId, payload)
        : await saveCaseClinicalHistoryAction(caseId, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setForm(snapshotToForm(result.snapshot));
      const warning =
        regenerate && "warning" in result && result.warning ? ` ${result.warning}` : "";
      const regenNote =
        regenerate && "rerunLogId" in result && result.rerunLogId
          ? " Audit regeneration queued."
          : "";
      setSuccess(
        (regenerate ? "Clinical history saved." : "Clinical history saved successfully.") +
          regenNote +
          warning
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-slate-900/50 text-white px-3 py-2 text-sm placeholder-slate-500";
  const labelClass = "block text-xs font-medium text-slate-300 mb-1";

  return (
    <details
      className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-5 group"
      open={hasData}
    >
      <summary className="cursor-pointer list-none font-semibold text-white flex items-center justify-between gap-2">
        <span>Structured Clinical History</span>
        {hasData ? (
          <span className="text-xs font-normal text-emerald-300">Data on file</span>
        ) : (
          <span className="text-xs font-normal text-slate-400">Collapsed — no data yet</span>
        )}
      </summary>

      <p className="mt-2 text-xs text-slate-400">
        Use this when prior surgery reports, graft counts, medication history, or external clinical
        documents need to be added manually.
      </p>
      <p className="mt-1 text-xs text-amber-200/80">
        If a PDF contains graft numbers or operative details, enter them here so they can be included
        in the audit. Supporting PDFs remain visible in the upload gallery below — they are not
        substitutes for required patient photos.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelClass}>Previous surgery count</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={form.priorSurgeryCount}
            onChange={(e) => updateField("priorSurgeryCount", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Procedure type</label>
          <input
            className={inputClass}
            value={form.priorProcedureType}
            onChange={(e) => updateField("priorProcedureType", e.target.value)}
            placeholder="e.g. FUE repair"
          />
        </div>
        <div>
          <label className={labelClass}>Surgery date</label>
          <input
            type="date"
            className={inputClass}
            value={form.priorSurgeryDate}
            onChange={(e) => updateField("priorSurgeryDate", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Clinic name</label>
          <input
            className={inputClass}
            value={form.priorClinicName}
            onChange={(e) => updateField("priorClinicName", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Surgeon name</label>
          <input
            className={inputClass}
            value={form.priorSurgeonName}
            onChange={(e) => updateField("priorSurgeonName", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Total grafts</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={form.priorGraftCount}
            onChange={(e) => updateField("priorGraftCount", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Estimated hairs</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={form.estimatedHairCount}
            onChange={(e) => updateField("estimatedHairCount", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Average hairs per graft</label>
          <input
            type="number"
            min={1}
            max={4.5}
            step={0.01}
            className={inputClass}
            value={form.averageHairsPerGraft}
            onChange={(e) => updateField("averageHairsPerGraft", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Donor grafts removed</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={form.donorGraftsRemoved}
            onChange={(e) => updateField("donorGraftsRemoved", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Donor depletion level</label>
          <select
            className={inputClass}
            value={form.donorDepletionLevel}
            onChange={(e) => updateField("donorDepletionLevel", e.target.value)}
          >
            <option value="">—</option>
            {DONOR_DEPLETION_LEVELS.map((v) => (
              <option key={v} value={v}>
                {LEVEL_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Visible scarring level</label>
          <select
            className={inputClass}
            value={form.visibleScarringLevel}
            onChange={(e) => updateField("visibleScarringLevel", e.target.value)}
          >
            <option value="">—</option>
            {VISIBLE_SCARRING_LEVELS.map((v) => (
              <option key={v} value={v}>
                {LEVEL_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <p className={labelClass}>Recipient zones</p>
        <div className="flex flex-wrap gap-2">
          {RECIPIENT_ZONES.map((zone) => (
            <button
              key={zone}
              type="button"
              onClick={() => toggleZone(zone)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                form.recipientZones.includes(zone)
                  ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {ZONE_LABELS[zone]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className={labelClass}>Medication history</p>
        <div className="flex flex-wrap gap-3">
          {MEDICATION_HISTORY_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={Boolean(form.medicationHistory[key])}
                onChange={() => toggleMed(key)}
                className="rounded border-white/20"
              />
              {MED_LABELS[key]}
            </label>
          ))}
        </div>
        {form.medicationHistory.other ? (
          <input
            className={`${inputClass} mt-2`}
            placeholder="Other medication notes"
            value={typeof form.medicationHistory.other === "string" ? form.medicationHistory.other : ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                medicationHistory: { ...prev.medicationHistory, other: e.target.value },
              }))
            }
          />
        ) : null}
      </div>

      <div className="mt-4 grid gap-4">
        <div>
          <label className={labelClass}>Supporting document notes</label>
          <textarea
            rows={3}
            className={inputClass}
            value={form.supportingDocumentNotes}
            onChange={(e) => updateField("supportingDocumentNotes", e.target.value)}
            placeholder="Graft counts or operative details transcribed from uploaded PDFs"
          />
        </div>
        <div>
          <label className={labelClass}>Clinician summary (internal)</label>
          <textarea
            rows={3}
            className={inputClass}
            value={form.clinicianSummary}
            onChange={(e) => updateField("clinicianSummary", e.target.value)}
            placeholder="Operator notes — not shown verbatim to patients"
          />
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-300">{success}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave(false)}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-950 bg-slate-200 hover:bg-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save clinical history"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave(true)}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save and regenerate audit"}
        </button>
      </div>
    </details>
  );
}
