"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AcademyNewSiteForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ops, setOps] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/academy/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
          ops_notification_email: ops.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      router.push(`/academy/sites/${j.site.id}`);
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 max-w-2xl">
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-slate-600">Name *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600">Slug * (url-safe)</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. evolved-london"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600">Ops notification email</label>
        <input
          type="email"
          value={ops}
          onChange={(e) => setOps(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create site"}
        </button>
        {msg ? <p className="mt-2 text-sm text-red-700">{msg}</p> : null}
      </div>
    </form>
  );
}
