"use client";

import type { AuditorWorkloadStatus } from "@/lib/auditor/auditorQueueTriage";

export default function AuditorWorkloadStatusCards({ status }: { status: AuditorWorkloadStatus }) {
  const cards = [
    {
      count: status.readyToAudit,
      label: "Ready To Audit",
      hint: "Required images complete · waiting for auditor review",
      tone: "border-emerald-300 bg-emerald-50 text-emerald-900",
      countTone: "text-emerald-700",
    },
    {
      count: status.failedCases,
      label: "Failed Cases",
      hint: "PDF, AI, or regeneration failures",
      tone: "border-red-300 bg-red-50 text-red-900",
      countTone: "text-red-700",
    },
    {
      count: status.waitingOnPatient,
      label: "Waiting On Patient",
      hint: "Missing images, incomplete uploads, or translation",
      tone: "border-orange-300 bg-orange-50 text-orange-900",
      countTone: "text-orange-700",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border-2 p-5 ${card.tone}`}>
          <p className={`text-4xl font-bold ${card.countTone}`}>{card.count}</p>
          <p className="mt-2 text-sm font-bold uppercase tracking-wide">{card.label}</p>
          <p className="mt-1 text-xs opacity-80">{card.hint}</p>
        </div>
      ))}
    </div>
  );
}
