"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DONOR_DEPLETION_LEVELS,
  EXTRACTION_METHODS,
  IMPLANTATION_METHODS,
  MEDICATION_HISTORY_KEYS,
  PRIOR_PROCEDURE_TYPES,
  RECIPIENT_ZONES,
  VISIBLE_SCARRING_LEVELS,
  type ClinicalHistorySnapshot,
  type ClinicalHistoryUpsertPayload,
  type MedicationHistoryKey,
} from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import {
  calculateAverageHairsPerGraft,
  calculateFromGraftDistribution,
} from "@/lib/hairaudit/clinical-history/clinicalHistoryCalculations";
import {
  formatParsedClinicalHistorySummary,
  hasParsedClinicalHistorySuggestions,
  parseClinicalHistoryPasteText,
  type ParsedClinicalHistorySuggestions,
} from "@/lib/hairaudit/clinical-history/clinicalHistoryPasteParser";
import { hasMeaningfulClinicalHistory, clinicalHistorySnapshotFromPayload } from "@/lib/hairaudit/clinical-history/clinicalHistoryUtils";
import {
  saveCaseClinicalHistoryAction,
  saveCaseClinicalHistoryAndRegenerateAction,
  saveCaseClinicalHistoryAndRegenerateImageLimitedAction,
} from "@/app/cases/[caseId]/clinicalHistoryActions";

const MED_LABELS: Record<MedicationHistoryKey, string> = {
  finasteride: "Finasteride",
  dutasteride: "Dutasteride",
  topical_minoxidil: "Topical Minoxidil",
  oral_minoxidil: "Oral Minoxidil",
  saw_palmetto: "Saw Palmetto",
  prp: "PRP",
  exosomes: "Exosomes",
  none_unknown: "None / Unknown",
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

const PROCEDURE_LABELS: Record<(typeof PRIOR_PROCEDURE_TYPES)[number], string> = {
  fue: "FUE",
  fut: "FUT",
  dhi: "DHI",
  repair: "Repair",
  unknown: "Unknown",
};

const EXTRACTION_LABELS: Record<(typeof EXTRACTION_METHODS)[number], string> = {
  manual_punch: "Manual punch",
  motorised_punch: "Motorised punch",
  robotic: "Robotic",
  unknown: "Unknown",
};

const IMPLANTATION_LABELS: Record<(typeof IMPLANTATION_METHODS)[number], string> = {
  forceps: "Forceps",
  implanter_pen: "Implanter pen",
  dhi: "DHI",
  unknown: "Unknown",
};

const PUNCH_CHIPS = ["0.75", "0.80", "0.85", "0.90", "1.00"] as const;

const DATE_QUICK_OPTIONS = [
  { label: "Unknown", timingNote: "Unknown", clearDate: true },
  { label: "Approx 1 year ago", timingNote: "Approx 1 year ago", clearDate: true },
  { label: "Approx 2 years ago", timingNote: "Approx 2 years ago", clearDate: true },
  { label: "Approx 5+ years ago", timingNote: "Approx 5+ years ago", clearDate: true },
] as const;

type FormState = {
  priorSurgeryCount: string;
  priorProcedureType: string;
  priorSurgeryDate: string;
  priorSurgeryTimingNote: string;
  priorClinicName: string;
  priorSurgeonName: string;
  priorGraftCount: string;
  estimatedHairCount: string;
  averageHairsPerGraft: string;
  singleHairGrafts: string;
  doubleHairGrafts: string;
  tripleHairGrafts: string;
  quadrupleHairGrafts: string;
  donorGraftsRemoved: string;
  punchSizeMm: string;
  extractionMethod: string;
  implantationMethod: string;
  transectionRatePercent: string;
  survivalEstimatePercent: string;
  recipientZones: string[];
  donorDepletionLevel: string;
  donorReserveAssessment: string;
  visibleScarringLevel: string;
  surgicalTechniqueNotes: string;
  medicationHistory: Record<string, boolean | string>;
  supportingDocumentNotes: string;
  clinicianSummary: string;
};

type OverrideFlags = {
  priorGraftCount: boolean;
  estimatedHairCount: boolean;
  averageHairsPerGraft: boolean;
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
    priorSurgeryTimingNote: snapshot?.priorSurgeryTimingNote ?? "",
    priorClinicName: snapshot?.priorClinicName ?? "",
    priorSurgeonName: snapshot?.priorSurgeonName ?? "",
    priorGraftCount: snapshot?.priorGraftCount != null ? String(snapshot.priorGraftCount) : "",
    estimatedHairCount: snapshot?.estimatedHairCount != null ? String(snapshot.estimatedHairCount) : "",
    averageHairsPerGraft:
      snapshot?.averageHairsPerGraft != null ? String(snapshot.averageHairsPerGraft) : "",
    singleHairGrafts: snapshot?.singleHairGrafts != null ? String(snapshot.singleHairGrafts) : "",
    doubleHairGrafts: snapshot?.doubleHairGrafts != null ? String(snapshot.doubleHairGrafts) : "",
    tripleHairGrafts: snapshot?.tripleHairGrafts != null ? String(snapshot.tripleHairGrafts) : "",
    quadrupleHairGrafts:
      snapshot?.quadrupleHairGrafts != null ? String(snapshot.quadrupleHairGrafts) : "",
    donorGraftsRemoved: snapshot?.donorGraftsRemoved != null ? String(snapshot.donorGraftsRemoved) : "",
    punchSizeMm: snapshot?.punchSizeMm != null ? String(snapshot.punchSizeMm) : "",
    extractionMethod: snapshot?.extractionMethod ?? "",
    implantationMethod: snapshot?.implantationMethod ?? "",
    transectionRatePercent:
      snapshot?.transectionRatePercent != null ? String(snapshot.transectionRatePercent) : "",
    survivalEstimatePercent:
      snapshot?.survivalEstimatePercent != null ? String(snapshot.survivalEstimatePercent) : "",
    recipientZones: snapshot?.recipientZones ?? [],
    donorDepletionLevel: snapshot?.donorDepletionLevel ?? "",
    donorReserveAssessment: snapshot?.donorReserveAssessment ?? "",
    visibleScarringLevel: snapshot?.visibleScarringLevel ?? "",
    surgicalTechniqueNotes: snapshot?.surgicalTechniqueNotes ?? "",
    medicationHistory: meds,
    supportingDocumentNotes: snapshot?.supportingDocumentNotes ?? "",
    clinicianSummary: snapshot?.clinicianSummary ?? "",
  };
}

function formToPayload(form: FormState): ClinicalHistoryUpsertPayload {
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
    priorSurgeryTimingNote: form.priorSurgeryTimingNote.trim() || null,
    priorClinicName: form.priorClinicName.trim() || null,
    priorSurgeonName: form.priorSurgeonName.trim() || null,
    priorGraftCount: form.priorGraftCount.trim() ? Number(form.priorGraftCount) : null,
    estimatedHairCount: form.estimatedHairCount.trim() ? Number(form.estimatedHairCount) : null,
    averageHairsPerGraft: form.averageHairsPerGraft.trim() ? Number(form.averageHairsPerGraft) : null,
    singleHairGrafts: form.singleHairGrafts.trim() ? Number(form.singleHairGrafts) : null,
    doubleHairGrafts: form.doubleHairGrafts.trim() ? Number(form.doubleHairGrafts) : null,
    tripleHairGrafts: form.tripleHairGrafts.trim() ? Number(form.tripleHairGrafts) : null,
    quadrupleHairGrafts: form.quadrupleHairGrafts.trim() ? Number(form.quadrupleHairGrafts) : null,
    donorGraftsRemoved: form.donorGraftsRemoved.trim() ? Number(form.donorGraftsRemoved) : null,
    punchSizeMm: form.punchSizeMm.trim() ? Number(form.punchSizeMm) : null,
    extractionMethod: (form.extractionMethod || null) as ClinicalHistoryUpsertPayload["extractionMethod"],
    implantationMethod: (form.implantationMethod || null) as ClinicalHistoryUpsertPayload["implantationMethod"],
    transectionRatePercent: form.transectionRatePercent.trim()
      ? Number(form.transectionRatePercent)
      : null,
    survivalEstimatePercent: form.survivalEstimatePercent.trim()
      ? Number(form.survivalEstimatePercent)
      : null,
    recipientZones: form.recipientZones as ClinicalHistoryUpsertPayload["recipientZones"],
    donorDepletionLevel: (form.donorDepletionLevel || null) as ClinicalHistoryUpsertPayload["donorDepletionLevel"],
    donorReserveAssessment: form.donorReserveAssessment.trim() || null,
    visibleScarringLevel: (form.visibleScarringLevel || null) as ClinicalHistoryUpsertPayload["visibleScarringLevel"],
    surgicalTechniqueNotes: form.surgicalTechniqueNotes.trim() || null,
    medicationHistory,
    supportingDocumentNotes: form.supportingDocumentNotes.trim() || null,
    clinicianSummary: form.clinicianSummary.trim() || null,
  };
}

function CollapsibleSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="rounded-xl border border-white/10 bg-slate-950/40 overflow-hidden group"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-4 py-3 font-medium text-white flex items-center justify-between gap-2 hover:bg-white/5">
        <span>{title}</span>
        <span className="text-xs text-slate-500 group-open:hidden">Expand</span>
      </summary>
      <div className="px-4 pb-4 pt-1">{children}</div>
    </details>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
        active
          ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-100"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  step,
  min,
  max,
  suffix,
  calculated,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
  min?: number;
  max?: number;
  suffix?: string;
  calculated?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-300 mb-1">
        {label}
        {calculated ? <span className="ml-1 text-emerald-400/80">(auto)</span> : null}
      </label>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step ?? "1"}
          className="w-full rounded-xl border border-white/10 bg-slate-900/60 text-white px-4 py-3 text-lg font-medium placeholder-slate-500 focus:border-emerald-400/40 focus:outline-none"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function CaseClinicalHistoryPanel({
  caseId,
  initialSnapshot,
  hasPatientImages = false,
  photosMissing = false,
}: {
  caseId: string;
  initialSnapshot: ClinicalHistorySnapshot | null;
  hasPatientImages?: boolean;
  photosMissing?: boolean;
}) {
  const hasData = useMemo(() => hasMeaningfulClinicalHistory(initialSnapshot), [initialSnapshot]);
  const [form, setForm] = useState<FormState>(() => snapshotToForm(initialSnapshot));
  const [overrides, setOverrides] = useState<OverrideFlags>({
    priorGraftCount: false,
    estimatedHairCount: false,
    averageHairsPerGraft: false,
  });
  const [pasteText, setPasteText] = useState("");
  const [pasteSuggestions, setPasteSuggestions] = useState<ParsedClinicalHistorySuggestions | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const markOverride = (key: keyof OverrideFlags) => {
    setOverrides((prev) => ({ ...prev, [key]: true }));
  };

  useEffect(() => {
    setForm((prev) => {
      const singles = Number(prev.singleHairGrafts) || 0;
      const doubles = Number(prev.doubleHairGrafts) || 0;
      const triples = Number(prev.tripleHairGrafts) || 0;
      const quadruples = Number(prev.quadrupleHairGrafts) || 0;
      const hasDistribution = singles + doubles + triples + quadruples > 0;

      if (hasDistribution) {
        const totals = calculateFromGraftDistribution(singles, doubles, triples, quadruples);
        if (!totals) return prev;
        const nextGrafts = overrides.priorGraftCount ? prev.priorGraftCount : String(totals.totalGrafts);
        const nextHairs = overrides.estimatedHairCount ? prev.estimatedHairCount : String(totals.estimatedHairs);
        const nextAvg = overrides.averageHairsPerGraft
          ? prev.averageHairsPerGraft
          : String(totals.averageHairsPerGraft);
        if (
          prev.priorGraftCount === nextGrafts &&
          prev.estimatedHairCount === nextHairs &&
          prev.averageHairsPerGraft === nextAvg
        ) {
          return prev;
        }
        return {
          ...prev,
          priorGraftCount: nextGrafts,
          estimatedHairCount: nextHairs,
          averageHairsPerGraft: nextAvg,
        };
      }

      const grafts = Number(prev.priorGraftCount);
      const hairs = Number(prev.estimatedHairCount);
      if (grafts > 0 && hairs > 0 && !overrides.averageHairsPerGraft) {
        const avg = calculateAverageHairsPerGraft(grafts, hairs);
        if (avg != null) {
          const nextAvg = String(avg);
          if (prev.averageHairsPerGraft === nextAvg) return prev;
          return { ...prev, averageHairsPerGraft: nextAvg };
        }
      }
      return prev;
    });
  }, [
    form.singleHairGrafts,
    form.doubleHairGrafts,
    form.tripleHairGrafts,
    form.quadrupleHairGrafts,
    form.priorGraftCount,
    form.estimatedHairCount,
    overrides,
  ]);

  const canImageLimitedRegenerate = useMemo(() => {
    const payload = formToPayload(form);
    return hasPatientImages || hasMeaningfulClinicalHistory(clinicalHistorySnapshotFromPayload(payload));
  }, [form, hasPatientImages]);

  const toggleZone = (zone: string) => {
    setForm((prev) => {
      const set = new Set(prev.recipientZones);
      if (set.has(zone)) set.delete(zone);
      else set.add(zone);
      return { ...prev, recipientZones: Array.from(set) };
    });
  };

  const toggleMed = (key: MedicationHistoryKey) => {
    setForm((prev) => {
      if (key === "none_unknown") {
        const next = !prev.medicationHistory.none_unknown;
        const medicationHistory: Record<string, boolean | string> = { none_unknown: next };
        if (next && prev.medicationHistory.other && typeof prev.medicationHistory.other === "string") {
          medicationHistory.other = prev.medicationHistory.other;
        }
        return { ...prev, medicationHistory };
      }
      const medicationHistory: Record<string, boolean | string> = {
        ...prev.medicationHistory,
        none_unknown: false,
      };
      medicationHistory[key] =
        key === "other" ? !prev.medicationHistory.other : !prev.medicationHistory[key];
      return { ...prev, medicationHistory };
    });
  };

  const handlePasteChange = (text: string) => {
    setPasteText(text);
    const parsed = parseClinicalHistoryPasteText(text);
    setPasteSuggestions(hasParsedClinicalHistorySuggestions(parsed) ? parsed : null);
  };

  const applyPasteSuggestions = () => {
    if (!pasteSuggestions) return;
    setForm((prev) => ({
      ...prev,
      priorGraftCount:
        pasteSuggestions.priorGraftCount != null
          ? String(pasteSuggestions.priorGraftCount)
          : prev.priorGraftCount,
      estimatedHairCount:
        pasteSuggestions.estimatedHairCount != null
          ? String(pasteSuggestions.estimatedHairCount)
          : prev.estimatedHairCount,
      averageHairsPerGraft:
        pasteSuggestions.averageHairsPerGraft != null
          ? String(pasteSuggestions.averageHairsPerGraft)
          : prev.averageHairsPerGraft,
      punchSizeMm:
        pasteSuggestions.punchSizeMm != null ? String(pasteSuggestions.punchSizeMm) : prev.punchSizeMm,
      singleHairGrafts:
        pasteSuggestions.singleHairGrafts != null
          ? String(pasteSuggestions.singleHairGrafts)
          : prev.singleHairGrafts,
      doubleHairGrafts:
        pasteSuggestions.doubleHairGrafts != null
          ? String(pasteSuggestions.doubleHairGrafts)
          : prev.doubleHairGrafts,
      tripleHairGrafts:
        pasteSuggestions.tripleHairGrafts != null
          ? String(pasteSuggestions.tripleHairGrafts)
          : prev.tripleHairGrafts,
      quadrupleHairGrafts:
        pasteSuggestions.quadrupleHairGrafts != null
          ? String(pasteSuggestions.quadrupleHairGrafts)
          : prev.quadrupleHairGrafts,
      transectionRatePercent:
        pasteSuggestions.transectionRatePercent != null
          ? String(pasteSuggestions.transectionRatePercent)
          : prev.transectionRatePercent,
      survivalEstimatePercent:
        pasteSuggestions.survivalEstimatePercent != null
          ? String(pasteSuggestions.survivalEstimatePercent)
          : prev.survivalEstimatePercent,
    }));
    setOverrides({ priorGraftCount: false, estimatedHairCount: false, averageHairsPerGraft: false });
    setPasteSuggestions(null);
    setPasteText("");
  };

  const setDateQuick = (timingNote: string, clearDate: boolean) => {
    setForm((prev) => ({
      ...prev,
      priorSurgeryDate: clearDate ? "" : prev.priorSurgeryDate,
      priorSurgeryTimingNote: timingNote,
    }));
  };

  const handleSave = async (mode: "save" | "regenerate" | "image_limited") => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = formToPayload(form);
      const result =
        mode === "regenerate"
          ? await saveCaseClinicalHistoryAndRegenerateAction(caseId, payload)
          : mode === "image_limited"
            ? await saveCaseClinicalHistoryAndRegenerateImageLimitedAction(caseId, payload)
            : await saveCaseClinicalHistoryAction(caseId, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setForm(snapshotToForm(result.snapshot));
      setOverrides({ priorGraftCount: false, estimatedHairCount: false, averageHairsPerGraft: false });
      const warning =
        mode !== "save" && "warning" in result && result.warning ? ` ${result.warning}` : "";
      const regenNote =
        mode !== "save" && "rerunLogId" in result && result.rerunLogId
          ? " Audit regeneration queued."
          : "";
      setSuccess("Clinical intelligence saved." + regenNote + warning);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-slate-900/60 text-white px-4 py-2.5 text-sm placeholder-slate-500 focus:border-emerald-400/40 focus:outline-none";
  const labelClass = "block text-xs font-medium text-slate-300 mb-1";

  return (
    <details
      className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-5 group"
      open={hasData}
    >
      <summary className="cursor-pointer list-none font-semibold text-white flex items-center justify-between gap-2">
        <span>Clinical Intelligence Editor</span>
        {hasData ? (
          <span className="text-xs font-normal text-emerald-300">Data on file</span>
        ) : (
          <span className="text-xs font-normal text-slate-400">Collapsed — no data yet</span>
        )}
      </summary>

      <p className="mt-2 text-sm text-slate-300">
        Quickly add known surgical details from reports, PDFs, or auditor review. These details improve
        AI reasoning and donor-management recommendations.
      </p>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-950/20 p-4">
          <label className={labelClass}>Quick extract / paste notes</label>
          <textarea
            rows={2}
            className={inputClass}
            value={pasteText}
            onChange={(e) => handlePasteChange(e.target.value)}
            placeholder='e.g. "3120 grafts, 7040 hairs, 2.26 ratio, 0.85 punch"'
          />
          {pasteSuggestions ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-sm text-cyan-100">
                {formatParsedClinicalHistorySummary(pasteSuggestions)}
              </p>
              <button
                type="button"
                onClick={applyPasteSuggestions}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-300 hover:bg-cyan-200"
              >
                Apply suggestions
              </button>
            </div>
          ) : null}
        </div>

        <CollapsibleSection title="Prior Surgery" defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Previous surgery count"
              value={form.priorSurgeryCount}
              onChange={(v) => updateField("priorSurgeryCount", v)}
              placeholder="1"
              min={1}
            />
            <div>
              <label className={labelClass}>Surgery date</label>
              <input
                type="date"
                className={inputClass}
                value={form.priorSurgeryDate}
                onChange={(e) => {
                  updateField("priorSurgeryDate", e.target.value);
                  if (e.target.value) updateField("priorSurgeryTimingNote", "");
                }}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DATE_QUICK_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.label}
                    active={form.priorSurgeryTimingNote === opt.timingNote && !form.priorSurgeryDate}
                    onClick={() => setDateQuick(opt.timingNote, opt.clearDate)}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </div>
              {form.priorSurgeryTimingNote && !form.priorSurgeryDate ? (
                <p className="mt-1 text-xs text-amber-200/80">{form.priorSurgeryTimingNote}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <p className={labelClass}>Procedure</p>
              <div className="flex flex-wrap gap-2">
                {PRIOR_PROCEDURE_TYPES.map((v) => (
                  <Chip
                    key={v}
                    active={form.priorProcedureType.toLowerCase() === v}
                    onClick={() => updateField("priorProcedureType", v)}
                  >
                    {PROCEDURE_LABELS[v]}
                  </Chip>
                ))}
              </div>
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
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Graft Numbers" defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Total grafts"
              value={form.priorGraftCount}
              onChange={(v) => {
                markOverride("priorGraftCount");
                updateField("priorGraftCount", v);
              }}
              placeholder="3200"
              calculated={
                !overrides.priorGraftCount &&
                Boolean(form.singleHairGrafts || form.doubleHairGrafts || form.tripleHairGrafts || form.quadrupleHairGrafts)
              }
            />
            <NumberField
              label="Estimated hairs"
              value={form.estimatedHairCount}
              onChange={(v) => {
                markOverride("estimatedHairCount");
                updateField("estimatedHairCount", v);
              }}
              placeholder="7200"
              calculated={
                !overrides.estimatedHairCount &&
                Boolean(form.singleHairGrafts || form.doubleHairGrafts || form.tripleHairGrafts || form.quadrupleHairGrafts)
              }
            />
            <NumberField
              label="Average hairs/graft"
              value={form.averageHairsPerGraft}
              onChange={(v) => {
                markOverride("averageHairsPerGraft");
                updateField("averageHairsPerGraft", v);
              }}
              placeholder="2.25"
              step="0.01"
              min={1}
              max={4.5}
              calculated={!overrides.averageHairsPerGraft}
            />
            <NumberField
              label="Singles"
              value={form.singleHairGrafts}
              onChange={(v) => updateField("singleHairGrafts", v)}
              placeholder="600"
            />
            <NumberField
              label="Doubles"
              value={form.doubleHairGrafts}
              onChange={(v) => updateField("doubleHairGrafts", v)}
              placeholder="1400"
            />
            <NumberField
              label="Triples"
              value={form.tripleHairGrafts}
              onChange={(v) => updateField("tripleHairGrafts", v)}
              placeholder="900"
            />
            <NumberField
              label="Quadruples"
              value={form.quadrupleHairGrafts}
              onChange={(v) => updateField("quadrupleHairGrafts", v)}
              placeholder="100"
            />
            <NumberField
              label="Transection rate"
              value={form.transectionRatePercent}
              onChange={(v) => updateField("transectionRatePercent", v)}
              placeholder="8"
              suffix="%"
              step="0.1"
              min={0}
              max={100}
            />
            <NumberField
              label="Survival estimate"
              value={form.survivalEstimatePercent}
              onChange={(v) => updateField("survivalEstimatePercent", v)}
              placeholder="90"
              suffix="%"
              step="0.1"
              min={0}
              max={100}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Donor / Technique" defaultOpen={false}>
          <div className="space-y-4">
            <div>
              <p className={labelClass}>Punch size</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {PUNCH_CHIPS.map((v) => (
                  <Chip
                    key={v}
                    active={form.punchSizeMm === v}
                    onClick={() => updateField("punchSizeMm", v)}
                  >
                    {v} mm
                  </Chip>
                ))}
                <Chip active={form.punchSizeMm === "unknown"} onClick={() => updateField("punchSizeMm", "")}>
                  Unknown
                </Chip>
              </div>
              <NumberField
                label="Punch size (custom)"
                value={form.punchSizeMm}
                onChange={(v) => updateField("punchSizeMm", v)}
                placeholder="0.85"
                suffix="mm"
                step="0.01"
                min={0.5}
                max={1.5}
              />
            </div>
            <div>
              <p className={labelClass}>Extraction</p>
              <div className="flex flex-wrap gap-2">
                {EXTRACTION_METHODS.map((v) => (
                  <Chip
                    key={v}
                    active={form.extractionMethod === v}
                    onClick={() => updateField("extractionMethod", v)}
                  >
                    {EXTRACTION_LABELS[v]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className={labelClass}>Implantation</p>
              <div className="flex flex-wrap gap-2">
                {IMPLANTATION_METHODS.map((v) => (
                  <Chip
                    key={v}
                    active={form.implantationMethod === v}
                    onClick={() => updateField("implantationMethod", v)}
                  >
                    {IMPLANTATION_LABELS[v]}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className={labelClass}>Donor depletion</p>
                <div className="flex flex-wrap gap-2">
                  {DONOR_DEPLETION_LEVELS.map((v) => (
                    <Chip
                      key={v}
                      active={form.donorDepletionLevel === v}
                      onClick={() => updateField("donorDepletionLevel", v)}
                    >
                      {LEVEL_LABELS[v]}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className={labelClass}>Scarring</p>
                <div className="flex flex-wrap gap-2">
                  {VISIBLE_SCARRING_LEVELS.map((v) => (
                    <Chip
                      key={v}
                      active={form.visibleScarringLevel === v}
                      onClick={() => updateField("visibleScarringLevel", v)}
                    >
                      {LEVEL_LABELS[v]}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
            <NumberField
              label="Donor grafts removed"
              value={form.donorGraftsRemoved}
              onChange={(v) => updateField("donorGraftsRemoved", v)}
              placeholder="3100"
            />
            <div>
              <p className={labelClass}>Recipient zones</p>
              <div className="flex flex-wrap gap-2">
                {RECIPIENT_ZONES.map((zone) => (
                  <Chip
                    key={zone}
                    active={form.recipientZones.includes(zone)}
                    onClick={() => toggleZone(zone)}
                  >
                    {ZONE_LABELS[zone]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Surgical technique notes</label>
              <textarea
                rows={2}
                className={inputClass}
                value={form.surgicalTechniqueNotes}
                onChange={(e) => updateField("surgicalTechniqueNotes", e.target.value)}
                placeholder="Donor technique, zone notes, etc."
              />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Medication Support" defaultOpen={false}>
          <div className="flex flex-wrap gap-2">
            {MEDICATION_HISTORY_KEYS.map((key) => (
              <Chip key={key} active={Boolean(form.medicationHistory[key])} onClick={() => toggleMed(key)}>
                {MED_LABELS[key]}
              </Chip>
            ))}
          </div>
          {form.medicationHistory.other ? (
            <input
              className={`${inputClass} mt-3`}
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
        </CollapsibleSection>

        <CollapsibleSection title="Auditor Notes" defaultOpen={false}>
          <div className="grid gap-4">
            <div>
              <label className={labelClass}>Supporting document notes</label>
              <textarea
                rows={2}
                className={inputClass}
                value={form.supportingDocumentNotes}
                onChange={(e) => updateField("supportingDocumentNotes", e.target.value)}
                placeholder="Graft counts or operative details transcribed from uploaded PDFs"
              />
            </div>
            <div>
              <label className={labelClass}>Clinician summary (internal)</label>
              <textarea
                rows={2}
                className={inputClass}
                value={form.clinicianSummary}
                onChange={(e) => updateField("clinicianSummary", e.target.value)}
                placeholder="Operator notes — not shown verbatim to patients"
              />
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-300">{success}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave("save")}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-slate-200 hover:bg-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave("regenerate")}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save + Regenerate Audit"}
        </button>
        <button
          type="button"
          disabled={saving || !canImageLimitedRegenerate || !photosMissing}
          title={
            !photosMissing
              ? "Image-limited regeneration is for cases missing required patient photos"
              : !canImageLimitedRegenerate
                ? "Image-limited regeneration requires at least one patient image or meaningful clinical history."
                : undefined
          }
          onClick={() => handleSave("image_limited")}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-950 bg-orange-300 hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save + Regenerate Image-Limited Audit"}
        </button>
      </div>
      {photosMissing && !canImageLimitedRegenerate ? (
        <p className="mt-2 text-xs text-amber-200/80">
          Image-limited regeneration requires at least one patient image or meaningful clinical history.
        </p>
      ) : null}
    </details>
  );
}
