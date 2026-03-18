"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AuditMode = "internal" | "public";

const LABELS: Record<AuditMode, string> = {
  internal: "Internal Audit",
  public: "Verified Public Audit",
};

const DESCRIPTIONS: Record<AuditMode, string> = {
  internal: "Private, not public, not ranked",
  public: "Visible, contributes to rankings",
};

type CaseAuditModeSelectProps = {
  caseId: string;
  currentMode: AuditMode;
  disabled?: boolean;
};

export default function CaseAuditModeSelect({
  caseId,
  currentMode,
  disabled = false,
}: CaseAuditModeSelectProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuditMode>(currentMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (newMode: AuditMode) => {
    if (newMode === mode || loading || disabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic-portal/cases/audit-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, auditMode: newMode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to update");
        return;
      }
      setMode(newMode);
      router.refresh();
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">Audit mode:</span>
      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {(["internal", "public"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleChange(m)}
            disabled={loading || disabled}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              mode === m
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            } ${loading || disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            title={DESCRIPTIONS[m]}
          >
            {LABELS[m]}
          </button>
        ))}
      </div>
      {loading && <span className="text-xs text-slate-400">Updating…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export { LABELS as AUDIT_MODE_LABELS, DESCRIPTIONS as AUDIT_MODE_DESCRIPTIONS };
