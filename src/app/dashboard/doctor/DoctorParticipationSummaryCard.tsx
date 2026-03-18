"use client";

import Link from "next/link";
import CreateCaseButton from "../create-case-button";
import type { ParticipationApprovalStatus } from "@/components/dashboard/ParticipationStatusBanner";

export type ParticipationSummary = {
  casesSubmittedCount: number;
  reportsCompletedCount: number;
  benchmarkReadyCount: number;
};

const PARTICIPATION_LABELS: Record<ParticipationApprovalStatus, string> = {
  not_started: "Application not started",
  pending_review: "Pending review",
  approved: "Approved",
  more_info_required: "More information required",
};

type DoctorParticipationSummaryCardProps = {
  participationSummary: ParticipationSummary;
  participationApprovalStatus: ParticipationApprovalStatus;
  /** Optional future slot for a computed score or ranking; not rendered if null */
  scoreOrRankingSlot?: React.ReactNode;
};

export default function DoctorParticipationSummaryCard({
  participationSummary,
  participationApprovalStatus,
  scoreOrRankingSlot,
}: DoctorParticipationSummaryCardProps) {
  const { casesSubmittedCount, reportsCompletedCount, benchmarkReadyCount } = participationSummary;
  const participationLabel = PARTICIPATION_LABELS[participationApprovalStatus];
  const isContributing = reportsCompletedCount > 0;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-label="Your participation summary"
    >
      <h2 className="text-base font-semibold text-slate-900">Your participation summary</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Audit activity and participation at a glance.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs font-medium text-slate-500">Total cases submitted</dt>
          <dd className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">
            {casesSubmittedCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Completed reports</dt>
          <dd className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">
            {reportsCompletedCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Participation</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-700">
            {participationLabel}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Benchmark-ready cases</dt>
          <dd className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">
            {benchmarkReadyCount}
          </dd>
        </div>
      </dl>

      {isContributing && (
        <p className="mt-4 rounded-lg border border-cyan-100 bg-cyan-50/80 px-3 py-2 text-sm text-cyan-800">
          Your submissions contribute to global benchmarking and outcome analysis.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <CreateCaseButton variant="premium" label="Submit another case" dashboardHref="/dashboard/doctor" />
        <Link
          href="#your-cases"
          className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          View your cases
        </Link>
      </div>

      {scoreOrRankingSlot != null && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {scoreOrRankingSlot}
        </div>
      )}
    </section>
  );
}
