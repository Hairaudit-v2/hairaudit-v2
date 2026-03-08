"use client";

import { useMemo, useState } from "react";

import { normalizeIntakeFormData } from "@/lib/intake/normalizeIntakeFormData";
import { PATIENT_AUDIT_SECTIONS } from "@/lib/patientAuditForm";

/** Displays patient audit highlights for admin/review. Supports v2 and legacy data. */
export default function PatientAnswersSummary({
  answers,
  className = "",
}: {
  answers: Record<string, unknown> | null | undefined;
  className?: string;
}) {
  if (!answers || typeof answers !== "object") return null;
  const a = normalizeIntakeFormData(answers) as Record<string, unknown>;

  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log("[PatientAnswersSummary] canonical intake:", JSON.stringify(a).slice(0, 500) + (JSON.stringify(a).length > 500 ? "…" : ""));
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
      const v = a[q.id];
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

  const tabDefs = [
    { id: "overview", label: "Overview" },
    { id: "biology", label: "Patient Biology" },
    { id: "procedure", label: "Procedure Details" },
    { id: "healing", label: "Healing" },
    { id: "scores", label: "Patient Scores" },
  ] as const;

  const [activeTab, setActiveTab] = useState<(typeof tabDefs)[number]["id"]>("overview");

  const overviewRows = [
    { label: "Clinic", value: clinic },
    { label: "Procedure date", value: procedureDate },
    { label: "Procedure type", value: procedureType },
    { label: "Months post-op", value: monthsSince },
    { label: "Cost", value: amount != null ? `${currency} ${amount}` : fmt(a.total_paid_amount) },
  ];

  const scoreRows = [
    { label: "Density satisfaction", value: density != null ? `${density}/5` : "—" },
    { label: "Hairline naturalness", value: hairline != null ? `${hairline}/5` : "—" },
    { label: "Donor appearance", value: donor != null ? `${donor}/5` : "—" },
    { label: "Would recommend", value: recommend },
    { label: "Cost model", value: costModel },
  ];

  const groupedRows = useMemo(() => {
    const groups = {
      biology: [] as { prompt: string; value: string }[],
      procedure: [] as { prompt: string; value: string }[],
      healing: [] as { prompt: string; value: string }[],
    };

    for (const section of PATIENT_AUDIT_SECTIONS) {
      const key = `${section.id} ${section.title}`.toLowerCase();
      const target =
        key.includes("biology") || key.includes("health") || key.includes("history")
          ? "biology"
          : key.includes("heal") || key.includes("recovery") || key.includes("post")
            ? "healing"
            : "procedure";

      for (const q of section.questions) {
        const v = a[q.id];
        if (v === null || v === undefined || v === "") continue;
        const labelMap = q.options?.length ? Object.fromEntries((q.options ?? []).map((o) => [o.value, o.label])) : undefined;
        groups[target].push({ prompt: q.prompt, value: fmtWithLabels(q.id, v, labelMap) });
      }
    }

    return groups;
  }, [a]);

  function renderRows(rows: Array<{ label: string; value: string }> | Array<{ prompt: string; value: string }>) {
    if (!rows || rows.length === 0) {
      return <p className="text-sm text-slate-200">No data provided yet.</p>;
    }
    return (
      <dl className="grid gap-2 text-sm">
        {rows.map((row) => {
          const label = "label" in row ? row.label : row.prompt;
          return (
            <div key={label} className="flex items-start justify-between gap-4 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2">
              <dt className="text-slate-200">{label}</dt>
              <dd className="text-right font-medium text-white">{row.value}</dd>
            </div>
          );
        })}
      </dl>
    );
  }

  return (
    <div className={`rounded-2xl border border-slate-700 bg-slate-900 p-6 ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-white">Patient Submission Summary</h3>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabDefs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              activeTab === tab.id
                ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
                : "border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>{renderRows(overviewRows)}</div>
          <div>
            {renderRows([
              { label: "Doctor present (extraction)", value: doctorExtraction },
              { label: "Doctor present (implant)", value: doctorImplant },
              { label: "Graft count disclosed", value: graftDisclosed },
              { label: "Recommendation intent", value: recommend },
            ])}
          </div>
        </div>
      )}

      {activeTab === "biology" && renderRows(groupedRows.biology)}
      {activeTab === "procedure" && renderRows(groupedRows.procedure)}
      {activeTab === "healing" && renderRows(groupedRows.healing)}
      {activeTab === "scores" && renderRows(scoreRows)}

      {hasAdvanced && activeTab !== "overview" && (
        <div className="mt-4 border-t border-slate-700 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-100">Advanced Forensic Signals</p>
          <div className="space-y-3">
            {advancedSections.map((sec) => {
              const rows = sec.questions
                .map((q) => {
                  const v = a[q.id];
                  if (v === null || v === undefined || v === "") return null;
                  const labelMap = q.options?.length ? Object.fromEntries((q.options ?? []).map((o) => [o.value, o.label])) : undefined;
                  return { prompt: q.prompt, value: fmtWithLabels(q.id, v, labelMap) };
                })
                .filter(Boolean) as { prompt: string; value: string }[];
              if (rows.length === 0) return null;
              return (
                <div key={sec.id} className="rounded-lg border border-slate-700 bg-slate-800/80 p-3">
                  <h5 className="mb-2 text-sm font-medium text-white">{sec.title}</h5>
                  {renderRows(rows)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
