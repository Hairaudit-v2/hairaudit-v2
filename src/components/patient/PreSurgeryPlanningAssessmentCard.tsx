/**
 * HA-PATHWAY-FIX-2 — Pre-Surgery Planning Assessment (replaces Graft Integrity Index).
 */

import {
  PRE_SURGERY_PLANNING_OUTPUTS,
  PRE_SURGERY_PLANNING_PLACEHOLDER,
} from "@/lib/patient/patientCaseDashboard";

export type PreSurgeryPlanningAssessmentCardProps = {
  /** When true, show prepared assessment outputs; otherwise patient-safe placeholder. */
  reportReady?: boolean;
  outputs?: readonly string[] | null;
  className?: string;
};

export default function PreSurgeryPlanningAssessmentCard({
  reportReady = false,
  outputs = null,
  className = "",
}: PreSurgeryPlanningAssessmentCardProps) {
  const items =
    reportReady && outputs && outputs.length > 0 ? outputs : PRE_SURGERY_PLANNING_OUTPUTS;

  return (
    <section
      className={`mt-6 rounded-2xl border border-cyan-500/25 bg-slate-900 p-6 ${className}`}
      data-testid="pre-surgery-planning-assessment"
    >
      <h2 className="text-lg font-semibold text-white">Pre-Surgery Planning Assessment</h2>
      {reportReady ? (
        <>
          <p className="mt-2 text-sm text-slate-300">
            Potential planning outputs from your independent review:
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-200">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-300">{PRE_SURGERY_PLANNING_PLACEHOLDER}</p>
          <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
            Assessment areas (after review)
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-400">
            {PRE_SURGERY_PLANNING_OUTPUTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
