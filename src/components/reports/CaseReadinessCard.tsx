"use client";

import { type FieldProvenanceValue } from "@/lib/audit/fieldProvenance";

const REQUIRED_KEY_LABELS: Record<string, string> = {
  img_preop_front: "Pre-op front",
  img_preop_left: "Pre-op left",
  img_preop_right: "Pre-op right",
  img_preop_top: "Pre-op top",
  img_preop_donor_rear: "Pre-op donor rear",
  img_immediate_postop_recipient: "Immediate post-op recipient",
  img_immediate_postop_donor: "Immediate post-op donor",
  patient_current_front: "Current front",
  patient_current_top: "Current top",
  patient_current_donor_rear: "Current donor rear",
};

type CaseReadinessCardProps = {
  hasDoctorAnswers: boolean;
  hasClinicAnswers: boolean;
  missingRequiredPhotoCategories: string[];
  submitterType?: "doctor" | "patient";
  fieldProvenance?: Record<string, string> | null;
  className?: string;
};

function provenanceSummary(provenance: Record<string, string>): {
  fromDefaults: number;
  editedAfterPrefill: number;
  manual: number;
  inherited: number;
} {
  const counts = { fromDefaults: 0, editedAfterPrefill: 0, manual: 0, inherited: 0 };
  for (const v of Object.values(provenance) as FieldProvenanceValue[]) {
    if (v === "prefilled_from_doctor_default" || v === "prefilled_from_clinic_default") counts.fromDefaults += 1;
    else if (v === "edited_after_prefill") counts.editedAfterPrefill += 1;
    else if (v === "entered_manually" || v === "confirmed_by_submitter") counts.manual += 1;
    else if (v === "inherited_from_original_case") counts.inherited += 1;
  }
  return counts;
}

export default function CaseReadinessCard({
  hasDoctorAnswers,
  hasClinicAnswers,
  missingRequiredPhotoCategories,
  submitterType = "doctor",
  fieldProvenance = null,
  className = "",
}: CaseReadinessCardProps) {
  const evidenceComplete = missingRequiredPhotoCategories.length === 0;
  const formComplete = hasDoctorAnswers || hasClinicAnswers;
  const prov = fieldProvenance && typeof fieldProvenance === "object" ? provenanceSummary(fieldProvenance) : null;

  return (
    <div className={`rounded-2xl border border-slate-700 bg-slate-900 p-6 ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-white">Readiness</h3>
      <p className="mb-4 text-xs text-slate-400">
        Form completion and required evidence. Auditors can use this to see missing data and provenance at a glance.
      </p>

      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Form</h4>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-lg border px-2.5 py-1.5 text-sm ${hasDoctorAnswers ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-amber-300/40 bg-amber-300/10 text-amber-100"}`}>
              Doctor answers: {hasDoctorAnswers ? "Present" : "Missing"}
            </span>
            <span className={`rounded-lg border px-2.5 py-1.5 text-sm ${hasClinicAnswers ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-slate-600 bg-slate-800/80 text-slate-300"}`}>
              Clinic answers: {hasClinicAnswers ? "Present" : "—"}
            </span>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Evidence (required categories)</h4>
          <div className={`rounded-lg border px-3 py-2 text-sm ${evidenceComplete ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-amber-300/40 bg-amber-300/10 text-amber-100"}`}>
            {evidenceComplete
              ? "All required photo categories met"
              : `${missingRequiredPhotoCategories.length} missing: ${missingRequiredPhotoCategories.map((k) => REQUIRED_KEY_LABELS[k] ?? k).join(", ")}`}
          </div>
          {!evidenceComplete && missingRequiredPhotoCategories.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {missingRequiredPhotoCategories.slice(0, 12).map((key) => (
                <li key={key}>• {REQUIRED_KEY_LABELS[key] ?? key}</li>
              ))}
              {missingRequiredPhotoCategories.length > 12 && (
                <li>… and {missingRequiredPhotoCategories.length - 12} more</li>
              )}
            </ul>
          )}
        </div>

        {prov && (prov.fromDefaults > 0 || prov.editedAfterPrefill > 0 || prov.manual > 0 || prov.inherited > 0) && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Provenance summary</h4>
            <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-200">
              {[
                prov.fromDefaults > 0 && `${prov.fromDefaults} from defaults`,
                prov.editedAfterPrefill > 0 && `${prov.editedAfterPrefill} edited after prefill`,
                prov.manual > 0 && `${prov.manual} manual`,
                prov.inherited > 0 && `${prov.inherited} inherited`,
              ].filter(Boolean).join(", ")}
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Default vs override: {prov.fromDefaults} fields from defaults, {prov.editedAfterPrefill + prov.manual} overridden or manual.</p>
          </div>
        )}
      </div>
    </div>
  );
}
