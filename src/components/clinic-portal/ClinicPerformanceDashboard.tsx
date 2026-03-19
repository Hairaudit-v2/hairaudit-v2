/**
 * Read-only Clinic Performance Dashboard.
 * Shows total cases, average score, donor management, graft survival (if available), and private vs public case counts.
 */

import CertificationBadge from "@/components/clinic-profile/CertificationBadge";

type ClinicPerformanceDashboardProps = {
  totalCases: number;
  completedCases: number;
  averageScore: number | null;
  documentationIntegrityAverage: number | null;
  donorManagementScore: number | null;
  graftSurvivalIndicator: string | null;
  publicCaseCount: number;
  privateCaseCount: number;
  /** Current award tier for certification badge (UI only) */
  currentAwardTier?: string | null;
};

function StatCard({
  label,
  value,
  sub,
  placeholder,
}: {
  label: string;
  value: string | number;
  sub?: string;
  placeholder?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">
        {placeholder ? "—" : value}
      </div>
      {sub != null && sub !== "" && (
        <div className="mt-1 text-xs text-slate-500">{sub}</div>
      )}
    </div>
  );
}

export default function ClinicPerformanceDashboard({
  totalCases,
  completedCases,
  averageScore,
  documentationIntegrityAverage,
  donorManagementScore,
  graftSurvivalIndicator,
  publicCaseCount,
  privateCaseCount,
  currentAwardTier,
}: ClinicPerformanceDashboardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Clinic Performance Dashboard
        </h2>
        {currentAwardTier && (
          <div>
            <CertificationBadge tier={currentAwardTier} variant="full" />
            <p className="mt-2 text-xs text-slate-500 max-w-xs">
              Based on independently audited surgical data and verified case submissions.
            </p>
          </div>
        )}
      </div>
      <p className="text-sm text-slate-600 mb-6">
        Read-only overview of your submitted cases and aggregate metrics. Public cases contribute to rankings; private cases are for internal use only.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Total cases submitted"
          value={totalCases}
          sub={`${completedCases} completed`}
          placeholder={false}
        />
        <StatCard
          label="Average score"
          value={averageScore != null && averageScore > 0 ? averageScore.toFixed(1) : "—"}
          placeholder={averageScore == null || averageScore === 0}
        />
        <StatCard
          label="Donor management score"
          value={
            donorManagementScore != null && donorManagementScore > 0
              ? donorManagementScore.toFixed(1)
              : documentationIntegrityAverage != null && documentationIntegrityAverage > 0
                ? `${documentationIntegrityAverage.toFixed(1)} (doc. integrity)`
                : "—"
          }
          placeholder={
            (donorManagementScore == null || donorManagementScore === 0) &&
            (documentationIntegrityAverage == null || documentationIntegrityAverage === 0)
          }
        />
        <StatCard
          label="Graft survival indicator"
          value={graftSurvivalIndicator ?? "—"}
          placeholder={!graftSurvivalIndicator}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
          Case visibility
        </div>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full bg-slate-400"
              aria-hidden
            />
            <span className="text-sm font-medium text-slate-700">Private (Internal Audit)</span>
            <span className="text-sm text-slate-500">{privateCaseCount} cases</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full bg-cyan-500"
              aria-hidden
            />
            <span className="text-sm font-medium text-slate-700">Public (Verified Public Audit)</span>
            <span className="text-sm text-slate-500">{publicCaseCount} cases</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Only verified public cases are visible on your profile and contribute to leaderboards.
        </p>
      </div>
    </section>
  );
}
