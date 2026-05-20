import Link from "next/link";
import type { FacultyReadinessSignal } from "@/lib/academy/trainingCaseReviews";
import type { TraineeSurgicalProgressDashboard } from "@/lib/academy/trainingCaseReviews/dashboard";
import FacultyFeedbackSnapshot from "./FacultyFeedbackSnapshot";
import ImprovementTrendSummary from "./ImprovementTrendSummary";
import SurgicalSkillProgressGrid from "./SurgicalSkillProgressGrid";
import TraineeProgressHero from "./TraineeProgressHero";
import TraineeStrengthsAndFocusAreas from "./TraineeStrengthsAndFocusAreas";
import TrainingCaseReviewTimeline from "./TrainingCaseReviewTimeline";
import TrainingCaseReviewSummaryCard from "@/components/academy/training-case-reviews/TrainingCaseReviewSummaryCard";
import { computeOverallTrainingProgressFromReviews } from "@/lib/academy/trainingCaseReviews/dashboard";

export type TraineeSurgicalProgressSectionProps = {
  traineeName: string;
  programName: string | null;
  cohortLabel: string | null;
  siteLabel: string | null;
  currentStage: string;
  competencyWeek: number | null;
  progress: TraineeSurgicalProgressDashboard;
  isStaff?: boolean;
  doctorId?: string;
  facultyReadiness?: FacultyReadinessSignal;
};

export default function TraineeSurgicalProgressSection({
  traineeName,
  programName,
  cohortLabel,
  siteLabel,
  currentStage,
  competencyWeek,
  progress,
  isStaff,
  doctorId,
  facultyReadiness,
}: TraineeSurgicalProgressSectionProps) {
  const overallProgressPct = computeOverallTrainingProgressFromReviews(progress.reviewCount, progress.skillProgress);
  const readiness = facultyReadiness ?? progress.facultyReadiness;

  const latestCaseHref = progress.latestReview?.training_case_id
    ? `/academy/training-cases/${progress.latestReview.training_case_id}?reviewId=${progress.latestReview.id}`
    : "/academy/training-cases";

  return (
    <div className="space-y-10">
      <TraineeProgressHero
        traineeName={traineeName}
        programName={programName}
        cohortLabel={cohortLabel}
        siteLabel={siteLabel}
        currentStage={currentStage}
        competencyWeek={competencyWeek}
        progress={progress}
        overallProgressPct={overallProgressPct}
      />

      {isStaff && doctorId ? (
        <section className="rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-50/80 via-white to-white p-6 shadow-sm ring-1 ring-violet-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-800">Faculty / admin view</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Trainee development overview</h2>
              <p className="mt-1 text-sm text-slate-600">{readiness.message}</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Link
                href={`/academy/training-cases`}
                className="inline-flex rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Create training case review
              </Link>
              <Link href={`/academy/trainees/${doctorId}`} className="text-sm font-semibold text-violet-800 hover:underline">
                View full trainee profile →
              </Link>
            </div>
          </div>
          {readiness.showSignOffConsideration ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-900">Competency sign-off consideration</p>
              <p className="mt-1 text-sm text-emerald-950">
                Potentially ready for faculty sign-off review — this is a readiness signal only, not automatic certification.
              </p>
            </div>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ThemeList title="Repeated strengths" items={readiness.repeatedStrengths} empty="None identified yet." />
            <ThemeList title="Repeated concerns" items={readiness.repeatedConcerns} empty="None identified yet." tone="amber" />
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard kicker="Submitted reviews" value={progress.reviewCount} sub="Training Case Reviews on file" />
        <MetricCard
          kicker="Latest developmental level"
          value={progress.latestOverallLevelLabel ?? "—"}
          sub="From most recent submitted review"
        />
        <MetricCard kicker="Strength domains" value={progress.currentStrengths.length} sub="Highlighted from recent reviews" />
        <MetricCard kicker="Focus areas" value={progress.recommendedNextFocus.length} sub="Faculty-guided next steps" />
      </section>

      {progress.latestReview ? (
        <TrainingCaseReviewSummaryCard review={progress.latestReview} caseHref={latestCaseHref} />
      ) : null}

      <TraineeStrengthsAndFocusAreas strengths={progress.currentStrengths} nextFocus={progress.recommendedNextFocus} />

      <FacultyFeedbackSnapshot review={progress.latestReview} caseHref={latestCaseHref} />

      <SurgicalSkillProgressGrid skills={progress.skillProgress} />

      <TrainingCaseReviewTimeline entries={progress.timeline} isStaff={isStaff} />

      <ImprovementTrendSummary trend={progress.improvementTrend} />
    </div>
  );
}

function MetricCard({ kicker, value, sub }: { kicker: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{kicker}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function ThemeList({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone?: "amber" }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone === "amber" ? "border-amber-100 bg-amber-50/50" : "border-slate-100 bg-slate-50/80"}`}>
      <p className="text-[10px] font-semibold uppercase text-slate-600">{title}</p>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-800">
          {items.map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-500">{empty}</p>
      )}
    </div>
  );
}
