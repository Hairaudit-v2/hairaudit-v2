"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartSurgeryUploadButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/surgery-upload/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.caseId) {
        throw new Error(json?.error ?? "Could not start a new surgery upload");
      }
      router.push(`/dashboard/surgery-upload/${json.caseId}`);
    } catch (e) {
      setError((e as Error)?.message ?? "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-4 text-base font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? "Starting…" : "+ Start new surgery upload"}
      </button>
      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
