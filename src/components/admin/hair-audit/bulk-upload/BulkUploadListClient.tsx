"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HairAuditCaseBatchRow } from "@/lib/hair-audit/bulkUpload/types";

function statusChip(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-slate-700 text-slate-200",
    in_progress: "bg-cyan-900/50 text-cyan-200",
    ready_for_review: "bg-emerald-900/50 text-emerald-200",
    archived: "bg-slate-800 text-slate-400",
  };
  return styles[status] ?? styles.draft;
}

export default function BulkUploadListClient({ initialBatches }: { initialBatches: HairAuditCaseBatchRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createBatch() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/hair-audit/bulk-upload/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_name: `Batch ${new Date().toLocaleDateString()}` }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not create batch");
      router.push(`/admin/hair-audit/bulk-upload/${j.batch.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create batch");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">HairAudit Bulk Case Upload</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Intake many surgical photo sets at once with shared metadata. Cases can stay draft until required fields
            and images are assigned.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createBatch()}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {busy ? "Creating…" : "New bulk batch"}
        </button>
      </div>

      {error ? <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/60">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Batch</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {initialBatches.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No batches yet. Create one to start intake.
                </td>
              </tr>
            ) : (
              initialBatches.map((batch) => (
                <tr key={batch.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-slate-100">{batch.batch_name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusChip(batch.status)}`}>
                      {batch.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(batch.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/hair-audit/bulk-upload/${batch.id}`}
                      className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
