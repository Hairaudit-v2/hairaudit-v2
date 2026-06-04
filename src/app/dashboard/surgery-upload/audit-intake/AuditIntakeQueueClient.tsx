"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AUDIT_INTAKE_PRIORITIES,
  AUDIT_INTAKE_PRIORITY_LABELS,
  AUDIT_INTAKE_STATUSES,
  AUDIT_INTAKE_STATUS_LABELS,
  auditIntakePriorityLabel,
  auditIntakeStatusLabel,
  nextAuditIntakeStatuses,
  type AuditIntakePriority,
  type AuditIntakeStatus,
} from "@/lib/surgeryUpload/auditIntake";
import { evidenceReviewStatusLabel } from "@/lib/surgeryUpload/evidenceReview";
import {
  hasActiveAuditIntakeFilters,
  AUDIT_INTAKE_PAGE_SIZES,
  type AuditIntakeFilters,
} from "@/lib/surgeryUpload/auditIntakeListParams";
import type {
  AuditIntakeFilterOptions,
  AuditIntakeQueueRow,
  SelectOption,
} from "@/lib/surgeryUpload/auditIntakeQuery";
import SurgeryPhotoExportPackButton from "@/components/surgery-upload/SurgeryPhotoExportPackButton";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function AuditIntakeQueueClient({
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
}: {
  rows: AuditIntakeQueueRow[];
  options: AuditIntakeFilterOptions;
  filters: AuditIntakeFilters;
  page: number;
  pageSize: number;
  totalCount: number;
  totalCountApproximate: boolean;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  totalPages: number | null;
  procedureLabels: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchInput, setSearchInput] = useState(filters.search);
  const [fromInput, setFromInput] = useState(filters.from ?? "");
  const [toInput, setToInput] = useState(filters.to ?? "");

  useEffect(() => setSearchInput(filters.search), [filters.search]);
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

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === filters.search) return;
    const t = setTimeout(() => updateFilters({ search: trimmed || null }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function onDateChange(which: "from" | "to", value: string) {
    if (which === "from") setFromInput(value);
    else setToInput(value);
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
    setSearchInput("");
    setFromInput("");
    setToInput("");
    navigate((sp) => {
      ["status", "priority", "clinic", "assignedTo", "procedure", "search", "from", "to", "page"].forEach(
        (k) => sp.delete(k)
      );
    });
  }

  const activeFilters = hasActiveAuditIntakeFilters(filters);
  const totalLabel = totalCountApproximate
    ? `${totalCount}+ records`
    : `${totalCount} ${totalCount === 1 ? "record" : "records"}`;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Intake records</h2>
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
          {(["all", ...AUDIT_INTAKE_STATUSES] as const).map((s) => (
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
              {s === "all" ? "All" : AUDIT_INTAKE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FilterSelect
            label="Priority"
            value={filters.priority}
            onChange={(v) => updateFilters({ priority: v || null })}
            options={AUDIT_INTAKE_PRIORITIES.map((p) => ({
              value: p,
              label: AUDIT_INTAKE_PRIORITY_LABELS[p],
            }))}
            allLabel="All priorities"
          />
          {options.clinics.length > 0 && (
            <FilterSelect
              label="Clinic"
              value={filters.clinic}
              onChange={(v) => updateFilters({ clinic: v || null })}
              options={options.clinics}
              allLabel="All clinics"
            />
          )}
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
            label="Assigned reviewer"
            value={filters.assignedTo}
            onChange={(v) => updateFilters({ assignedTo: v || null })}
            options={[{ value: "unassigned", label: "Unassigned" }, ...options.assignees]}
            allLabel="Any assignment"
          />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Search surgeon / reference
            </span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search…"
              className={filterInputCls}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Created from</span>
              <input
                type="date"
                value={fromInput}
                onChange={(e) => onDateChange("from", e.target.value)}
                className={filterInputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Created to</span>
              <input
                type="date"
                value={toInput}
                onChange={(e) => onDateChange("to", e.target.value)}
                className={filterInputCls}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Summary + page size */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{totalLabel}</span>
        <label className="flex items-center gap-1.5">
          <span>Per page</span>
          <select
            value={pageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-cyan-500"
          >
            {AUDIT_INTAKE_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-700">
            {activeFilters ? "No intake records match your filters." : "No intake records yet."}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {activeFilters
              ? "Try clearing or adjusting the filters above."
              : "Records appear here once an auditor sends a reviewed surgery upload to audit."}
          </p>
        </div>
      ) : (
        <ul
          className={`mt-3 space-y-3 transition-opacity ${isPending ? "opacity-60" : "opacity-100"}`}
        >
          {rows.map((r) => (
            <IntakeCard key={r.id} row={r} procedureLabels={procedureLabels} />
          ))}
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
      <select value={value} onChange={(e) => onChange(e.target.value)} className={filterInputCls}>
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

function statusBadgeClass(status: AuditIntakeStatus): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "processing":
      return "bg-cyan-100 text-cyan-800";
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "failed":
      return "bg-rose-100 text-rose-800";
    case "cancelled":
      return "bg-slate-200 text-slate-600";
  }
}

function priorityBadgeClass(priority: AuditIntakePriority): string {
  switch (priority) {
    case "urgent":
      return "bg-rose-100 text-rose-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "normal":
      return "bg-slate-100 text-slate-600";
    case "low":
      return "bg-slate-100 text-slate-500";
  }
}

type SaveState = "idle" | "saving" | "saved" | "error";

function IntakeCard({
  row,
  procedureLabels,
}: {
  row: AuditIntakeQueueRow;
  procedureLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AuditIntakeStatus>(row.status);
  const [priority, setPriority] = useState<AuditIntakePriority>(row.priority);
  const [reviewerNotes, setReviewerNotes] = useState<string>(row.reviewer_notes ?? "");
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const transitionTargets = useMemo(() => nextAuditIntakeStatuses(row.status), [row.status]);
  const dirty =
    status !== row.status ||
    priority !== row.priority ||
    reviewerNotes.trim() !== (row.reviewer_notes ?? "");

  const handleSave = useCallback(async () => {
    setSave("saving");
    setError(null);
    try {
      const res = await fetch(`/api/surgery-upload/audit-intake/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(status !== row.status ? { status } : {}),
          ...(priority !== row.priority ? { priority } : {}),
          ...(reviewerNotes.trim() !== (row.reviewer_notes ?? "")
            ? { reviewerNotes: reviewerNotes.trim() }
            : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setSave("error");
        setError(json.error ?? "Could not save changes");
        return;
      }
      setSave("saved");
      router.refresh();
      setTimeout(() => setSave("idle"), 1500);
    } catch {
      setSave("error");
      setError("Could not save changes");
    }
  }, [row.id, row.status, row.priority, row.reviewer_notes, status, priority, reviewerNotes, router]);

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/cases/${row.case_id}`}
            className="truncate font-semibold text-slate-900 hover:text-cyan-700"
          >
            {row.patient_reference?.trim() || "Untitled surgery upload"}
          </Link>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
            {row.clinic_name && <span className="truncate">{row.clinic_name}</span>}
            {row.surgeon_name && <span className="truncate">{row.surgeon_name}</span>}
            {row.procedure_type && (
              <span>{procedureLabels[row.procedure_type] ?? row.procedure_type}</span>
            )}
            {row.surgery_date && <span>{row.surgery_date}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityBadgeClass(row.priority)}`}
          >
            {auditIntakePriorityLabel(row.priority)}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status)}`}
          >
            {auditIntakeStatusLabel(row.status)}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          Required photos:{" "}
          <span className={row.missingRequired ? "text-amber-700" : "text-emerald-700"}>
            {row.requiredSatisfiedCount}/{row.requiredCountTotal}
          </span>
        </span>
        <span>Evidence: {evidenceReviewStatusLabel(row.evidence_review_status)}</span>
        <span>Sent {new Date(row.created_at).toLocaleDateString()}</span>
        {row.assignedLabel && <span>Reviewer: {row.assignedLabel}</span>}
      </div>

      <div className="mt-2">
        <SurgeryPhotoExportPackButton caseId={row.case_id} variant="link" />
      </div>

      {row.error_message && status === "failed" && (
        <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {row.error_message}
        </p>
      )}

      {/* Management controls (auditor/admin only — this whole page is gated). */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AuditIntakeStatus)}
              className={filterInputCls}
            >
              <option value={row.status}>{auditIntakeStatusLabel(row.status)} (current)</option>
              {transitionTargets.map((s) => (
                <option key={s} value={s}>
                  {AUDIT_INTAKE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as AuditIntakePriority)}
              className={filterInputCls}
            >
              {AUDIT_INTAKE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {AUDIT_INTAKE_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          value={reviewerNotes}
          onChange={(e) => setReviewerNotes(e.target.value)}
          rows={2}
          placeholder="Reviewer notes (internal)"
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || save === "saving"}
            className="rounded-md bg-cyan-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {save === "saving" ? "Saving…" : "Save"}
          </button>
          {save === "saved" && <span className="text-xs font-medium text-emerald-700">Saved</span>}
          {save === "error" && (
            <span className="text-xs font-medium text-rose-700">{error ?? "Failed"}</span>
          )}
          <Link
            href={`/cases/${row.case_id}`}
            className="ml-auto text-xs font-semibold text-cyan-700 hover:text-cyan-800"
          >
            Open case →
          </Link>
        </div>
      </div>
    </li>
  );
}
