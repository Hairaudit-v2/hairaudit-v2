"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  filterAndSortPatientSafeSummaryQueue,
  type PatientSafeSummaryTranslationQueueItem,
  type PatientSafeSummaryTranslationQueueStatus,
} from "@/lib/reports/patientSafeSummaryTranslationQueue";

function statusLabel(status: PatientSafeSummaryTranslationQueueStatus): string {
  if (status === "missing_translation") return "Missing translation";
  if (status === "generated_unreviewed") return "Generated, unreviewed";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Stale";
}

export default function PatientSafeSummaryTranslationQueuePanel({ items }: { items: PatientSafeSummaryTranslationQueueItem[] }) {
  const [status, setStatus] = useState<"all" | PatientSafeSummaryTranslationQueueStatus>("all");
  const [review, setReview] = useState<"all" | "not_available" | "not_reviewed" | "review_required" | "approved" | "rejected">("all");
  const [freshness, setFreshness] = useState<"all" | "current" | "stale">("all");
  const [sort, setSort] = useState<"updated_desc" | "updated_asc">("updated_desc");

  const rows = useMemo(
    () => filterAndSortPatientSafeSummaryQueue(items, { status, review, freshness, sort }),
    [items, status, review, freshness, sort]
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Patient-safe Summary Translation Queue</h2>
          <p className="text-sm text-slate-500">Pilot-only queue for Spanish summary translation review and freshness follow-up.</p>
        </div>
        <div className="text-xs text-slate-600">Items: {rows.length}</div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <select className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">Status: all</option>
          <option value="missing_translation">Missing translation</option>
          <option value="generated_unreviewed">Generated unreviewed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="stale">Stale</option>
        </select>
        <select className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value={review} onChange={(e) => setReview(e.target.value as typeof review)}>
          <option value="all">Review: all</option>
          <option value="not_available">not_available</option>
          <option value="not_reviewed">not_reviewed</option>
          <option value="review_required">review_required</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
        <select className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value={freshness} onChange={(e) => setFreshness(e.target.value as typeof freshness)}>
          <option value="all">Freshness: all</option>
          <option value="current">Current only</option>
          <option value="stale">Stale only</option>
        </select>
        <select className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="updated_desc">Recently updated first</option>
          <option value="updated_asc">Oldest updated first</option>
        </select>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2">Case</th>
              <th className="px-2 py-2">Locale</th>
              <th className="px-2 py-2">Queue status</th>
              <th className="px-2 py-2">Review</th>
              <th className="px-2 py-2">Fallback</th>
              <th className="px-2 py-2">Updated</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-5 text-sm text-slate-500">No queue items match current filters.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.caseId}-${row.reportId}`} className="border-b border-slate-100 text-sm text-slate-800">
                  <td className="px-2 py-2">
                    <div className="font-medium">{row.caseTitle}</div>
                    <div className="text-xs text-slate-500">{row.caseId.slice(0, 8)}… · v{row.reportVersion}</div>
                  </td>
                  <td className="px-2 py-2">{row.targetLocale}</td>
                  <td className="px-2 py-2">{statusLabel(row.status)}</td>
                  <td className="px-2 py-2">{row.reviewStatus}</td>
                  <td className="px-2 py-2">{row.fallbackCurrentlyEnglish ? "English source" : "Translated summary"}</td>
                  <td className="px-2 py-2">{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}</td>
                  <td className="px-2 py-2">
                    <Link
                      href={`/cases/${row.caseId}`}
                      className="inline-flex rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Open case ops
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

