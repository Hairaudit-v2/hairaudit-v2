import type {
  PatientImageEvidenceConfidenceResult,
  PatientImageEvidenceSufficiencyLevel,
} from "@/lib/audit/patientImageEvidenceConfidence";
import {
  PATIENT_IMAGE_EVIDENCE_QUALITY_GROUP_ORDER,
  PATIENT_IMAGE_EVIDENCE_QUALITY_LABELS,
} from "@/lib/audit/patientImageEvidenceConfidence";

function levelPillClass(level: PatientImageEvidenceSufficiencyLevel): string {
  switch (level) {
    case "none":
      return "border-slate-600/50 bg-slate-800/60 text-slate-400";
    case "limited":
      return "border-amber-600/35 bg-amber-950/40 text-amber-100/90";
    case "moderate":
      return "border-sky-700/40 bg-sky-950/35 text-sky-100/85";
    case "strong":
      return "border-emerald-800/40 bg-emerald-950/30 text-emerald-100/85";
    default:
      return "border-slate-600/50 bg-slate-800/60 text-slate-400";
  }
}

export default function PatientImageEvidenceQualityPanel({
  result,
}: {
  result: PatientImageEvidenceConfidenceResult;
}) {
  return (
    <section
      className="mt-6 rounded-2xl border border-slate-700/80 bg-slate-900/50 p-5"
      aria-label="Image evidence sufficiency"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Image evidence sufficiency</h2>
      <p className="mt-1 text-xs text-slate-500">
        Informational grouping of <span className="text-slate-400">patient-submitted</span> photo categories. Not a score,
        rubric, or eligibility rule — does not imply penalties.
      </p>

      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
        <span className="text-slate-500">Overall summary:</span>{" "}
        <span className="font-medium capitalize text-slate-300">{result.overall.summaryLevel}</span>
        <span className="mx-2 text-slate-600">·</span>
        <span className="text-slate-500">Extended optional categories present:</span>{" "}
        <span className="text-slate-300">{result.overall.hasExtendedEvidence ? "yes" : "no"}</span>
      </div>

      <ul className="mt-4 space-y-3">
        {PATIENT_IMAGE_EVIDENCE_QUALITY_GROUP_ORDER.map((id) => {
          const g = result.groups[id];
          const title = PATIENT_IMAGE_EVIDENCE_QUALITY_LABELS[id];
          return (
            <li
              key={id}
              className="rounded-lg border border-slate-800/90 bg-slate-950/30 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-300">{title}</span>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${levelPillClass(g.level)}`}
                >
                  {g.level}
                </span>
                {g.count > 0 ? (
                  <span className="text-[11px] text-slate-500">n={g.count}</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-snug text-slate-500">{g.rationale}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
