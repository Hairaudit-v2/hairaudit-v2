"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateCaseButton({
  variant = "default",
  className = "",
  label,
}: {
  variant?: "default" | "premium" | "card";
  className?: string;
  /** Override button label (e.g. "Start New Audit"). */
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const defaultLabels: Record<string, string> = {
    default: "Create new audit case",
    premium: "Create new audit case",
    card: "Start New Audit",
  };
  const displayLabel = label ?? defaultLabels[variant] ?? defaultLabels.default;

  const styles =
    variant === "premium"
      ? "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      : variant === "card"
        ? "inline-flex items-center justify-center gap-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 hover:border-amber-300 hover:shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        : "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-slate-900 font-medium hover:bg-amber-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <button
      onClick={async () => {
        if (busy) return;
        setBusy(true);

        try {
          const res = await fetch("/api/cases/create", { method: "POST" });
          const json = await res.json().catch(() => ({}));

          if (!res.ok) {
            alert(json?.error || "Could not create case");
            return;
          }

          router.push(`/cases/${json.caseId}`);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className={`${styles} ${className}`}
    >
      {variant !== "card" && (
        <span className={variant === "premium" ? "text-base leading-none" : "text-lg leading-none"}>+</span>
      )}
      {busy ? "Creating…" : displayLabel}
    </button>
  );
}
