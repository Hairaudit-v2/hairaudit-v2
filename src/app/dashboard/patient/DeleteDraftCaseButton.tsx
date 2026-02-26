"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteDraftCaseButton({
  caseId,
  caseTitle,
  className = "",
}: {
  caseId: string;
  caseTitle?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;

        const ok = window.confirm(
          `Delete this draft audit${caseTitle ? ` (“${caseTitle}”)` : ""}?\n\nThis will remove its answers, photos, and saved progress.`
        );
        if (!ok) return;

        setBusy(true);
        try {
          const res = await fetch(`/api/cases/delete?caseId=${encodeURIComponent(caseId)}`, { method: "DELETE" });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            alert(json?.error || "Could not delete draft");
            return;
          }
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className={
        "inline-flex items-center justify-center rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-300/15 disabled:opacity-60 disabled:cursor-not-allowed transition-colors " +
        className
      }
      aria-label="Delete draft audit"
    >
      {busy ? "Deleting…" : "Delete draft"}
    </button>
  );
}

