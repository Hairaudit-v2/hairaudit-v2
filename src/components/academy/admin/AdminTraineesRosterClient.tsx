"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TraineeDuplicateHint } from "@/lib/academy/traineeDuplicates";
import type { TraineeListStatusFilter, TraineeStatus } from "@/lib/academy/traineeStatus";
import { parseTraineeListStatusFilter, statusesForListFilter, traineeStatusLabel } from "@/lib/academy/traineeStatus";

type Row = {
  id: string;
  full_name: string;
  email: string | null;
  auth_user_id: string | null;
  status: string;
  current_stage: string;
  created_at: string;
};

const FILTER_OPTIONS: { value: TraineeListStatusFilter; label: string }[] = [
  { value: "operational", label: "Active roster" },
  { value: "active", label: traineeStatusLabel("active") },
  { value: "paused", label: traineeStatusLabel("paused") },
  { value: "graduated", label: traineeStatusLabel("graduated") },
  { value: "withdrawn", label: traineeStatusLabel("withdrawn") },
  { value: "archived", label: traineeStatusLabel("archived") },
  { value: "all", label: "All" },
];

export default function AdminTraineesRosterClient({
  trainees,
  duplicateHints,
}: {
  trainees: Row[];
  duplicateHints: TraineeDuplicateHint[];
}) {
  const [filter, setFilter] = useState<TraineeListStatusFilter>("operational");

  const allowed = useMemo(() => statusesForListFilter(filter), [filter]);
  const rows = useMemo(() => {
    if (allowed === "all") return trainees;
    return trainees.filter((t) => (allowed as TraineeStatus[]).includes(t.status as TraineeStatus));
  }, [trainees, allowed]);

  return (
    <div className="space-y-8">
      <section id="duplicates" className="scroll-mt-24 rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-amber-950">Possible duplicate profiles</h2>
        <p className="mt-1 text-xs text-amber-900/90">
          Compare these before creating a new trainee. Fix mistakes by editing an existing row (name, email, linked login) instead of
          adding another profile.
        </p>
        {duplicateHints.length === 0 ? (
          <p className="mt-3 text-sm text-amber-900/80">No duplicate patterns detected in the current roster.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-amber-950">
            {duplicateHints.map((h) => (
              <li key={`${h.kind}-${h.key}-${h.doctorIds.join(",")}`} className="rounded-lg bg-white/80 px-3 py-2 ring-1 ring-amber-200/80">
                <span className="font-medium">{h.description}</span>
                <span className="text-amber-800"> · </span>
                {h.doctorIds.map((id, i) => (
                  <span key={id}>
                    {i > 0 ? ", " : null}
                    <Link href={`/academy/trainees/${id}/edit`} className="font-medium text-amber-900 underline hover:no-underline">
                      Open edit
                    </Link>
                    <span className="text-xs text-slate-600"> ({id.slice(0, 8)}…)</span>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Full roster</h2>
          <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <span className="text-slate-600">Filter</span>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(parseTraineeListStatusFilter(e.target.value))}
            >
              {FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 hidden md:table-cell">Email</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No trainees in this filter.
                  </td>
                </tr>
              ) : (
                rows.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <Link href={`/academy/trainees/${d.id}/edit`} className="font-medium text-amber-800 hover:underline">
                        {d.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{d.email || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{d.current_stage}</td>
                    <td className="px-4 py-3 text-slate-600">{traineeStatusLabel(d.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
