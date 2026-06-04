"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClinicPickerOption } from "./defaults/ClinicDefaultsPicker";

export default function StartSurgeryUploadButton({
  isAuditor = false,
  clinics = [],
}: {
  isAuditor?: boolean;
  /** Only provided for auditors/admins: clinics they can start an upload for. */
  clinics?: ClinicPickerOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ClinicPickerOption | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clinics;
    return clinics.filter((c) =>
      `${c.clinicName} ${c.email ?? ""}`.toLowerCase().includes(q)
    );
  }, [clinics, query]);

  async function start(clinicProfileId?: string | null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/surgery-upload/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clinicProfileId ? { clinicProfileId } : {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.caseId) {
        throw new Error(json?.error ?? "Could not start a new surgery upload");
      }
      router.push(`/dashboard/surgery-upload/${json.caseId}`);
    } catch (e) {
      setError((e as Error)?.message ?? "Something went wrong");
      setBusy(false);
    }
  }

  // Non-auditors keep the simple, single-button flow.
  if (!isAuditor) {
    return (
      <div>
        <button
          type="button"
          onClick={() => start()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-4 text-base font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? "Starting…" : "+ Start new surgery upload"}
        </button>
        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      {/* Selected-clinic path is the obvious primary action for auditors. */}
      <button
        type="button"
        onClick={() => (selected ? start(selected.id) : setPickerOpen((o) => !o))}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-4 text-base font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
      >
        {busy
          ? "Starting…"
          : selected
            ? `+ Start upload for ${selected.clinicName || "clinic"}`
            : "+ Start upload for clinic"}
      </button>

      <div className="mt-2 flex items-center justify-between gap-2 text-sm">
        {selected ? (
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setPickerOpen(true);
            }}
            className="font-semibold text-cyan-700 hover:text-cyan-800"
          >
            Change clinic
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="font-semibold text-cyan-700 hover:text-cyan-800"
          >
            {pickerOpen ? "Hide clinic list" : "Choose a clinic"}
          </button>
        )}
        <button
          type="button"
          onClick={() => start(null)}
          disabled={busy}
          className="font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60"
        >
          Start without clinic
        </button>
      </div>

      {pickerOpen && !selected && (
        <div className="mt-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by clinic name or email…"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-cyan-500"
          />
          {clinics.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
              No clinics found.
            </p>
          ) : filtered.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
              No clinics match your search.
            </p>
          ) : (
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(c);
                      setPickerOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-cyan-300"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {c.clinicName || "Unnamed clinic"}
                      </span>
                      {c.email && (
                        <span className="block truncate text-xs text-slate-500">{c.email}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-2 text-xs text-slate-500">
        The new case inherits the selected clinic&apos;s defaults and photo checklist.
      </p>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
