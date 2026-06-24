"use client";

import {
  badgeStyles,
  formatRelativeTime,
  type AuditorQueueDerived,
  type AuditorQueueCaseInput,
} from "@/lib/auditor/auditorQueueTriage";

export type AuditorNextCaseCardProps = {
  input: AuditorQueueCaseInput;
  derived: AuditorQueueDerived;
  busy?: boolean;
  onOpenCase: (caseId: string) => void;
  onRegenerateAudit: (caseId: string) => void;
  onImageLimitedOverride: (caseId: string) => void;
};

export default function AuditorNextCaseCard({
  input,
  derived,
  busy = false,
  onOpenCase,
  onRegenerateAudit,
  onImageLimitedOverride,
}: AuditorNextCaseCardProps) {
  const styles = badgeStyles(derived.badge);
  const missingLabels = derived.photoProgress.missingLabels;
  const showImageLimited = derived.isImageLimited || derived.imageLimitedRegenerationNeeded;

  return (
    <section className="rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-lg">
      <header className="mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Next Case To Process</p>
      </header>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{derived.auditTypeLabel}</h2>
          <p className="mt-1 text-lg font-semibold text-slate-700">Case {derived.caseNumberLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
          <span
            className={`mt-1 inline-flex rounded-md border px-3 py-1 text-sm font-bold uppercase tracking-wide ${styles.bg} ${styles.text}`}
          >
            {styles.label}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {missingLabels.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Missing</p>
            <p className="mt-1 text-sm font-medium text-red-700">{missingLabels.join(" / ")}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Uploaded</p>
          <p className="mt-1 text-sm text-slate-800">
            {input.imageUploadCount} Image{input.imageUploadCount === 1 ? "" : "s"}
            {input.pdfDocumentCount > 0 && ` · ${input.pdfDocumentCount} PDF`}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clinical History</p>
          <p className="mt-1 text-sm text-slate-800">{input.hasClinicalHistory ? "Present" : "Missing"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Last Action</p>
          <p className="mt-1 text-sm text-slate-800">{formatRelativeTime(derived.lastActionAt)}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => onOpenCase(input.id)}
          className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Open Case
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRegenerateAudit(input.id)}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          Regenerate
        </button>
        {showImageLimited && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onImageLimitedOverride(input.id)}
            className="rounded-lg border border-violet-400 px-4 py-2.5 text-sm font-medium text-violet-900 hover:bg-violet-50 disabled:opacity-60"
          >
            Image Limited Audit
          </button>
        )}
      </div>
    </section>
  );
}
