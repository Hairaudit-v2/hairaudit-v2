"use client";

import { type AuditorQueueDerived, type AuditorQueueCaseInput } from "@/lib/auditor/auditorQueueTriage";
import { resolveAuditorCaseActions, type AuditorCaseAction } from "@/lib/auditor/auditorCaseActions";
import AuditorCaseActionButtons from "@/components/auditor/AuditorCaseActionButtons";
import AuditorCasePreviewThumb from "@/components/auditor/AuditorCasePreviewThumb";

export type AuditorWaitingOnPatientCardProps = {
  input: AuditorQueueCaseInput;
  derived: AuditorQueueDerived;
  previewUrl?: string | null;
  busy?: boolean;
  onAction: (action: AuditorCaseAction, caseId: string, caseLabel: string) => void;
};

export default function AuditorWaitingOnPatientCard({
  input,
  derived,
  previewUrl = null,
  busy = false,
  onAction,
}: AuditorWaitingOnPatientCardProps) {
  const caseLabel = input.title ?? input.id.slice(0, 8);
  const missingLabels = derived.photoProgress.missingLabels;
  const missingText = missingLabels.length > 0 ? missingLabels.join(", ") : "Additional uploads";
  const waitingText = input.waitingOnTranslation ? "Translation completion" : "Patient upload";
  const actions = resolveAuditorCaseActions(input, derived);

  return (
    <article className="rounded-xl border border-orange-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <AuditorCasePreviewThumb url={previewUrl} label={`Preview for case ${derived.caseNumberLabel}`} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Case {derived.caseNumberLabel}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-orange-700">Missing: {missingText}</p>
          <p className="mt-2 text-sm text-slate-600">Waiting: {waitingText}</p>
        </div>
      </div>
      <AuditorCaseActionButtons
        actions={actions}
        busy={busy}
        onAction={(action) => onAction(action, input.id, caseLabel)}
      />
    </article>
  );
}
