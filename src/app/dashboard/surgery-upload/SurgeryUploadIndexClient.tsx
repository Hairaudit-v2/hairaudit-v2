"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  hasActiveSurgeryFilters,
  type SurgeryUploadFilters,
  SURGERY_PAGE_SIZES,
} from "@/lib/surgeryUpload/listParams";
import {
  EVIDENCE_REVIEW_STATUSES,
  EVIDENCE_REVIEW_STATUS_LABELS,
  evidenceReviewStatusLabel,
} from "@/lib/surgeryUpload/evidenceReview";
import {
  AUDIT_HANDOFF_STATUSES,
  AUDIT_HANDOFF_STATUS_LABELS,
  auditHandoffStatusLabel,
} from "@/lib/surgeryUpload/auditHandoff";
import type {
  SelectOption,
  SurgeryUploadFilterOptions,
  SurgeryUploadListItem,
} from "@/lib/surgeryUpload/listQuery";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Stage 4A: this is now a controlled filter/pagination UI. All real filtering and
 * pagination happen on the server; this component reads the sanitized state from
 * props and reflects user changes into URL params (which re-runs the server query).
 * It does NOT re-filter the already-paginated rows.
 */
export default function SurgeryUploadIndexClient({
  rows,
  options,
  filters,
  page,
  pageSize,
  totalCount,
  totalCountApproximate,
  hasPrevPage,
  hasNextPage,
  totalPages,
  procedureLabels,
  isAuditor,
}: {
  rows: SurgeryUploadListItem[];
  options: SurgeryUploadFilterOptions;
  filters: SurgeryUploadFilters;
  page: number;
  pageSize: number;
  totalCount: number;
  totalCountApproximate: boolean;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  totalPages: number | null;
  procedureLabels: Record<string, string>;
  isAuditor: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state for free-text / date inputs so typing stays responsive. Selects,
  // status pills and the checkbox navigate immediately. Local state re-syncs when
  // the server-provided filters change (clear filters, browser back, etc.).
  const [surgeonInput, setSurgeonInput] = useState(filters.surgeon);
  const [fromInput, setFromInput] = useState(filters.from ?? "");
  const [toInput, setToInput] = useState(filters.to ?? "");

  useEffect(() => setSurgeonInput(filters.surgeon), [filters.surgeon]);
  useEffect(() => setFromInput(filters.from ?? ""), [filters.from]);
  useEffect(() => setToInput(filters.to ?? ""), [filters.to]);

  const navigate = useCallback(
    (mutate: (sp: URLSearchParams) => void) => {
      const sp = new URLSearchParams(searchParams.toString());
      mutate(sp);
      const qs = sp.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [searchParams, pathname, router]
  );

  // Any filter change resets to page 1 but preserves the current pageSize.
  const updateFilters = useCallback(
    (changes: Record<string, string | null>) => {
      navigate((sp) => {
        for (const [k, v] of Object.entries(changes)) {
          if (v === null || v === "") sp.delete(k);
          else sp.set(k, v);
        }
        sp.delete("page");
      });
    },
    [navigate]
  );

  // Debounced free-text surgeon search.
  useEffect(() => {
    const trimmed = surgeonInput.trim();
    if (trimmed === filters.surgeon) return;
    const t = setTimeout(() => updateFilters({ surgeon: trimmed || null }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surgeonInput]);

  function onDateChange(which: "from" | "to", value: string) {
    if (which === "from") setFromInput(value);
    else setToInput(value);
    // Native date inputs only emit "" or a full YYYY-MM-DD; ignore anything else.
    if (value === "" || DATE_RE.test(value)) {
      updateFilters({ [which]: value || null });
    }
  }

  function goToPage(p: number) {
    if (p < 1) return;
    navigate((sp) => sp.set("page", String(p)));
  }

  function changePageSize(size: number) {
    navigate((sp) => {
      sp.set("pageSize", String(size));
      sp.delete("page");
    });
  }

  function clearFilters() {
    setSurgeonInput("");
    setFromInput("");
    setToInput("");
    navigate((sp) => {
      [
        "status",
        "reviewStatus",
        "handoffStatus",
        "clinic",
        "surgeon",
        "procedure",
        "missing",
        "from",
        "to",
        "page",
      ].forEach((k) => sp.delete(k));
    });
  }

  const activeFilters = hasActiveSurgeryFilters(filters);

  const totalLabel = totalCountApproximate
    ? `${totalCount}+ results`
    : `${totalCount} ${totalCount === 1 ? "result" : "results"}`;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">
          {isAuditor ? "Recent surgery uploads" : "Your surgery uploads"}
        </h2>
        {activeFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-cyan-700 hover:text-cyan-800"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "draft", "submitted"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateFilters({ status: s === "all" ? null : s })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filters.status === s
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "All" : s === "draft" ? "Draft" : "Submitted for review"}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.clinics.length > 0 && (
            <FilterSelect
              label="Clinic"
              value={filters.clinic}
              onChange={(v) => updateFilters({ clinic: v || null })}
              options={options.clinics}
              allLabel="All clinics"
            />
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Doctor / surgeon
            </span>
            <input
              type="search"
              list="surgery-surgeon-options"
              value={surgeonInput}
              onChange={(e) => setSurgeonInput(e.target.value)}
              placeholder="Search surgeon…"
              className={filterInputCls}
            />
            <datalist id="surgery-surgeon-options">
              {options.surgeons.map((opt) => (
                <option key={opt.value} value={opt.value} />
              ))}
            </datalist>
          </label>
          {options.procedures.length > 0 && (
            <FilterSelect
              label="Procedure type"
              value={filters.procedure}
              onChange={(v) => updateFilters({ procedure: v || null })}
              options={options.procedures}
              allLabel="All procedures"
            />
          )}
          <FilterSelect
            label="Review status"
            value={filters.reviewStatus}
            onChange={(v) => updateFilters({ reviewStatus: v || null })}
            options={EVIDENCE_REVIEW_STATUSES.map((s) => ({
              value: s,
              label: EVIDENCE_REVIEW_STATUS_LABELS[s],
            }))}
            allLabel="All review statuses"
          />
          <FilterSelect
            label="Audit handoff"
            value={filters.handoffStatus}
            onChange={(v) => updateFilters({ handoffStatus: v || null })}
            options={AUDIT_HANDOFF_STATUSES.map((s) => ({
              value: s,
              label: AUDIT_HANDOFF_STATUS_LABELS[s],
            }))}
            allLabel="All handoff statuses"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Surgery from</span>
              <input
                type="date"
                value={fromInput}
                onChange={(e) => onDateChange("from", e.target.value)}
                className={filterInputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Surgery to</span>
              <input
                type="date"
                value={toInput}
                onChange={(e) => onDateChange("to", e.target.value)}
                className={filterInputCls}
              />
            </label>
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filters.missing}
            onChange={(e) => updateFilters({ missing: e.target.checked ? "1" : null })}
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          Only show uploads missing required photos
        </label>
      </div>

      {/* Result summary + page size */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{totalLabel}</span>
        <label className="flex items-center gap-1.5">
          <span>Per page</span>
          <select
            value={pageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-cyan-500"
          >
            {SURGERY_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* List */}
      {rows.length === 0 ? (
        activeFilters ? (
          <EmptyState
            title="No uploads match your current filters."
            subtitle="Try clearing or adjusting the filters above."
          />
        ) : page > 1 ? (
          <EmptyState
            title="No uploads on this page."
            subtitle="Go back to the first page to see your uploads."
          />
        ) : (
          <EmptyState
            title="No surgery uploads found."
            subtitle="Tap “Start new surgery upload” to begin a draft."
          />
        )
      ) : (
        <ul
          className={`mt-3 space-y-3 transition-opacity ${isPending ? "opacity-60" : "opacity-100"}`}
        >
          {rows.map((r) => {
            const done = r.requiredSatisfiedCount;
            const total = r.requiredCountTotal;
            const complete = !r.missingRequired;
            return (
              <li key={r.case_id}>
                <Link
                  href={`/dashboard/surgery-upload/${r.case_id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-cyan-300 active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-semibold text-slate-900">
                      {r.patient_reference?.trim() || "Untitled surgery upload"}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {r.status === "submitted" && (
                        <HandoffStatusBadge status={r.audit_handoff_status} />
                      )}
                      {r.status === "submitted" && (
                        <ReviewStatusBadge status={r.evidence_review_status} />
                      )}
                      <StatusPill status={r.status} />
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {r.procedure_type && (
                      <span>{procedureLabels[r.procedure_type] ?? r.procedure_type}</span>
                    )}
                    {r.surgery_date && <span>{r.surgery_date}</span>}
                    {r.clinic_name && <span className="truncate">{r.clinic_name}</span>}
                    {r.surgeon_name && <span className="truncate">{r.surgeon_name}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                    <span
                      className={`font-medium ${complete ? "text-emerald-700" : "text-slate-500"}`}
                    >
                      {done}/{total} required photos
                    </span>
                    {r.status === "submitted" && r.submitted_at && (
                      <span className="text-slate-400">
                        Submitted {new Date(r.submitted_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {(hasPrevPage || hasNextPage) && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={!hasPrevPage || isPending}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs font-medium text-slate-500">
            Page {page}
            {totalPages ? ` of ${totalPages}` : ""}
          </span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={!hasNextPage || isPending}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

const filterInputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500";

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  allLabel: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={filterInputCls}
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const submitted = status === "submitted";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        submitted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {submitted ? "Submitted for review" : "Draft"}
    </span>
  );
}

function HandoffStatusBadge({ status }: { status: string }) {
  // Keep rows uncluttered: only surface meaningful handoff states.
  if (!status || status === "not_sent") return null;
  const cls =
    status === "sent"
      ? "bg-indigo-100 text-indigo-800"
      : status === "failed"
        ? "bg-rose-100 text-rose-800"
        : status === "sending"
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-600";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {auditHandoffStatusLabel(status)}
    </span>
  );
}

function ReviewStatusBadge({ status }: { status: string }) {
  // Hide the default "not reviewed" state to keep the row uncluttered.
  if (!status || status === "not_reviewed") return null;
  const cls =
    status === "needs_more_evidence"
      ? "bg-amber-100 text-amber-800"
      : status === "evidence_accepted"
        ? "bg-emerald-100 text-emerald-800"
        : status === "ready_for_audit"
          ? "bg-cyan-100 text-cyan-800"
          : "bg-slate-100 text-slate-600";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {evidenceReviewStatusLabel(status)}
    </span>
  );
}
