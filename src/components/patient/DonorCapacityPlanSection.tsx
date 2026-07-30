"use client";

import type { PatientSafeDonorCapacityPlanSlice } from "@/lib/patient/donorCapacityPlan";

/**
 * HA-DONOR-HEALING-1E — patient-safe qualitative capacity planning block.
 * No graft numbers, no measurement values.
 */
export default function DonorCapacityPlanSection({
  plan,
}: {
  plan: PatientSafeDonorCapacityPlanSlice;
}) {
  return (
    <section
      data-testid="donor-capacity-plan-section"
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 sm:px-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Future donor planning
      </p>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">{plan.label}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{plan.narrative}</p>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{plan.caveat}</p>
      <p className="mt-2 text-xs text-slate-500">{plan.provenanceLabel}</p>
    </section>
  );
}
