"use client";

/** Displays key doctor audit fields prominently for admin/review */
export default function DoctorAnswersSummary({
  answers,
  className = "",
}: {
  answers: Record<string, unknown> | null | undefined;
  className?: string;
}) {
  if (!answers || typeof answers !== "object") return null;
  const a = answers as Record<string, unknown>;

  const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
  const label = (m: Record<string, string>, v: unknown) => m[fmt(v)] ?? fmt(v);

  const procedureLabels: Record<string, string> = {
    fue_manual: "FUE (Manual)",
    fue_motorized: "FUE (Motorized)",
    fue_robotic: "FUE (Robotic)",
    fut: "FUT",
    combined: "Combined FUT + FUE",
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <h3 className="font-semibold text-slate-900 mb-4">Doctor / Clinic Submission Summary</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Procedure & Grafts
          </h4>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Procedure type</dt>
              <dd className="font-medium">{label(procedureLabels, a.procedureType)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Grafts extracted</dt>
              <dd className="font-medium">{fmt(a.totalGraftsExtracted)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Grafts implanted</dt>
              <dd className="font-medium">{fmt(a.totalGraftsImplanted)}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Personnel & Preservation
          </h4>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Extraction by</dt>
              <dd className="font-medium capitalize">{fmt(a.extractionPerformedBy)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Implantation by</dt>
              <dd className="font-medium capitalize">{fmt(a.implantationPerformedBy)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Holding solution</dt>
              <dd className="font-medium">{label({ saline: "Saline", hypothermic: "Hypothermic", atp_enhanced: "ATP-enhanced", other: "Other" }, a.holdingSolution)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Implantation
        </h4>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-600">Recipient tool</dt>
            <dd className="font-medium">{label({ steel_blade: "Steel blade", sapphire_blade: "Sapphire blade", needle: "Needle", implanter_pen: "Implanter pen", mixed: "Mixed" }, a.recipientTool)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-600">Implantation method</dt>
            <dd className="font-medium">{label({ forceps: "Forceps", premade_slits_forceps: "Pre-made slits + forceps", implanter: "Implanter" }, a.implantationMethod)}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-sm">
        <span className="text-slate-600">Doctor</span>
        <span className="font-medium">{fmt(a.doctorName) || fmt((a as any).doctor_name)}</span>
      </div>
    </div>
  );
}
