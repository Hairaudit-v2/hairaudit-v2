"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateCaseButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-slate-900 font-medium hover:bg-amber-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span className="text-lg leading-none">+</span>
      {busy ? "Creating…" : "Create new audit case"}
    </button>
  );
}
