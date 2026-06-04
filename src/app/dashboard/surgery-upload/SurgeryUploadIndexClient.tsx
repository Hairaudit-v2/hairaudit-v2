"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type SurgeryUploadListRow = {
  case_id: string;
  patient_reference: string | null;
  clinic_name: string | null;
  clinic_profile_id: string | null;
  surgeon_name: string | null;
  surgery_date: string | null;
  procedure_type: string | null;
  status: string;
  submitted_at: string | null;
};

type StatusFilter = "all" | "draft" | "submitted";

type SelectOption = { value: string; label: string };

const UNKNOWN_CLINIC_LABEL = "Unknown clinic";

/**
 * Stable clinic identity key for filtering. Prefers the linked clinic_profile_id so
 * text variations of the same clinic collapse to one option; falls back to a
 * normalized clinic_name, then a shared "unknown" bucket for null/blank records.
 */
function clinicKey(r: SurgeryUploadListRow): string {
  if (r.clinic_profile_id) return `id:${r.clinic_profile_id}`;
  const name = (r.clinic_name ?? "").trim();
  return name ? `name:${name.toLowerCase()}` : "__unknown__";
}

function clinicLabelOf(r: SurgeryUploadListRow): string {
  const name = (r.clinic_name ?? "").trim();
  return name || UNKNOWN_CLINIC_LABEL;
}

export default function SurgeryUploadIndexClient({
  rows,
  requiredDoneByCase,
  requiredTotalByCase,
  requiredPhotoTotal,
  procedureLabels,
  isAuditor,
}: {
  rows: SurgeryUploadListRow[];
  requiredDoneByCase: Record<string, number>;
  /** Per-case required total (clinics may promote optional categories to required). */
  requiredTotalByCase: Record<string, number>;
  /** Fallback base required total when a case has no resolved total. */
  requiredPhotoTotal: number;
  procedureLabels: Record<string, string>;
  isAuditor: boolean;
}) {
  const totalFor = (caseId: string) => requiredTotalByCase[caseId] ?? requiredPhotoTotal;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialise from URL query params so filters are shareable/bookmarkable and the
  // param shape is ready to be consumed server-side in a future stage. Client-side
  // filtering below is unchanged.
  const initStatus = ((): StatusFilter => {
    const s = searchParams.get("status");
    return s === "draft" || s === "submitted" ? s : "all";
  })();
  const [status, setStatus] = useState<StatusFilter>(initStatus);
  const [clinic, setClinic] = useState(searchParams.get("clinic") ?? "");
  const [surgeon, setSurgeon] = useState(searchParams.get("surgeon") ?? "");
  const [procedure, setProcedure] = useState(searchParams.get("procedure") ?? "");
  const [missingOnly, setMissingOnly] = useState(searchParams.get("missing") === "1");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? "");

  // Reflect the current filter state in the URL (low-risk, no full reload). The
  // canonical param names here map directly to future server-side query filters.
  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (clinic) params.set("clinic", clinic);
    if (surgeon) params.set("surgeon", surgeon);
    if (procedure) params.set("procedure", procedure);
    if (missingOnly) params.set("missing", "1");
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const qs = params.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, clinic, surgeon, procedure, missingOnly, dateFrom, dateTo]);

  // Distinct option lists, derived from the current result set.
  // Clinics are keyed by clinic_profile_id (Stage 2.2) so text variations of the
  // same linked clinic collapse to a single, de-duplicated option.
  const clinicOptions = useMemo<SelectOption[]>(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const value = clinicKey(r);
      if (!map.has(value)) map.set(value, clinicLabelOf(r));
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);
  const surgeonOptions = useMemo<SelectOption[]>(
    () => uniqueSorted(rows.map((r) => r.surgeon_name)).map((v) => ({ value: v, label: v })),
    [rows]
  );
  const procedureOptions = useMemo<SelectOption[]>(
    () =>
      uniqueSorted(rows.map((r) => r.procedure_type)).map((v) => ({
        value: v,
        label: procedureLabels[v] ?? v,
      })),
    [rows, procedureLabels]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (clinic && clinicKey(r) !== clinic) return false;
      if (surgeon && r.surgeon_name !== surgeon) return false;
      if (procedure && r.procedure_type !== procedure) return false;
      if (
        missingOnly &&
        (requiredDoneByCase[r.case_id] ?? 0) >=
          (requiredTotalByCase[r.case_id] ?? requiredPhotoTotal)
      ) {
        return false;
      }
      if (dateFrom && (!r.surgery_date || r.surgery_date < dateFrom)) return false;
      if (dateTo && (!r.surgery_date || r.surgery_date > dateTo)) return false;
      return true;
    });
  }, [
    rows,
    status,
    clinic,
    surgeon,
    procedure,
    missingOnly,
    dateFrom,
    dateTo,
    requiredDoneByCase,
    requiredTotalByCase,
    requiredPhotoTotal,
  ]);

  const hasActiveFilters =
    status !== "all" ||
    Boolean(clinic) ||
    Boolean(surgeon) ||
    Boolean(procedure) ||
    missingOnly ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  function resetFilters() {
    setStatus("all");
    setClinic("");
    setSurgeon("");
    setProcedure("");
    setMissingOnly(false);
    setDateFrom("");
    setDateTo("");
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">
          {isAuditor ? "Recent surgery uploads" : "Your surgery uploads"}
        </h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
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
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                status === s
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "All" : s === "draft" ? "Draft" : "Submitted for review"}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {clinicOptions.length > 0 && (
            <FilterSelect
              label="Clinic"
              value={clinic}
              onChange={setClinic}
              options={clinicOptions}
              allLabel="All clinics"
            />
          )}
          {surgeonOptions.length > 0 && (
            <FilterSelect
              label="Doctor / surgeon"
              value={surgeon}
              onChange={setSurgeon}
              options={surgeonOptions}
              allLabel="All surgeons"
            />
          )}
          {procedureOptions.length > 0 && (
            <FilterSelect
              label="Procedure type"
              value={procedure}
              onChange={setProcedure}
              options={procedureOptions}
              allLabel="All procedures"
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Surgery from</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={filterInputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Surgery to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={filterInputCls}
              />
            </label>
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={missingOnly}
            onChange={(e) => setMissingOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          Only show uploads missing required photos
        </label>
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <EmptyState
          title="No surgery uploads found."
          subtitle="Tap “Start new surgery upload” to begin a draft."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No uploads match your current filters."
          subtitle="Try clearing or adjusting the filters above."
        />
      ) : (
        <ul className="mt-3 space-y-3">
          {filtered.map((r) => {
            const done = requiredDoneByCase[r.case_id] ?? 0;
            const total = totalFor(r.case_id);
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
                    <StatusPill status={r.status} />
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
                      className={`font-medium ${
                        done >= total ? "text-emerald-700" : "text-slate-500"
                      }`}
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

function uniqueSorted(values: (string | null)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const trimmed = (v ?? "").trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
