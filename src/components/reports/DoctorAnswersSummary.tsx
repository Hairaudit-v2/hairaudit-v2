"use client";

import { CLINIC_AUDIT_SECTIONS } from "@/lib/clinicAuditForm";
import { DOCTOR_AUDIT_SECTIONS } from "@/lib/doctorAuditForm";

type ProvenanceValue =
  | "entered_manually"
  | "prefilled_from_doctor_default"
  | "prefilled_from_clinic_default"
  | "inherited_from_original_case"
  | "edited_after_prefill"
  | "confirmed_by_submitter";

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function provenanceLabel(value: string | undefined): string | null {
  const labels: Record<ProvenanceValue, string> = {
    entered_manually: "entered manually",
    prefilled_from_doctor_default: "prefilled from doctor default",
    prefilled_from_clinic_default: "prefilled from clinic default",
    inherited_from_original_case: "inherited from original surgery record",
    edited_after_prefill: "edited after prefill",
    confirmed_by_submitter: "confirmed by submitter",
  };
  if (!value) return null;
  return labels[value as ProvenanceValue] ?? value;
}

export default function DoctorAnswersSummary({
  answers,
  className = "",
  title = "Doctor / Clinic Submission Summary",
  baselineAnswers = null,
}: {
  answers: Record<string, unknown> | null | undefined;
  className?: string;
  title?: string;
  baselineAnswers?: Record<string, unknown> | null;
}) {
  if (!answers || typeof answers !== "object") return null;
  const a = answers as Record<string, unknown>;
  const fieldProvenance = (a.field_provenance as Record<string, string> | undefined) ?? {};

  const labelByField = new Map<string, string>();
  const allSections = [...DOCTOR_AUDIT_SECTIONS, ...CLINIC_AUDIT_SECTIONS];
  for (const section of allSections) {
    for (const question of section.questions) {
      if (!labelByField.has(question.id)) labelByField.set(question.id, question.prompt);
    }
  }

  const hiddenKeys = new Set(["field_provenance", "ai_context", "scoring", "scoring_version", "scoring_generated_at"]);
  const entries = Object.entries(a).filter(([key, value]) => {
    if (hiddenKeys.has(key)) return false;
    return value !== undefined && value !== null && value !== "";
  });

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <h3 className="font-semibold text-slate-900 mb-4">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No submitted values yet.</p>
      ) : (
        <div className="max-h-[520px] overflow-y-auto">
          <dl className="space-y-2 text-sm">
            {entries.map(([key, value]) => {
              const label = labelByField.get(key) ?? key;
              const provenance = provenanceLabel(fieldProvenance[key]);
              const baseline = baselineAnswers?.[key];
              const changed =
                baseline !== undefined &&
                JSON.stringify(Array.isArray(baseline) ? [...(baseline as unknown[])].sort() : baseline) !==
                  JSON.stringify(Array.isArray(value) ? [...value].sort() : value);
              return (
                <div key={key} className="rounded-md border border-slate-100 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-700">{label}</dt>
                    {provenance && (
                      <span className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-600">
                        {provenance}
                      </span>
                    )}
                  </div>
                  <dd className="mt-1 font-medium text-slate-900">{formatValue(value)}</dd>
                  {changed && (
                    <p className="mt-1 text-[11px] text-amber-700">Changed in latest follow-up submission</p>
                  )}
                </div>
              );
            })}
          </dl>
        </div>
      )}
      {Object.keys(fieldProvenance).length > 0 && (() => {
        const fromDefaults = Object.values(fieldProvenance).filter((v) => v === "prefilled_from_doctor_default" || v === "prefilled_from_clinic_default").length;
        const edited = Object.values(fieldProvenance).filter((v) => v === "edited_after_prefill").length;
        const manual = Object.values(fieldProvenance).filter((v) => v === "entered_manually" || v === "confirmed_by_submitter").length;
        const inherited = Object.values(fieldProvenance).filter((v) => v === "inherited_from_original_case").length;
        const defaultCount = fromDefaults + inherited;
        const overrideCount = edited + manual;
        const parts = [fromDefaults && `${fromDefaults} from defaults`, edited && `${edited} edited after prefill`, manual && `${manual} manual`, inherited && `${inherited} inherited`].filter(Boolean);
        return (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-600">Provenance summary</p>
            <p className="mt-1 text-xs text-slate-500">
              {parts.length ? `${parts.join(", ")}. Default vs override: ${defaultCount} from defaults, ${overrideCount} overridden or manual.` : "No provenance tags."}
            </p>
          </div>
        );
      })()}
      <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        Field provenance helps auditors distinguish manual entries, default-prefilled values, inherited baseline values, and post-prefill edits.
      </div>
    </div>
  );
}
