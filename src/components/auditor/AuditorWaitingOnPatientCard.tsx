"use client";

import { type AuditorQueueDerived, type AuditorQueueCaseInput } from "@/lib/auditor/auditorQueueTriage";

export type AuditorWaitingOnPatientCardProps = {
  input: AuditorQueueCaseInput;
  derived: AuditorQueueDerived;
  busy?: boolean;
  onRequestMissingImages: (caseId: string, label: string) => void;
};

export default function AuditorWaitingOnPatientCard({
  input,
  derived,
  busy = false,
  onRequestMissingImages,
}: AuditorWaitingOnPatientCardProps) {
  const caseLabel = input.title ?? input.id.slice(0, 8);
  const missingLabels = derived.photoProgress.missingLabels;
  const missingText = missingLabels.length > 0 ? missingLabels.join(", ") : "Additional uploads";
  const waitingText = input.waitingOnTranslation ? "Translation completion" : "Patient upload";

  return (
    <article className="rounded-xl border border-orange-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Case {derived.caseNumberLabel}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-orange-700">Missing: {missingText}</p>
      <p className="mt-2 text-sm text-slate-600">Waiting: {waitingText}</p>
      <div className="mt-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => onRequestMissingImages(input.id, caseLabel)}
          className="rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-medium text-orange-800 hover:bg-orange-50 disabled:opacity-60"
        >
          Request Missing Images
        </button>
      </div>
    </article>
  );
}
