"use client";

import {
  failureTypeLabel,
  type AuditorQueueDerived,
  type AuditorQueueCaseInput,
} from "@/lib/auditor/auditorQueueTriage";
import { resolveAuditorCaseActions, type AuditorCaseAction } from "@/lib/auditor/auditorCaseActions";
import AuditorCaseActionButtons from "@/components/auditor/AuditorCaseActionButtons";

export type AuditorFailedRecoveryCardProps = {
  input: AuditorQueueCaseInput;
  derived: AuditorQueueDerived;
  busy?: boolean;
  onAction: (action: AuditorCaseAction, caseId: string, caseLabel: string) => void;
};

export default function AuditorFailedRecoveryCard({
  input,
  derived,
  busy = false,
  onAction,
}: AuditorFailedRecoveryCardProps) {
  const patientName = input.patientName?.trim() || "Unknown patient";
  const failureLabel = derived.failureType ? failureTypeLabel(derived.failureType) : "Processing Failed";
  const caseLabel = input.title ?? input.id.slice(0, 8);
  const actions = resolveAuditorCaseActions(input, derived);

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
      <AuditorCaseActionButtons
        actions={actions}
        busy={busy}
        onAction={(action) => onAction(action, input.id, caseLabel)}
      />
    </article>
  );
}
