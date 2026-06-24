"use client";

import { useMemo, useState } from "react";
import { auditorPatientPhotoCategoryLabel } from "@/lib/auditor/auditorPatientPhotoCategories";
import {
  buildAuditorGroupedCategoryOptions,
  type AuditorGroupedCategoryOption,
} from "@/lib/auditor/auditorImageSortingUx";
import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

export default function AuditorImageCategorySelect({
  pathway,
  excludeKey,
  value,
  onChange,
  disabled,
  placeholder = "Move to…",
  id,
  "aria-label": ariaLabel,
}: {
  pathway: PatientReviewPathway;
  excludeKey?: string | null;
  value?: string;
  onChange: (categoryKey: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const [search, setSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const options = useMemo(
    () =>
      buildAuditorGroupedCategoryOptions({
        pathway,
        excludeKey,
        showAdvanced,
        searchQuery: search,
      }),
    [pathway, excludeKey, showAdvanced, search]
  );

  const groups = useMemo(() => {
    const m = new Map<string, { label: string; items: AuditorGroupedCategoryOption[] }>();
    for (const opt of options) {
      const g = m.get(opt.groupId) ?? { label: opt.groupLabel, items: [] };
      g.items.push(opt);
      m.set(opt.groupId, g);
    }
    return [...m.entries()];
  }, [options]);

  return (
    <div className="flex min-w-[220px] flex-col gap-1">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search categories…"
        disabled={disabled}
        className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500"
        aria-label="Search photo categories"
      />
      <select
        id={id}
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v) onChange(v);
        }}
        className="max-w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
        aria-label={ariaLabel ?? "Assign photo category"}
      >
        <option value="">{placeholder}</option>
        {groups.map(([groupId, group]) => (
          <optgroup key={groupId} label={group.label}>
            {group.items.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-400">
        <input
          type="checkbox"
          checked={showAdvanced}
          onChange={(e) => setShowAdvanced(e.target.checked)}
          disabled={disabled}
          className="rounded border-slate-600"
        />
        Show advanced categories
      </label>
      {search && options.length === 0 ? (
        <p className="text-[10px] text-slate-500">No categories match “{search}”.</p>
      ) : null}
    </div>
  );
}

/** Compact select without search — for bulk toolbar. */
export function AuditorImageCategorySelectCompact({
  pathway,
  onChange,
  disabled,
  showAdvanced = false,
}: {
  pathway: PatientReviewPathway;
  onChange: (categoryKey: string) => void;
  disabled?: boolean;
  showAdvanced?: boolean;
}) {
  const options = useMemo(
    () => buildAuditorGroupedCategoryOptions({ pathway, showAdvanced }),
    [pathway, showAdvanced]
  );

  const groups = useMemo(() => {
    const m = new Map<string, { label: string; items: AuditorGroupedCategoryOption[] }>();
    for (const opt of options) {
      const g = m.get(opt.groupId) ?? { label: opt.groupLabel, items: [] };
      g.items.push(opt);
      m.set(opt.groupId, g);
    }
    return [...m.entries()];
  }, [options]);

  return (
    <select
      disabled={disabled}
      defaultValue=""
      onChange={(e) => {
        const v = e.target.value;
        e.target.value = "";
        if (v) onChange(v);
      }}
      className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
      aria-label="Bulk assign category"
    >
      <option value="">Assign selected to…</option>
      {groups.map(([groupId, group]) => (
        <optgroup key={groupId} label={group.label}>
          {group.items.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {auditorPatientPhotoCategoryLabel(opt.key)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
