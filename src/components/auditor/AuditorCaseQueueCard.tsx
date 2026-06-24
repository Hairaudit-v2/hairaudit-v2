"use client";

import Link from "next/link";
import {
  badgeStyles,
  formatRelativeTime,
  type AuditorQueueBadge,
  type AuditorQueueDerived,
  type AuditorQueueCaseInput,
} from "@/lib/auditor/auditorQueueTriage";

export type AuditorCaseQueueCardProps = {
  input: AuditorQueueCaseInput;
  derived: AuditorQueueDerived;
  clinicName: string | null;
  compact?: boolean;
  busy?: boolean;
  onOpenCase: (caseId: string) => void;
  onRegenerateAudit: (caseId: string) => void;
  onRequestMissingImages: (caseId: string, label: string) => void;
  onMarkForReview: (caseId: string) => void;
  onRetryFailedAudit: (caseId: string) => void;
  onImageLimitedOverride: (caseId: string) => void;
};

function formatSubmittedDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function StatusBadge({ badge }: { badge: AuditorQueueBadge }) {
  const styles = badgeStyles(badge);
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles.bg} ${styles.text}`}>
      {styles.label}
    </span>
  );
}

export default function AuditorCaseQueueCard({
  input,
  derived,
  clinicName,
  compact = false,
  busy = false,
  onOpenCase,
  onRegenerateAudit,
  onRequestMissingImages,
  onMarkForReview,
  onRetryFailedAudit,
  onImageLimitedOverride,
}: AuditorCaseQueueCardProps) {
  const displayName = input.patientName?.trim() || input.title?.trim() || "Unknown patient";
  const caseLabel = input.title ?? input.id.slice(0, 8);
  const { photoProgress } = derived;
  const showImageLimitedOverride = derived.isImageLimited || derived.imageLimitedRegenerationNeeded;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900 truncate">{displayName}</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Case {derived.caseNumberLabel}
            {clinicName ? ` · ${clinicName}` : ""}
          </p>
          <p className="text-sm text-slate-600 mt-1">{derived.auditTypeLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge badge={derived.badge} />
          <span className="text-xs font-medium text-slate-500">Priority {derived.priorityScore}</span>
        </div>
      </div>

      {!compact && (
        <dl className="mt-3 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Images</dt>
            <dd>{input.imageUploadCount} uploaded</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Required photos</dt>
            <dd>
              {photoProgress.completedCount}/{photoProgress.totalRequired} complete
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">PDF documents</dt>
            <dd>{input.pdfDocumentCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Clinical history</dt>
            <dd>{input.hasClinicalHistory ? "Present" : "Missing"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Audit status</dt>
            <dd>{derived.auditStatusLabel}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Last action</dt>
            <dd>{formatRelativeTime(derived.lastActionAt)}</dd>
          </div>
        </dl>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        <span>{input.imageUploadCount} Images</span>
        {input.pdfDocumentCount > 0 && <span>{input.pdfDocumentCount} PDF Document{input.pdfDocumentCount === 1 ? "" : "s"}</span>}
        {input.hasClinicalHistory && <span>Clinical History Added</span>}
      </div>

      {derived.failureSummary && (
        <p className="mt-2 text-sm text-red-700">
          Failed: {derived.failureSummary}
        </p>
      )}

      <p className="mt-2 text-xs text-slate-500">
        Submitted: {formatSubmittedDate(input.submitted_at ?? input.created_at)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onOpenCase(input.id)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Open Case
        </button>
        {!derived.isInactive && derived.badge !== "COMPLETED" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onRegenerateAudit(input.id)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              Regenerate Audit
            </button>
            {derived.isMissingImages && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onRequestMissingImages(input.id, caseLabel)}
                className="rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-medium text-orange-800 hover:bg-orange-50 disabled:opacity-60"
              >
                Request Missing Images
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => onMarkForReview(input.id)}
              className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-60"
            >
              Mark For Review
            </button>
            {derived.isFailed && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onRetryFailedAudit(input.id)}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-60"
              >
                Retry Failed Audit
              </button>
            )}
            {showImageLimitedOverride && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onImageLimitedOverride(input.id)}
                className="rounded-lg border border-violet-400 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-50 disabled:opacity-60"
              >
                Image Limited Override
              </button>
            )}
          </>
        )}
        {derived.badge === "COMPLETED" && (
          <Link
            href={`/cases/${input.id}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
          >
            View Report
          </Link>
        )}
      </div>
    </article>
  );
}
