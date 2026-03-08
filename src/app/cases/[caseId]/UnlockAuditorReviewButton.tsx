"use client";

import { useState } from "react";

export default function UnlockAuditorReviewButton({ reportId }: { reportId: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="mt-4 rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-3">
      <p className="text-sm text-slate-300">This case is in the normal score range (60–90). Manual auditor review is not required.</p>
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const res = await fetch("/api/auditor/unlock-review", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reportId }),
            });
            const json = await res.json();
            if (json.ok) window.location.reload();
            else alert(json.error ?? "Failed");
          } catch (e) {
            alert((e as Error)?.message ?? "Failed");
          } finally {
            setLoading(false);
          }
        }}
        className="mt-2 text-sm font-medium text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
      >
        {loading ? "Unlocking…" : "Unlock auditor review for this report"}
      </button>
    </div>
  );
}
