"use client";

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

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-label="Your participation summary"
    >
      <h2 className="text-base font-semibold text-slate-900">Your participation summary</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Audit activity and participation at a glance. No score is shown until a ranking model is available.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs font-medium text-slate-500">Cases submitted</dt>
          <dd className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">
            {casesSubmittedCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Reports completed</dt>
          <dd className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">
            {reportsCompletedCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Participation status</dt>
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

      {scoreOrRankingSlot != null && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {scoreOrRankingSlot}
        </div>
      )}
    </section>
  );
}
