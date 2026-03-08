"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ContributionRequestWithRelations } from "../page";

type Metrics = {
  total: number;
  awaitingResponse: number;
  viewed: number;
  contributionReceived: number;
  benchmarkEligible: number;
  expiredClosed: number;
};

const STATUS_LABELS: Record<string, string> = {
  clinic_request_pending: "Pending",
  clinic_request_sent: "Sent",
  clinic_viewed_request: "Viewed",
  doctor_contribution_started: "Started",
  doctor_contribution_received: "Received",
  benchmark_recalculated: "Benchmark",
  benchmark_eligible: "Eligible",
  request_closed: "Closed",
  request_expired: "Expired",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  clinic_request_pending: "border-amber-300/40 bg-amber-300/15 text-amber-200",
  clinic_request_sent: "border-cyan-300/40 bg-cyan-300/15 text-cyan-200",
  clinic_viewed_request: "border-blue-300/40 bg-blue-300/15 text-blue-200",
  doctor_contribution_started: "border-indigo-300/40 bg-indigo-300/15 text-indigo-200",
  doctor_contribution_received: "border-emerald-300/40 bg-emerald-300/15 text-emerald-200",
  benchmark_recalculated: "border-lime-300/40 bg-lime-300/15 text-lime-200",
  benchmark_eligible: "border-emerald-400/50 bg-emerald-400/20 text-emerald-100",
  request_closed: "border-slate-400/40 bg-slate-400/15 text-slate-200",
  request_expired: "border-rose-300/40 bg-rose-300/15 text-rose-200",
};

function statusBadge(status: string | null) {
  const s = String(status ?? "").replaceAll("_", " ");
  const cls = STATUS_BADGE_CLASS[status ?? ""] ?? "border-slate-400/30 bg-slate-400/10 text-slate-300";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {STATUS_LABELS[status ?? ""] ?? s}
    </span>
  );
}

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleString();
  } catch {
    return "—";
  }
}

const PAGE_SIZE = 25;

export default function ContributionRequestsClient({
  requests,
  metrics,
}: {
  requests: ContributionRequestWithRelations[];
  metrics: Metrics;
}) {
  const [statusFilter, setStatusFilter] = useState("");
  const [clinicFilter, setClinicFilter] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [benchmarkFilter, setBenchmarkFilter] = useState<"" | "yes" | "no">("");
  const [reminderFilter, setReminderFilter] = useState("");
  const [contribFilter, setContribFilter] = useState<"" | "yes" | "no">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailRequest, setDetailRequest] = useState<ContributionRequestWithRelations | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = [...requests];
    if (statusFilter) list = list.filter((r) => String(r.status ?? "") === statusFilter);
    if (clinicFilter) {
      const q = clinicFilter.toLowerCase();
      list = list.filter(
        (r) =>
          (r.clinic_name_snapshot ?? "").toLowerCase().includes(q) ||
          (r.clinic_profile?.clinic_name ?? "").toLowerCase().includes(q)
      );
    }
    if (doctorFilter) {
      const q = doctorFilter.toLowerCase();
      list = list.filter(
        (r) =>
          (r.doctor_name_snapshot ?? "").toLowerCase().includes(q) ||
          (r.doctor_profile?.doctor_name ?? "").toLowerCase().includes(q)
      );
    }
    if (benchmarkFilter === "yes") list = list.filter((r) => r.benchmark_eligible);
    if (benchmarkFilter === "no") list = list.filter((r) => !r.benchmark_eligible);
    if (reminderFilter) {
      const n = parseInt(reminderFilter, 10);
      if (!Number.isNaN(n)) list = list.filter((r) => (r.reminder_count ?? 0) >= n);
    }
    if (contribFilter === "yes") list = list.filter((r) => !!r.contribution_received_at);
    if (contribFilter === "no") list = list.filter((r) => !r.contribution_received_at);
    if (dateFrom) {
      const t = new Date(dateFrom).getTime();
      list = list.filter((r) => new Date(r.created_at ?? 0).getTime() >= t);
    }
    if (dateTo) {
      const t = new Date(dateTo).getTime() + 86400000;
      list = list.filter((r) => new Date(r.created_at ?? 0).getTime() < t);
    }
    return list;
  }, [
    requests,
    statusFilter,
    clinicFilter,
    doctorFilter,
    benchmarkFilter,
    reminderFilter,
    contribFilter,
    dateFrom,
    dateTo,
  ]);

  const paginated = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const handleResend = async (req: ContributionRequestWithRelations, type: "reminder" | "final") => {
    const url = req.secure_contribution_path;
    if (!url) return;
    setActionLoading(`resend-${req.id}`);
    try {
      const res = await fetch("/api/case-contribution-requests/reminder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: req.id,
          reminderType: type,
          contributionUrl: url,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Resend failed");
      window.location.reload();
    } catch (e) {
      alert((e as Error)?.message ?? "Resend failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkClosed = async (req: ContributionRequestWithRelations) => {
    setActionLoading(`close-${req.id}`);
    try {
      const res = await fetch("/api/case-contribution-requests/mark-closed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: req.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Mark closed failed");
      window.location.reload();
    } catch (e) {
      alert((e as Error)?.message ?? "Mark closed failed");
    } finally {
      setActionLoading(null);
    }
  };

  const copyLink = (req: ContributionRequestWithRelations) => {
    const url = req.secure_contribution_path;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => alert("Link copied"));
  };

  const clinicName = (r: ContributionRequestWithRelations) =>
    r.clinic_name_snapshot ?? r.clinic_profile?.clinic_name ?? "—";
  const doctorName = (r: ContributionRequestWithRelations) =>
    r.doctor_name_snapshot ?? r.doctor_profile?.doctor_name ?? "—";
  const awardTier = (r: ContributionRequestWithRelations) =>
    r.clinic_profile?.current_award_tier ?? r.doctor_profile?.current_award_tier ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Clinic Contribution Requests</h1>
        <p className="mt-1 text-sm text-slate-400">
          Track lifecycle, reminders, and doctor participation across forensic audit requests.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total Requests", value: metrics.total, cls: "border-white/10 bg-white/5" },
          { label: "Awaiting Response", value: metrics.awaitingResponse, cls: "border-amber-300/25 bg-amber-300/10" },
          { label: "Viewed", value: metrics.viewed, cls: "border-blue-300/25 bg-blue-300/10" },
          { label: "Contribution Received", value: metrics.contributionReceived, cls: "border-emerald-300/25 bg-emerald-300/10" },
          { label: "Benchmark Eligible", value: metrics.benchmarkEligible, cls: "border-lime-300/25 bg-lime-300/10" },
          { label: "Expired / Closed", value: metrics.expiredClosed, cls: "border-slate-400/25 bg-slate-400/10" },
        ].map((m) => (
          <div
            key={m.label}
            className={`rounded-xl border p-3 ${m.cls}`}
          >
            <p className="text-xs uppercase tracking-wide text-slate-400">{m.label}</p>
            <p className="mt-1 text-xl font-semibold text-white">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Filters</p>
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Clinic name"
            value={clinicFilter}
            onChange={(e) => setClinicFilter(e.target.value)}
            className="w-40 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <input
            type="text"
            placeholder="Doctor name"
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="w-40 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <select
            value={benchmarkFilter}
            onChange={(e) => setBenchmarkFilter(e.target.value as "" | "yes" | "no")}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
          >
            <option value="">Benchmark: any</option>
            <option value="yes">Benchmark eligible</option>
            <option value="no">Not eligible</option>
          </select>
          <input
            type="number"
            placeholder="Min reminders"
            value={reminderFilter}
            onChange={(e) => setReminderFilter(e.target.value)}
            min={0}
            className="w-28 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <select
            value={contribFilter}
            onChange={(e) => setContribFilter(e.target.value as "" | "yes" | "no")}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
          >
            <option value="">Contribution: any</option>
            <option value="yes">Received</option>
            <option value="no">Not received</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
          />
          <button
            type="button"
            onClick={() => {
              setStatusFilter("");
              setClinicFilter("");
              setDoctorFilter("");
              setBenchmarkFilter("");
              setReminderFilter("");
              setContribFilter("");
              setDateFrom("");
              setDateTo("");
              setPage(0);
            }}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/80">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400">
              {requests.length === 0 ? "No contribution requests yet." : "No results match your filters."}
            </p>
            {(statusFilter || clinicFilter || doctorFilter || benchmarkFilter || reminderFilter || contribFilter || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("");
                  setClinicFilter("");
                  setDoctorFilter("");
                  setBenchmarkFilter("");
                  setReminderFilter("");
                  setContribFilter("");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="mt-3 text-sm text-cyan-400 hover:text-cyan-300"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-800/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Case ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Clinic</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Doctor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Initial Sent</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Last Opened</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Reminders</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Received At</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Benchmark</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Award Tier</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3">
                        <Link href={`/cases/${r.case_id}`} className="font-mono text-xs text-cyan-300 hover:text-cyan-200">
                          {r.case_id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-200">{clinicName(r)}</td>
                      <td className="px-4 py-3 text-slate-200">{doctorName(r)}</td>
                      <td className="px-4 py-3">{statusBadge(r.status)}</td>
                      <td className="px-4 py-3 text-slate-400">{fmt(r.created_at)}</td>
                      <td className="px-4 py-3 text-slate-400">{fmt(r.last_opened_at ?? r.viewed_at)}</td>
                      <td className="px-4 py-3 text-slate-300">{r.reminder_count ?? 0}</td>
                      <td className="px-4 py-3 text-slate-400">{fmt(r.contribution_received_at)}</td>
                      <td className="px-4 py-3">
                        {r.benchmark_eligible ? (
                          <span className="text-emerald-400">Yes</span>
                        ) : (
                          <span className="text-slate-500">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{awardTier(r)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailRequest(r)}
                            className="rounded px-2 py-1 text-xs text-cyan-400 hover:bg-cyan-400/20"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => copyLink(r)}
                            disabled={!r.secure_contribution_path}
                            className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/10 disabled:opacity-50"
                          >
                            Copy Link
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResend(r, "reminder")}
                            disabled={!r.secure_contribution_path || actionLoading !== null}
                            title="Send reminder 1"
                            className="rounded px-2 py-1 text-xs text-amber-400 hover:bg-amber-400/20 disabled:opacity-50"
                          >
                            Resend 1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResend(r, "final")}
                            disabled={!r.secure_contribution_path || actionLoading !== null}
                            title="Send final courtesy reminder"
                            className="rounded px-2 py-1 text-xs text-amber-500 hover:bg-amber-500/20 disabled:opacity-50"
                          >
                            Resend 2
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkClosed(r)}
                            disabled={
                              ["request_closed", "request_expired", "benchmark_eligible", "doctor_contribution_received"].includes(
                                String(r.status ?? "")
                              ) || actionLoading !== null
                            }
                            className="rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-400/20 disabled:opacity-50"
                          >
                            Close
                          </button>
                          <Link
                            href={`/cases/${r.case_id}`}
                            className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/10"
                          >
                            Case
                          </Link>
                          {r.clinic_profile_id && (
                            <Link
                              href={`/admin/clinics/${r.clinic_profile_id}`}
                              className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/10"
                            >
                              Clinic
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-2">
                <p className="text-xs text-slate-500">
                  {filtered.length} results · page {page + 1} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/10 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/10 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {detailRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDetailRequest(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/20 bg-slate-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-white">Request Details</h2>
              <button
                type="button"
                onClick={() => setDetailRequest(null)}
                className="text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="text-slate-500">Request ID</dt><dd className="font-mono text-slate-200">{detailRequest.id}</dd></div>
              <div><dt className="text-slate-500">Case ID</dt><dd className="font-mono text-slate-200">{detailRequest.case_id}</dd></div>
              <div><dt className="text-slate-500">Clinic</dt><dd className="text-slate-200">{clinicName(detailRequest)}</dd></div>
              <div><dt className="text-slate-500">Doctor</dt><dd className="text-slate-200">{doctorName(detailRequest)}</dd></div>
              <div><dt className="text-slate-500">Status</dt><dd>{statusBadge(detailRequest.status)}</dd></div>
              <div><dt className="text-slate-500">Patient consent</dt><dd className="text-slate-200">{(detailRequest.request_snapshot as Record<string, unknown>)?.patientConsent ? "Yes" : "No"}</dd></div>
              <div><dt className="text-slate-500">Clinic email</dt><dd className="text-slate-200">{detailRequest.clinic_email_snapshot ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Doctor email</dt><dd className="text-slate-200">{detailRequest.doctor_email_snapshot ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Created</dt><dd className="text-slate-200">{fmt(detailRequest.created_at)}</dd></div>
              <div><dt className="text-slate-500">Initial sent</dt><dd className="text-slate-200">{fmt(detailRequest.last_email_sent_at ?? detailRequest.created_at)}</dd></div>
              <div><dt className="text-slate-500">Reminder 1 sent</dt><dd className="text-slate-200">{fmt(detailRequest.reminder_1_sent_at)}</dd></div>
              <div><dt className="text-slate-500">Reminder 2 sent</dt><dd className="text-slate-200">{fmt(detailRequest.reminder_2_sent_at)}</dd></div>
              <div><dt className="text-slate-500">Last email sent</dt><dd className="text-slate-200">{fmt(detailRequest.last_email_sent_at)}</dd></div>
              <div><dt className="text-slate-500">Last opened</dt><dd className="text-slate-200">{fmt(detailRequest.last_opened_at ?? detailRequest.viewed_at)}</dd></div>
              <div><dt className="text-slate-500">Contribution received</dt><dd className="text-slate-200">{fmt(detailRequest.contribution_received_at)}</dd></div>
              <div><dt className="text-slate-500">Completed</dt><dd className="text-slate-200">{fmt(detailRequest.completed_at)}</dd></div>
              <div><dt className="text-slate-500">Benchmark eligible</dt><dd className="text-slate-200">{detailRequest.benchmark_eligible ? "Yes" : "No"}</dd></div>
              {detailRequest.contribution_payload && typeof detailRequest.contribution_payload === "object" && Object.keys(detailRequest.contribution_payload as object).length > 0 && (
                <div>
                  <dt className="text-slate-500">Contribution summary</dt>
                  <dd className="mt-1 rounded border border-white/10 bg-slate-800/50 p-2 font-mono text-xs text-slate-300">
                    {JSON.stringify(detailRequest.contribution_payload, null, 2).slice(0, 500)}
                    {(JSON.stringify(detailRequest.contribution_payload).length > 500) ? "…" : ""}
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/cases/${detailRequest.case_id}`}
                className="rounded-lg border border-cyan-300/40 bg-cyan-300/15 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-300/25"
              >
                Open Case
              </Link>
              <button
                type="button"
                onClick={() => copyLink(detailRequest)}
                disabled={!detailRequest.secure_contribution_path}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/15 disabled:opacity-50"
              >
                Copy Contribution Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
