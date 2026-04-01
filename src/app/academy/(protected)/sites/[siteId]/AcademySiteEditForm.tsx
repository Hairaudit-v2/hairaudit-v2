"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AcademySiteRow } from "@/lib/academy/academySites";

export default function AcademySiteEditForm({ site }: { site: AcademySiteRow }) {
  const router = useRouter();
  const [fields, setFields] = useState({
    name: site.name,
    slug: site.slug,
    display_name: site.display_name ?? "",
    ops_notification_email: site.ops_notification_email ?? "",
    general_contact_email: site.general_contact_email ?? "",
    phone: site.phone ?? "",
    country: site.country ?? "",
    timezone: site.timezone ?? "",
    is_active: site.is_active,
    notes: site.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/academy/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.name,
          slug: fields.slug,
          display_name: fields.display_name.trim() || null,
          ops_notification_email: fields.ops_notification_email.trim() || null,
          general_contact_email: fields.general_contact_email.trim() || null,
          phone: fields.phone.trim() || null,
          country: fields.country.trim() || null,
          timezone: fields.timezone.trim() || null,
          is_active: fields.is_active,
          notes: fields.notes.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      router.refresh();
      setMsg("Saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">Site details</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-600">Name</label>
          <input
            value={fields.name}
            onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Slug</label>
          <input
            value={fields.slug}
            onChange={(e) => setFields((f) => ({ ...f, slug: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-xs"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-slate-600">Display name</label>
          <input
            value={fields.display_name}
            onChange={(e) => setFields((f) => ({ ...f, display_name: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-slate-600">
            Ops notification email <span className="text-amber-800">(roster requests)</span>
          </label>
          <input
            type="email"
            value={fields.ops_notification_email}
            onChange={(e) => setFields((f) => ({ ...f, ops_notification_email: e.target.value }))}
            placeholder="Leave empty to use ACADEMY_OPS_NOTIFICATION_EMAIL when this site is selected"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">General contact email</label>
          <input
            type="email"
            value={fields.general_contact_email}
            onChange={(e) => setFields((f) => ({ ...f, general_contact_email: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Phone</label>
          <input
            value={fields.phone}
            onChange={(e) => setFields((f) => ({ ...f, phone: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Country</label>
          <input
            value={fields.country}
            onChange={(e) => setFields((f) => ({ ...f, country: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Timezone</label>
          <input
            value={fields.timezone}
            onChange={(e) => setFields((f) => ({ ...f, timezone: e.target.value }))}
            placeholder="e.g. Europe/London"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            checked={fields.is_active}
            onChange={(e) => setFields((f) => ({ ...f, is_active: e.target.checked }))}
          />
          <label htmlFor="is_active" className="text-sm text-slate-700">
            Active
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-slate-600">Notes</label>
          <textarea
            value={fields.notes}
            onChange={(e) => setFields((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save changes"}
      </button>
      {msg ? <p className="text-sm text-slate-600">{msg}</p> : null}
    </form>
  );
}
