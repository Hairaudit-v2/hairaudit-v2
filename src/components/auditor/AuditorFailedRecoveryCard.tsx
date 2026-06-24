"use client";

import {
  failureTypeLabel,
  type AuditorQueueDerived,
  type AuditorQueueCaseInput,
} from "@/lib/auditor/auditorQueueTriage";

export type AuditorFailedRecoveryCardProps = {
  input: AuditorQueueCaseInput;
  derived: AuditorQueueDerived;
  busy?: boolean;
  onRetryPdf: (caseId: string) => void;
  onOpenCase: (caseId: string) => void;
  onRetryFailedAudit: (caseId: string) => void;
};

export default function AuditorFailedRecoveryCard({
  input,
  derived,
  busy = false,
  onRetryPdf,
  onOpenCase,
  onRetryFailedAudit,
}: AuditorFailedRecoveryCardProps) {
  const patientName = input.patientName?.trim() || "Unknown patient";
  const failureLabel = derived.failureType ? failureTypeLabel(derived.failureType) : "Processing Failed";
  const isPdfFailure = derived.failureType === "PDF_GENERATION";

  return (
    <article className="rounded-xl border border-red-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Case {derived.caseNumberLabel}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-red-700">Failed: {failureLabel}</p>
      <p className="mt-2 text-sm text-slate-700">Patient: {patientName}</p>
      {derived.failureReason && (
        <p className="mt-1 text-sm text-slate-600">
          Reason: {derived.failureReason}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {isPdfFailure && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRetryPdf(input.id)}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-60"
          >
            Retry PDF
          </button>
        )}
        {!isPdfFailure && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRetryFailedAudit(input.id)}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-60"
          >
            Retry Audit
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => onOpenCase(input.id)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          Open Case
        </button>
      </div>
    </article>
  );
}
