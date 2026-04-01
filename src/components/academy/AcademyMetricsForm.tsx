"use client";

import { useState } from "react";

const fields: { name: string; label: string; step?: string }[] = [
  { name: "grafts_attempted", label: "Grafts attempted" },
  { name: "grafts_extracted", label: "Grafts extracted" },
  { name: "grafts_implanted", label: "Grafts implanted" },
  { name: "extraction_minutes", label: "Extraction (min)", step: "0.1" },
  { name: "implantation_minutes", label: "Implantation (min)", step: "0.1" },
  { name: "total_minutes", label: "Total (min)", step: "0.1" },
  { name: "extraction_grafts_per_hour", label: "Extraction grafts/hr", step: "0.1" },
  { name: "implantation_grafts_per_hour", label: "Implantation grafts/hr", step: "0.1" },
  { name: "transection_rate", label: "Transection rate %", step: "0.01" },
  { name: "buried_graft_rate", label: "Buried graft rate %", step: "0.01" },
  { name: "popping_rate", label: "Popping rate %", step: "0.01" },
  { name: "out_of_body_time_estimate", label: "Out-of-body time (est.)", step: "0.1" },
  { name: "punch_size", label: "Punch size" },
  { name: "punch_type", label: "Punch type" },
  { name: "implantation_method", label: "Implantation method" },
];

export default function AcademyMetricsForm({
  caseId,
  initial,
}: {
  caseId: string;
  initial: Record<string, string | number | null | undefined>;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, number | string | null> = {};
    for (const f of fields) {
      const raw = String(fd.get(f.name) ?? "").trim();
      if (!raw) {
        body[f.name] = null;
        continue;
      }
      if (f.step) {
        const n = Number(raw);
        body[f.name] = Number.isFinite(n) ? n : null;
      } else if (f.name.startsWith("grafts_")) {
        const n = parseInt(raw, 10);
        body[f.name] = Number.isFinite(n) ? n : null;
      } else {
        body[f.name] = raw;
      }
    }
    try {
      const res = await fetch(`/api/academy/cases/${caseId}/metrics`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      setMsg("Metrics saved");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="text-sm font-semibold text-slate-900">Case metrics</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="block text-xs font-medium text-slate-600">{f.label}</label>
            <input
              name={f.name}
              type={f.step ? "number" : "text"}
              step={f.step}
              defaultValue={initial[f.name] != null ? String(initial[f.name]) : ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        ))}
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save metrics"}
      </button>
      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
    </form>
  );
}
