type Props = {
  patientName: string;
  caseId: string;
  auditType: string;
  statusLabel: string;
  statusPillClass: string;
  submittedAt: string | null;
  auditStage: string | null;
  language: string;
  priorityScore: number | null;
  pathwayLabel: string;
  clinicLabel: string;
  bulkBatchLabel?: string | null;
};

export default function AuditorCaseSummaryHeader({
  patientName,
  caseId,
  auditType,
  statusLabel,
  statusPillClass,
  submittedAt,
  auditStage,
  language,
  priorityScore,
  pathwayLabel,
  clinicLabel,
  bulkBatchLabel,
}: Props) {
  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Case summary</p>
          <h1 className="mt-1 text-lg font-semibold text-white truncate">{patientName}</h1>
          {bulkBatchLabel ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-cyan-300/90">{bulkBatchLabel}</p>
          ) : null}
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ${statusPillClass}`}>
          {statusLabel}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4 lg:grid-cols-8">
        <div>
          <dt className="text-slate-500">Case ID</dt>
          <dd className="mt-0.5 font-mono text-slate-200 truncate">{caseId}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Audit type</dt>
          <dd className="mt-0.5 capitalize text-slate-200">{auditType}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Submitted</dt>
          <dd className="mt-0.5 text-slate-200">
            {submittedAt ? new Date(submittedAt).toLocaleDateString() : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Audit stage</dt>
          <dd className="mt-0.5 text-slate-200">{auditStage ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Language</dt>
          <dd className="mt-0.5 text-slate-200">{language}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Priority</dt>
          <dd className="mt-0.5 font-semibold text-cyan-200">{priorityScore ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Pathway</dt>
          <dd className="mt-0.5 text-slate-200">{pathwayLabel}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Clinic</dt>
          <dd className="mt-0.5 text-slate-200 truncate">{clinicLabel}</dd>
        </div>
      </dl>
    </section>
  );
}
