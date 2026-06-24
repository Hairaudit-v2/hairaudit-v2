"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import AuditKpiCards from "@/components/dashboard/AuditKpiCards";
import AuditVolumeChart from "@/components/dashboard/AuditVolumeChart";
import AuditStatusChart from "@/components/dashboard/AuditStatusChart";
import AuditPriorityChart from "@/components/dashboard/AuditPriorityChart";
import OperationalAuditsTable from "@/components/dashboard/OperationalAuditsTable";
import PatientSafeSummaryTranslationQueuePanel from "@/components/dashboard/PatientSafeSummaryTranslationQueuePanel";
import BulkUploadDashboardCard from "@/components/admin/hair-audit/BulkUploadDashboardCard";
import type {
  AuditKpi,
  AuditPriorityBreakdown,
  AuditStatusBreakdown,
  AuditVolumePoint,
  DashboardRange,
  RecentOperationalAudits,
} from "@/lib/dashboard/auditOperations";
import type { PatientSafeSummaryTranslationQueueItem } from "@/lib/reports/patientSafeSummaryTranslationQueue";

type AnalyticsPayload = {
  ok: boolean;
  range: DashboardRange;
  contributionRequestsWaiting: number;
  kpis: AuditKpi;
  volumeSeries: AuditVolumePoint[];
  statusBreakdown: AuditStatusBreakdown;
  priorityBreakdown: AuditPriorityBreakdown;
  operationalAudits: RecentOperationalAudits;
  translationQueueItems: PatientSafeSummaryTranslationQueueItem[];
};

export default function AuditorOperationsAnalytics() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<DashboardRange>("7d");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async (selectedRange: DashboardRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auditor/dashboard/analytics?range=${selectedRange}`);
      const json = (await res.json()) as AnalyticsPayload & { error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load analytics");
      setData(json);
      setRange(selectedRange);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !data && !loading) {
      void loadAnalytics(range);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-100 rounded-xl"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-800">Operations Analytics</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Volume trends, translation queue, contribution requests, and historical audit data
          </p>
        </div>
        <span className="text-sm text-slate-600">{expanded ? "▲ Hide" : "▼ Show"}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 p-4 space-y-6">
          {loading && !data && (
            <p className="text-sm text-slate-500 text-center py-8">Loading analytics…</p>
          )}
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          )}
          {data && (
            <>
              <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Contribution Requests</h3>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {data.contributionRequestsWaiting === 0
                        ? "No requests waiting for clinic/doctor response."
                        : `${data.contributionRequestsWaiting} request${data.contributionRequestsWaiting === 1 ? "" : "s"} waiting to be completed.`}
                    </p>
                  </div>
                  <Link
                    href="/admin/contribution-requests"
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200"
                  >
                    Contribution Requests
                    {data.contributionRequestsWaiting > 0 && (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                        {data.contributionRequestsWaiting}
                      </span>
                    )}
                    →
                  </Link>
                </div>
              </section>

              <BulkUploadDashboardCard />

              <section className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Mobile Surgery Uploads</h3>
                    <p className="mt-0.5 text-sm text-slate-600">Review submitted surgery uploads from clinics and doctors.</p>
                  </div>
                  <Link
                    href="/dashboard/surgery-upload"
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-400 bg-cyan-100 px-4 py-2 text-sm font-medium text-cyan-900 hover:bg-cyan-200"
                  >
                    Mobile Surgery Uploads →
                  </Link>
                </div>
              </section>

              <div className="flex flex-wrap items-center gap-2">
                {(["today", "7d", "30d", "90d"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={loading}
                    onClick={() => void loadAnalytics(key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      range === key
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    } disabled:opacity-60`}
                  >
                    {key}
                  </button>
                ))}
              </div>

              <AuditKpiCards kpis={data.kpis} />

              <div className="grid gap-4 lg:grid-cols-2">
                <AuditVolumeChart points={data.volumeSeries} />
                <div className="space-y-4">
                  <AuditStatusChart breakdown={data.statusBreakdown} />
                  <AuditPriorityChart breakdown={data.priorityBreakdown} />
                </div>
              </div>

              <div className="space-y-4">
                <OperationalAuditsTable title="Recent Audits" rows={data.operationalAudits.recentAudits} />
                <OperationalAuditsTable title="Audits Needing Manual Input" rows={data.operationalAudits.manualInputAudits} />
                <OperationalAuditsTable title="Stuck / Failed Audits" rows={data.operationalAudits.stuckOrFailedAudits} />
              </div>

              <PatientSafeSummaryTranslationQueuePanel items={data.translationQueueItems} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
