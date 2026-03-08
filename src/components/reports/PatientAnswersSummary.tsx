"use client";

import { normalizeIntake } from "@/lib/intake/normalizeIntake";
import { PATIENT_AUDIT_SECTIONS } from "@/lib/patientAuditForm";

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) return obj[path];
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** Displays patient audit highlights for admin/review. Supports v2 and legacy data. */
export default function PatientAnswersSummary({
  answers,
  className = "",
}: {
  answers: Record<string, unknown> | null | undefined;
  className?: string;
}) {
  if (!answers || typeof answers !== "object") return null;
  const normalized = normalizeIntake(answers);
  const a = normalized as Record<string, unknown>;

  // Temporary: verify normalized payload (remove after debugging)
  if (typeof window !== "undefined") {
    console.log("[PatientAnswersSummary] normalized payload:", JSON.stringify(normalized).slice(0, 500) + (JSON.stringify(normalized).length > 500 ? "…" : ""));
  }

  const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
  const num = (v: unknown) => (typeof v === "number" ? v : v != null ? Number(v) : null);

  const countryLabels: Record<string, string> = {
    turkey: "Turkey", spain: "Spain", india: "India", thailand: "Thailand",
    mexico: "Mexico", brazil: "Brazil", argentina: "Argentina", colombia: "Colombia",
    australia: "Australia", uk: "UK", usa: "USA", canada: "Canada", uae: "UAE",
    belgium: "Belgium", germany: "Germany", poland: "Poland", greece: "Greece", other: "Other",
  };
  const procedureLabels: Record<string, string> = {
    fue: "FUE", fut: "FUT", dhi: "DHI", robotic: "Robotic", not_sure: "Not Sure", other: "Other",
  };
  const costModelLabels: Record<string, string> = {
    per_graft: "Per graft", per_session: "Per session", package: "Package", not_clear: "Not clear",
  };

  const clinic = fmt(a.clinic_name) !== "—" ? `${fmt(a.clinic_name)} (${countryLabels[String(a.clinic_country ?? "")] ?? fmt(a.clinic_country)} / ${fmt(a.clinic_city)})` : "—";
  const procedureDate = fmt(a.procedure_date);
  const procedureType = procedureLabels[String(a.procedure_type ?? "")] ?? fmt(a.procedure_type);
  const monthsLabels: Record<string, string> = {
    under_3: "<3 mo", "3_6": "3–6 mo", "6_9": "6–9 mo", "9_12": "9–12 mo", "12_plus": "12+ mo",
  };
  const monthsSince = monthsLabels[String(a.months_since ?? "")] ?? fmt(a.months_since);
  const density = num(a.density_satisfaction) ?? num(a.results_satisfaction);
  const hairline = num(a.hairline_naturalness);
  const donor = num(a.donor_appearance);
  const recommend = fmt(a.would_recommend);
  const amount = num(a.total_paid_amount) ?? fmt(a.total_paid_amount);
  const currency = fmt(a.total_paid_currency).toUpperCase();
  const costModel = costModelLabels[String(a.cost_model ?? "")] ?? fmt(a.cost_model);
  const doctorExtraction = fmt(a.doctor_present_extraction);
  const doctorImplant = fmt(a.doctor_present_implant);
  const graftDisclosed = fmt(a.graft_number_disclosed);

  const advancedSections = PATIENT_AUDIT_SECTIONS.filter((s) => s.advanced);
  const hasAdvanced = advancedSections.some((sec) =>
    sec.questions.some((q) => {
      const v = a[q.id] ?? getByPath(answers as Record<string, unknown>, q.id);
      return v !== null && v !== undefined && v !== "";
    })
  );

  const fmtWithLabels = (qId: string, v: unknown, labels?: Record<string, string>) => {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (Array.isArray(v)) return v.join(", ");
    if (labels && typeof v === "string") return labels[v] ?? String(v);
    return String(v);
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <h3 className="font-semibold text-slate-900 mb-4">Patient Submission Summary</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Clinic & Procedure
          </h4>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Clinic</dt>
              <dd className="font-medium">{clinic}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Date</dt>
              <dd className="font-medium">{procedureDate}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Procedure type</dt>
              <dd className="font-medium">{procedureType}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Months since</dt>
              <dd className="font-medium">{monthsSince}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Transparency
          </h4>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Doctor present (extraction)</dt>
              <dd className="font-medium">{doctorExtraction}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Doctor present (implant)</dt>
              <dd className="font-medium">{doctorImplant}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Graft count disclosed</dt>
              <dd className="font-medium">{graftDisclosed}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Results
        </h4>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-600">Density satisfaction</dt>
            <dd className="font-medium">{density != null ? `${density}/5` : "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-600">Hairline naturalness</dt>
            <dd className="font-medium">{hairline != null ? `${hairline}/5` : "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-600">Donor appearance</dt>
            <dd className="font-medium">{donor != null ? `${donor}/5` : "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-600">Would recommend</dt>
            <dd className="font-medium">{recommend}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Cost
        </h4>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-600">Amount</dt>
            <dd className="font-medium">{amount != null ? `${currency} ${amount}` : fmt(a.total_paid_amount)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-600">Cost model</dt>
            <dd className="font-medium">{costModel}</dd>
          </div>
        </dl>
      </div>

      {hasAdvanced && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Advanced forensic (optional)
          </h4>
          <div className="space-y-3">
            {advancedSections.map((sec) => {
              const rows = sec.questions
                .map((q) => {
                  const v = a[q.id] ?? getByPath(answers as Record<string, unknown>, q.id);
                  if (v === null || v === undefined || v === "") return null;
                  const labelMap =
                    q.options?.length
                      ? Object.fromEntries((q.options ?? []).map((o) => [o.value, o.label]))
                      : undefined;
                  return { prompt: q.prompt, value: fmtWithLabels(q.id, v, labelMap) };
                })
                .filter(Boolean) as { prompt: string; value: string }[];
              if (rows.length === 0) return null;
              return (
                <div key={sec.id}>
                  <h5 className="text-xs font-medium text-slate-600 mb-1">{sec.title}</h5>
                  <dl className="space-y-1 text-sm">
                    {rows.map((r) => (
                      <div key={r.prompt} className="flex justify-between gap-2">
                        <dt className="text-slate-600">{r.prompt}</dt>
                        <dd className="font-medium">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
