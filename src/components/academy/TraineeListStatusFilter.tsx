"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TraineeListStatusFilter } from "@/lib/academy/traineeStatus";
import { traineeStatusLabel } from "@/lib/academy/traineeStatus";

const OPTIONS: { value: TraineeListStatusFilter; label: string }[] = [
  { value: "operational", label: "Active roster (default)" },
  { value: "active", label: traineeStatusLabel("active") },
  { value: "paused", label: traineeStatusLabel("paused") },
  { value: "graduated", label: traineeStatusLabel("graduated") },
  { value: "withdrawn", label: traineeStatusLabel("withdrawn") },
  { value: "archived", label: traineeStatusLabel("archived") },
  { value: "all", label: "All statuses" },
];

export default function TraineeListStatusFilter({ current }: { current: TraineeListStatusFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
      <span className="font-medium text-slate-600">Show</span>
      <select
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm"
        value={current}
        onChange={(e) => {
          const v = e.target.value as TraineeListStatusFilter;
          const next = new URLSearchParams(searchParams.toString());
          if (v === "operational") next.delete("status");
          else next.set("status", v);
          const q = next.toString();
          router.push(q ? `${pathname}?${q}` : pathname);
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
