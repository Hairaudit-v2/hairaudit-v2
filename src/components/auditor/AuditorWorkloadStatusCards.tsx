"use client";

import type { AuditorWorkloadStatus } from "@/lib/auditor/auditorQueueTriage";

export type AuditorWorkloadFilter = "all" | "ready" | "failed" | "waiting";

export default function AuditorWorkloadStatusCards({
  status,
  selected,
  onSelect,
}: {
  status: AuditorWorkloadStatus;
  selected: AuditorWorkloadFilter;
  onSelect: (filter: AuditorWorkloadFilter) => void;
}) {
  const cards: Array<{
    id: AuditorWorkloadFilter;
    count: number;
    label: string;
    hint: string;
    tone: string;
    countTone: string;
    selectedTone: string;
  }> = [
    {
      id: "ready",
      count: status.readyToAudit,
      label: "Ready To Audit",
      hint: "Click to review · Start or Continue Audit",
      tone: "border-emerald-300 bg-emerald-50 text-emerald-900",
      countTone: "text-emerald-700",
      selectedTone: "ring-2 ring-emerald-600 ring-offset-2",
    },
    {
      id: "failed",
      count: status.failedCases,
      label: "Failed Cases",
      hint: "Click to review · Manual Audit still available",
      tone: "border-red-300 bg-red-50 text-red-900",
      countTone: "text-red-700",
      selectedTone: "ring-2 ring-red-600 ring-offset-2",
    },
    {
      id: "waiting",
      count: status.waitingOnPatient,
      label: "Waiting On Patient",
      hint: "Click to review · View Case or request images",
      tone: "border-orange-300 bg-orange-50 text-orange-900",
      countTone: "text-orange-700",
      selectedTone: "ring-2 ring-orange-600 ring-offset-2",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Filter the queue by what needs attention:</p>
        {selected !== "all" && (
          <button
            type="button"
            onClick={() => onSelect("all")}
            className="text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
          >
            Show all sections
          </button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const isSelected = selected === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelect(isSelected ? "all" : card.id)}
              aria-pressed={isSelected}
              className={`rounded-xl border-2 p-5 text-left transition-shadow hover:shadow-md ${card.tone} ${
                isSelected ? card.selectedTone : ""
              }`}
            >
              <p className={`text-4xl font-bold ${card.countTone}`}>{card.count}</p>
              <p className="mt-2 text-sm font-bold uppercase tracking-wide">{card.label}</p>
              <p className="mt-1 text-xs opacity-80">{card.hint}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
