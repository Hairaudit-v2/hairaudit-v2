import Link from "next/link";
import type { BulkBatchContextDisplay } from "@/lib/hair-audit/bulkUpload/types";

export default function BulkBatchInheritedMetadataPanel({
  display,
  caseLabel,
  variant = "dark",
  showAdminLink = false,
}: {
  display: BulkBatchContextDisplay;
  caseLabel?: string | null;
  variant?: "dark" | "light";
  showAdminLink?: boolean;
}) {
  if (!display.fields.length) return null;

  const shell =
    variant === "dark"
      ? "rounded-xl border border-cyan-400/25 bg-cyan-950/20 p-4"
      : "rounded-xl border border-slate-200 bg-slate-50 p-4";
  const titleClass = variant === "dark" ? "text-sm font-semibold text-cyan-100" : "text-sm font-semibold text-slate-900";
  const introClass = variant === "dark" ? "mt-1 text-xs text-cyan-100/80" : "mt-1 text-xs text-slate-600";
  const labelClass = variant === "dark" ? "text-[11px] uppercase tracking-wide text-slate-400" : "text-[11px] uppercase tracking-wide text-slate-500";
  const valueClass = variant === "dark" ? "mt-0.5 text-sm text-slate-100" : "mt-0.5 text-sm text-slate-800";
  const badgeClass =
    variant === "dark"
      ? "rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100"
      : "rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900";

  return (
    <section className={shell} aria-labelledby="bulk-batch-metadata-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="bulk-batch-metadata-title" className={titleClass}>
              Bulk upload batch details
            </h2>
            <span className={badgeClass}>Bulk upload batch</span>
            {caseLabel ? <span className={badgeClass}>{caseLabel}</span> : null}
          </div>
          <p className={introClass}>
            This case was created from a bulk doctor upload. Some surgical details were inherited from the batch
            record.
          </p>
        </div>
        {showAdminLink ? (
          <Link
            href={`/admin/hair-audit/bulk-upload/${display.batchId}`}
            className={
              variant === "dark"
                ? "text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                : "text-xs font-semibold text-cyan-700 hover:text-cyan-800"
            }
          >
            Open batch →
          </Link>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {display.fields.map((field) => (
          <div key={field.label}>
            <dt className={labelClass}>{field.label}</dt>
            <dd className={valueClass}>{field.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
