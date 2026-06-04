"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type ClinicPickerOption = {
  id: string;
  clinicName: string;
  email: string | null;
  /** Raw participation_status, e.g. "active" | "invited" | "not_started" | "high_transparency". */
  status: string | null;
};

const ACTIVE_STATUSES = new Set(["active", "high_transparency"]);

function statusLabel(status: string | null): { label: string; active: boolean } | null {
  if (!status) return null;
  const active = ACTIVE_STATUSES.has(status);
  if (active) return { label: "Active", active: true };
  if (status === "invited") return { label: "Invited", active: false };
  if (status === "not_started") return { label: "Inactive", active: false };
  return { label: status.replace(/_/g, " "), active: false };
}

export default function ClinicDefaultsPicker({
  clinics,
  selectedClinicProfileId,
}: {
  clinics: ClinicPickerOption[];
  selectedClinicProfileId: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clinics;
    return clinics.filter((c) => {
      const haystack = `${c.clinicName} ${c.email ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [clinics, query]);

  function select(id: string) {
    router.push(`/dashboard/surgery-upload/defaults?clinicProfileId=${encodeURIComponent(id)}`);
  }

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Select a clinic</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Choose which clinic&apos;s surgery defaults to view or edit.
      </p>

      <input
        type="search"
        className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-cyan-500"
        placeholder="Search by clinic name or email…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {clinics.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          No clinics found.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          No clinics match your search.
        </p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {filtered.map((c) => {
            const active = c.id === selectedClinicProfileId;
            const badge = statusLabel(c.status);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => select(c.id)}
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-cyan-500 bg-cyan-50"
                      : "border-slate-200 bg-white hover:border-cyan-300"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {c.clinicName || "Unnamed clinic"}
                    </span>
                    {c.email && (
                      <span className="block truncate text-xs text-slate-500">{c.email}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          badge.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {badge.label}
                      </span>
                    )}
                    {active && (
                      <span className="text-xs font-semibold text-cyan-700">Selected</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
