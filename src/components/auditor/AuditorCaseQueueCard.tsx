"use client";

import {
  badgeStyles,
  formatRelativeTime,
  type AuditorQueueBadge,
  type AuditorQueueDerived,
  type AuditorQueueCaseInput,
} from "@/lib/auditor/auditorQueueTriage";
import { resolveAuditorCaseActions, type AuditorCaseAction } from "@/lib/auditor/auditorCaseActions";
import AuditorCaseActionButtons from "@/components/auditor/AuditorCaseActionButtons";
import AuditorCasePreviewThumb from "@/components/auditor/AuditorCasePreviewThumb";

export type AuditorCaseQueueCardProps = {
  input: AuditorQueueCaseInput;
  derived: AuditorQueueDerived;
  clinicName: string | null;
  previewUrl?: string | null;
  compact?: boolean;
  variant?: "default" | "active";
  busy?: boolean;
  onAction: (action: AuditorCaseAction, caseId: string, caseLabel: string) => void;
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
  previewUrl = null,
  compact = false,
  variant = "default",
  busy = false,
  onAction,
}: AuditorCaseQueueCardProps) {
  const displayName = input.patientName?.trim() || input.title?.trim() || "Unknown patient";
  const caseLabel = input.title ?? input.id.slice(0, 8);
  const { photoProgress } = derived;
  const isActiveVariant = variant === "active";
  const actions = resolveAuditorCaseActions(input, derived);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <AuditorCasePreviewThumb url={previewUrl} label={`Preview for case ${derived.caseNumberLabel}`} size="md" />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900 truncate">
              {isActiveVariant ? derived.auditTypeLabel : displayName}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Case {derived.caseNumberLabel}
              {!isActiveVariant && clinicName ? ` · ${clinicName}` : ""}
            </p>
            {isActiveVariant ? (
              <p className="text-sm font-medium uppercase tracking-wide text-slate-600 mt-1">{derived.auditTypeLabel}</p>
            ) : (
              <p className="text-sm text-slate-600 mt-1">{derived.auditTypeLabel}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isActiveVariant && (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
          )}
          <StatusBadge badge={derived.badge} />
          {!isActiveVariant && (
            <span className="text-xs font-medium text-slate-500">Priority {derived.priorityScore}</span>
          )}
        </div>
      </div>

      {!compact && !isActiveVariant && (
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
        <span>{input.imageUploadCount} image{input.imageUploadCount === 1 ? "" : "s"} uploaded</span>
        {input.pdfDocumentCount > 0 && (
          <span>
            PDF documents: {input.pdfDocumentCount}
          </span>
        )}
        <span>Clinical history: {input.hasClinicalHistory ? "Present" : "Missing"}</span>
        {isActiveVariant && (
          <span>
            Required photos: {photoProgress.completedCount}/{photoProgress.totalRequired} complete
          </span>
        )}
      </div>

      {derived.failureSummary && (
        <p className="mt-2 text-sm text-red-700">
          Failed: {derived.failureSummary}
        </p>
      )}

      {!isActiveVariant && (
        <p className="mt-2 text-xs text-slate-500">
          Submitted: {formatSubmittedDate(input.submitted_at ?? input.created_at)}
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
