import Link from "next/link";
import type { FacultyReadinessSignal } from "@/lib/academy/trainingCaseReviews";
import type { TraineeSurgicalProgressDashboard } from "@/lib/academy/trainingCaseReviews/dashboard";
import FacultyFeedbackSnapshot from "./FacultyFeedbackSnapshot";
import SurgicalSkillProgressGrid from "./SurgicalSkillProgressGrid";
import TraineeProgressHero from "./TraineeProgressHero";
import TraineeStrengthsAndFocusAreas from "./TraineeStrengthsAndFocusAreas";
import TrainingCaseReviewTimeline from "./TrainingCaseReviewTimeline";
import WhereYouAreImproving from "./WhereYouAreImproving";
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

  if (progress.reviewCount === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-emerald-300/80 bg-gradient-to-br from-emerald-50/40 via-white to-white px-6 py-10 text-center shadow-sm ring-1 ring-emerald-100">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">Your surgical progress over time</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Training Case Review progress</h2>
        <p className="mt-3 text-sm text-slate-600 max-w-lg mx-auto">
          Once your faculty submits your first Training Case Review, your progress trends will appear here — including
          skill trends, case timeline, strengths, and recommended next focus.
        </p>
        <Link href="/academy/training-cases" className="mt-5 inline-flex text-sm font-semibold text-amber-800 hover:underline">
          View training cases →
        </Link>
      </section>
    );
  }

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
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Supervisor development summary</h2>
              <p className="mt-1 text-sm text-slate-600">{readiness.message}</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Link
                href="/academy/training-cases"
                className="inline-flex rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Training case reviews
              </Link>
              <Link href={`/academy/trainees/${doctorId}`} className="text-sm font-semibold text-violet-800 hover:underline">
                View full trainee profile →
              </Link>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StaffMetric label="Submitted reviews" value={String(readiness.submittedReviewCount)} />
            <StaffMetric label="Latest overall level" value={progress.latestOverallLevelLabel ?? "—"} />
            <StaffMetric
              label="Readiness signal"
              value={readiness.showSignOffConsideration ? "Consider sign-off review" : "Continue case reviews"}
            />
          </div>
          {readiness.showSignOffConsideration ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-900">Potentially ready for faculty sign-off review</p>
              <p className="mt-1 text-sm text-emerald-950">
                This is a readiness signal only — not automatic certification or competency status change.
              </p>
            </div>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ThemeList title="Repeated strengths" items={readiness.repeatedStrengths} empty="None identified yet." />
            <ThemeList title="Repeated focus areas" items={readiness.repeatedConcerns} empty="None identified yet." tone="amber" />
          </div>
        </section>
      ) : null}

      <WhereYouAreImproving trend={progress.improvementTrend} reviewCount={progress.reviewCount} />

      <SurgicalSkillProgressGrid skills={progress.skillProgress} />

      <TrainingCaseReviewTimeline entries={progress.timeline} isStaff={isStaff} />

      <TraineeStrengthsAndFocusAreas
        strengths={progress.currentStrengths}
        nextFocus={progress.recommendedNextFocus}
        repeatedFocusAreas={progress.repeatedFocusAreas}
      />

      <FacultyFeedbackSnapshot review={progress.latestReview} caseHref={latestCaseHref} />
    </div>
  );
}

function StaffMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-white/80 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
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
