import type { EvidenceEvaluationResult } from "@/lib/evidence/evidenceEvaluator";
import { EVIDENCE_KEY_DISPLAY_LABELS } from "@/lib/evidence/evidenceMissingCopy";
import { EVIDENCE_REQUIREMENTS, type SurgicalMetricId } from "@/lib/evidence/evidenceRequirements";

const METRIC_TITLES: Record<SurgicalMetricId, string> = {
  implant_density: "Implant Density",
  hairline_naturalness: "Hairline Naturalness",
  transection_risk: "Transection Risk",
  donor_quality: "Donor Quality",
  donor_scar_visibility: "Donor Scar Visibility",
  graft_handling: "Graft Handling",
};

function statusBadgeClass(status: "complete" | "partial" | "insufficient") {
  if (status === "complete") return "border-emerald-400/40 bg-emerald-400/15 text-emerald-100";
  if (status === "partial") return "border-amber-400/40 bg-amber-400/15 text-amber-100";
  return "border-rose-400/40 bg-rose-400/15 text-rose-100";
}

function statusLabel(status: "complete" | "partial" | "insufficient") {
  if (status === "complete") return "Complete";
  if (status === "partial") return "Partial";
  return "Insufficient";
}

export default function EvidenceCoveragePanel({ result }: { result: EvidenceEvaluationResult }) {
  const metricOrder = Object.keys(EVIDENCE_REQUIREMENTS) as SurgicalMetricId[];

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Evidence Coverage</h2>
          <p className="mt-1 text-sm text-slate-400">
            Required image evidence by surgical metric (independent of audit scores).
          </p>
        </div>
        <div className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Overall</p>
          <p className="text-sm font-semibold text-cyan-100">{result.overallCoverageScore}%</p>
        </div>
      </div>

      <ul className="mt-5 space-y-4">
        {metricOrder.map((metricId) => {
          const entry = result.metricCoverage[metricId];
          const totalSlots = EVIDENCE_REQUIREMENTS[metricId].required.length;
          const missingLabels = entry.missing.map((k) => EVIDENCE_KEY_DISPLAY_LABELS[k] ?? k);

          return (
            <li
              key={metricId}
              className="rounded-xl border border-slate-700/80 bg-slate-950/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-white">{METRIC_TITLES[metricId]}</h3>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${statusBadgeClass(entry.status)}`}
                >
                  {statusLabel(entry.status)}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {entry.provided} / {totalSlots} required inputs
              </p>
              {missingLabels.length > 0 ? (
                <p className="mt-2 text-sm text-slate-400">
                  <span className="font-medium text-slate-300">Missing:</span> {missingLabels.join("; ")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
