"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const statuses = ["draft", "in_review", "reviewed", "archived"] as const;

export default function AcademyCaseStatusControl({ caseId, current }: { caseId: string; current: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [busy, setBusy] = useState(false);

  async function update(next: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/academy/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Update failed");
      setStatus(next);
      router.refresh();
    } catch {
      /* keep previous */
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-600">Status</span>
      <select
        value={status}
        disabled={busy}
        onChange={(e) => update(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm capitalize"
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
