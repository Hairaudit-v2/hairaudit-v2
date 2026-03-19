"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

function isValidCaseId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export default function CreateCaseButton({
  variant = "default",
  className = "",
  label,
  dashboardHref = "/dashboard/patient",
}: {
  variant?: "default" | "premium" | "card";
  className?: string;
  /** Override button label (e.g. "Start New Audit"). */
  label?: string;
  /** Dashboard link for recovery message (e.g. /dashboard/patient, /dashboard/doctor). */
  dashboardHref?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const defaultLabels: Record<string, string> = {
    default: t("dashboard.shared.createCaseDefault"),
    premium: t("dashboard.shared.createCaseDefault"),
    card: t("dashboard.shared.startNewAudit"),
  };
  const displayLabel = label ?? defaultLabels[variant] ?? defaultLabels.default;

  const styles =
    variant === "premium"
      ? "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      : variant === "card"
        ? "inline-flex items-center justify-center gap-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 hover:border-amber-300 hover:shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        : "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-slate-900 font-medium hover:bg-amber-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

  const runCreate = async () => {
    if (busy) return;
    setBusy(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/cases/create", { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = typeof json?.error === "string" ? json.error : "Could not create case";
        setCreateError(message);
        return;
      }

      const caseId = json?.caseId;
      if (!isValidCaseId(caseId)) {
        setCreateError("New case could not be opened. Please try again or go to your dashboard.");
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.info("[CreateCaseButton] redirect target id", { caseId });
      }
      router.push(`/cases/${caseId}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (createError) {
    return (
      <div className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm ${className}`}>
        <p className="font-medium text-amber-900">{createError}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              runCreate();
            }}
            disabled={busy}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-60"
          >
            Try again
          </button>
          <Link
            href={dashboardHref}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={runCreate}
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
