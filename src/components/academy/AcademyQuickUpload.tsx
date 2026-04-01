"use client";

import { useState } from "react";
import { ACADEMY_OPTIONAL_PHOTO_CATEGORIES, ACADEMY_REQUIRED_PHOTO_CATEGORIES } from "@/lib/academy/constants";

export default function AcademyQuickUpload({
  caseId,
  onUploaded,
}: {
  caseId: string;
  onUploaded?: () => void;
}) {
  const [category, setCategory] = useState<string>("preop_front");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("caseId", caseId);
      fd.set("category", category);
      fd.append("files[]", file);
      const res = await fetch("/api/academy/uploads", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Upload failed");
      setMsg("Saved");
      onUploaded?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="text-xs font-semibold text-slate-700">Quick upload</div>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-slate-300 text-sm px-2 py-1.5 max-w-[200px]"
          disabled={busy}
        >
          <optgroup label="Required">
            {ACADEMY_REQUIRED_PHOTO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </optgroup>
          <optgroup label="Optional">
            {ACADEMY_OPTIONAL_PHOTO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </optgroup>
        </select>
        <label className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white cursor-pointer hover:bg-amber-700 disabled:opacity-50">
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={onFile} />
          {busy ? "Uploading…" : "Choose photo"}
        </label>
      </div>
      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
    </div>
  );
}
