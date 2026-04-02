import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess, isAcademyAdminRole } from "@/lib/academy/auth";
import {
  fetchTraineeCohortIds,
  fetchTrainingDoctorForUser,
  fetchTrainingCasesForDoctor,
} from "@/lib/academy/queries";
import {
  computeTraineeProgressSnapshot,
  domainAveragesFromAssessments,
  trendValuesFromCases,
} from "@/lib/academy/progression";
import {
  competencyWaveAnchor,
  competencyWeekDateWindow,
  currentCompetencyWeekNumber,
  groupStepsByLadder,
  suggestStepIdsFromLatestMetrics,
} from "@/lib/academy/competency";
import {
  buildReadinessSummary,
  buildStepUiByStepId,
  type CompetencyFinalReadinessStatus,
} from "@/lib/academy/competencyPhase2";
import {
  collectLadderKeysForTrainingHints,
  filterModulesForViewer,
  loadTrainingModulesCatalogMerged,
} from "@/lib/academy/trainingModulesCatalog";
import {
  buildWeekFocusBullets,
  computeTraineeTrajectoryPhase,
  countSignedTargetMilestones,
  countTargetMilestones,
  pickReviewForCompetencyWeek,
} from "@/lib/academy/traineeDashboardModel";
import type {
  TrainingCaseMetricsRow,
  TrainingCaseAssessmentRow,
  TrainingCompetencyAchievementRow,
  TrainingCompetencyLadderRow,
  TrainingCompetencyStepObservationRow,
  TrainingCompetencyStepRow,
  TrainingCompetencyStepStateRow,
  TrainingCompetencyWeeklyReviewRow,
  TrainingDoctorRow,
  TrainingStageHistoryRow,
} from "@/lib/academy/types";
import TraineeDashboardView, { type TraineeDashboardModuleRec } from "@/components/academy/trainee/TraineeDashboardView";
import { isOperationalTraineeStatus } from "@/lib/academy/traineeStatus";

export const dynamic = "force-dynamic";

function startOfMonthIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function badgeClass(badge: string) {
  switch (badge) {
    case "on_track":
      return "bg-emerald-100 text-emerald-900 ring-emerald-200";
    case "needs_support":
      return "bg-rose-100 text-rose-900 ring-rose-200";
    case "ready_for_progression":
      return "bg-sky-100 text-sky-900 ring-sky-200";
    case "review_required":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    default:
      return "bg-slate-100 text-slate-800 ring-slate-200";
  }
}

export default async function AcademyDashboardPage() {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");

  const supabase = await createSupabaseAuthServerClient();

  if (access.isStaff) {
    const [{ data: doctors }, { count: monthCases }, { data: recentReviews }] = await Promise.all([
      supabase.from("training_doctors").select("id, current_stage, status, full_name").order("created_at", { ascending: false }),
      supabase
        .from("training_cases")
        .select("id", { count: "exact", head: true })
        .gte("surgery_date", startOfMonthIsoDate()),
      supabase
        .from("training_case_assessments")
        .select("id, created_at, overall_score, ready_to_progress, training_case_id")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const list = (doctors ?? []).filter((d) => isOperationalTraineeStatus(d.status));
    const byStage = list.reduce<Record<string, number>>((acc, d) => {
      const s = d.current_stage || "unknown";
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});

    const { count: inReview } = await supabase
      .from("training_cases")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_review");

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8 pb-10">
        {isAcademyAdminRole(access.role) ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span className="font-semibold">Academy admin:</span>{" "}
            <Link href="/academy/admin" className="font-medium text-amber-900 underline hover:no-underline">
              Open admin console
            </Link>{" "}
            for programs, people, cohorts, and training library publishing.
          </div>
        ) : null}
        <div className="rounded-3xl border border-slate-700/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-7 py-7 shadow-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300">IIOHR Academy</p>
          <h1 className="mt-1 text-3xl font-semibold text-white sm:text-[2.05rem]">Academy dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-200">
            Surgical training overview, progression, and review workload at a glance.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              Program operations
            </span>
            <span className="rounded-full border border-slate-500/50 bg-slate-700/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
              Live summary
            </span>
          </div>
          <Link href="/academy/training-modules" className="mt-4 inline-flex rounded-full bg-amber-100 px-3.5 py-1.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-50">
            Training module library →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-400/70 bg-gradient-to-br from-slate-100 via-slate-50 to-white p-5 shadow-md ring-1 ring-slate-200">
            <div className="mb-3 h-1.5 w-14 rounded-full bg-slate-500/80" />
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Trainees</div>
            <div className="mt-2 text-4xl font-black text-slate-900">{list.length}</div>
          </div>
          <div className="rounded-2xl border border-amber-300/90 bg-gradient-to-br from-amber-100 via-amber-50 to-white p-5 shadow-md ring-1 ring-amber-200/80">
            <div className="mb-3 h-1.5 w-14 rounded-full bg-amber-500/90" />
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">Cases this month</div>
            <div className="mt-2 text-4xl font-black text-amber-950">{monthCases ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-orange-300/90 bg-gradient-to-br from-orange-100 via-amber-50 to-white p-5 shadow-md ring-1 ring-orange-200/80">
            <div className="mb-3 h-1.5 w-14 rounded-full bg-orange-500/90" />
            <div className="text-xs font-semibold uppercase tracking-wide text-orange-900">Cases in review</div>
            <div className="mt-2 text-4xl font-black text-orange-950">{inReview ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-sky-300/80 bg-gradient-to-br from-sky-100/90 via-sky-50 to-white p-5 shadow-md ring-1 ring-sky-200/80">
            <div className="mb-3 h-1.5 w-14 rounded-full bg-sky-500/90" />
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-900">Stages (headcount)</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {Object.keys(byStage).length === 0 ? (
                <span className="text-slate-500">No trainees yet</span>
              ) : (
                Object.entries(byStage).map(([k, v]) => (
                  <span key={k} className="rounded-full bg-white px-2.5 py-1 text-slate-800 ring-1 ring-sky-200">
                    {k}: {v}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-sky-300/90 bg-gradient-to-br from-sky-100/70 via-white to-white p-5 shadow-md">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">Assessment flow</p>
              <h2 className="text-sm font-semibold text-slate-900">Recent reviews</h2>
            </div>
            <Link href="/academy/trainees" className="text-sm font-medium text-amber-700 hover:text-amber-800">
              Trainees
            </Link>
          </div>
          {!recentReviews?.length ? (
            <p className="text-sm text-slate-500">No assessments yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentReviews.map((r) => (
                <li key={r.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 rounded-md text-sm">
                  <Link
                    href={`/academy/cases/${r.training_case_id}`}
                    className="font-medium text-amber-800 hover:underline truncate"
                  >
                    Case {String(r.training_case_id).slice(0, 8)}…
                  </Link>
                  <span className="text-slate-500">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                  </span>
                  <span className="text-slate-600">
                    Score {r.overall_score != null ? r.overall_score : "—"}{" "}
                    {r.ready_to_progress ? (
                      <span className="text-emerald-700 font-medium">· Ready</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-amber-400/80 bg-gradient-to-r from-amber-100 via-amber-50 to-orange-100/70 p-5 shadow-md">
          <h2 className="text-sm font-semibold text-amber-950">Progression alerts</h2>
          <p className="mt-1 text-sm text-amber-950/80">
            {(inReview ?? 0) > 0
              ? `${inReview} case(s) marked in review — complete trainer assessments.`
              : "No cases flagged in review. Mark cases as “in review” when ready for sign-off."}
          </p>
        </section>
      </div>
    );
  }

  // Trainee view — premium progression dashboard
  const doctorRow = await fetchTrainingDoctorForUser(supabase, access.userId);
  if (!doctorRow) {
    return (
      <div className="max-w-lg mx-auto px-4 text-center py-12">
        <p className="text-slate-700">No trainee profile is linked to your account yet.</p>
        <p className="mt-2 text-sm text-slate-500">Ask staff to set your auth user on the trainee record.</p>
      </div>
    );
  }

  const doctor = doctorRow as TrainingDoctorRow;

  const [
    cases,
    { data: cohortLinks },
    programRes,
    siteRes,
    { data: stageHistoryRows },
    { data: ladders },
    { data: allSteps },
    { data: achievements },
    { data: stateRows },
    { data: obsRows },
    { data: reviewRows },
    traineeCohortIds,
    rawModules,
  ] = await Promise.all([
    fetchTrainingCasesForDoctor(supabase, doctor.id),
    supabase.from("training_cohort_trainees").select("cohort_id").eq("training_doctor_id", doctor.id),
    doctor.program_id
      ? supabase.from("training_programs").select("name").eq("id", doctor.program_id).maybeSingle()
      : Promise.resolve({ data: null }),
    doctor.academy_site_id
      ? supabase.from("academy_sites").select("name, display_name").eq("id", doctor.academy_site_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("training_stage_history")
      .select("*")
      .eq("training_doctor_id", doctor.id)
      .order("changed_at", { ascending: false })
      .limit(24),
    supabase.from("training_competency_ladders").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("training_competency_steps").select("*").order("step_index", { ascending: true }),
    supabase
      .from("training_competency_achievements")
      .select("*")
      .eq("training_doctor_id", doctor.id)
      .order("achieved_at", { ascending: false }),
    supabase.from("training_competency_step_states").select("*").eq("training_doctor_id", doctor.id),
    supabase
      .from("training_competency_step_observations")
      .select("*")
      .eq("training_doctor_id", doctor.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_competency_weekly_reviews")
      .select("*")
      .eq("training_doctor_id", doctor.id)
      .order("week_number", { ascending: true }),
    fetchTraineeCohortIds(supabase, access.userId).catch(() => [] as string[]),
    loadTrainingModulesCatalogMerged(supabase),
  ]);

  const cohortIds = [...new Set((cohortLinks ?? []).map((r) => (r as { cohort_id: string }).cohort_id))];
  let cohortLabel: string | null = null;
  if (cohortIds.length) {
    const { data: cohorts } = await supabase.from("training_cohorts").select("name").in("id", cohortIds);
    const names = (cohorts ?? []).map((c) => (c as { name: string }).name).filter(Boolean);
    cohortLabel = names.length ? names.join(", ") : null;
  }

  const programName = programRes.data ? String((programRes.data as { name: string }).name) : null;
  const siteRow = siteRes.data as { name: string; display_name: string | null } | null;
  const siteLabel = siteRow ? (siteRow.display_name?.trim() || siteRow.name) : null;

  const caseIds = cases.map((c) => c.id);
  let metricsByCaseId = new Map<string, TrainingCaseMetricsRow>();
  let assessments: TrainingCaseAssessmentRow[] = [];
  if (caseIds.length) {
    const [{ data: mrows }, { data: arows }] = await Promise.all([
      supabase.from("training_case_metrics").select("*").in("training_case_id", caseIds),
      supabase.from("training_case_assessments").select("*").in("training_case_id", caseIds).order("created_at", { ascending: false }),
    ]);
    for (const m of mrows ?? []) metricsByCaseId.set(m.training_case_id, m as TrainingCaseMetricsRow);
    assessments = (arows ?? []) as TrainingCaseAssessmentRow[];
  }

  const ladderRows = (ladders ?? []) as TrainingCompetencyLadderRow[];
  const ladderIdSet = new Set(ladderRows.map((l) => l.id));
  const stepRows = (allSteps ?? []).filter((s) => ladderIdSet.has((s as TrainingCompetencyStepRow).ladder_id)) as TrainingCompetencyStepRow[];
  const laddersWithSteps = groupStepsByLadder(ladderRows, stepRows);

  const achievementRows = (achievements ?? []) as TrainingCompetencyAchievementRow[];
  const achievementsByStepId = new Map(achievementRows.map((a) => [a.step_id, a]));
  const achievedStepIds = achievementRows.map((a) => a.step_id);
  const achievedSet = new Set(achievedStepIds);

  const stateList = (stateRows ?? []) as TrainingCompetencyStepStateRow[];
  const stateByStepId = new Map(stateList.map((r) => [r.step_id, r]));
  const observationsByStepId = new Map<string, TrainingCompetencyStepObservationRow[]>();
  for (const o of (obsRows ?? []) as TrainingCompetencyStepObservationRow[]) {
    const list = observationsByStepId.get(o.step_id) ?? [];
    list.push(o);
    observationsByStepId.set(o.step_id, list);
  }

  let latestMetrics: TrainingCaseMetricsRow | null = null;
  for (let i = cases.length - 1; i >= 0; i--) {
    const m = metricsByCaseId.get(cases[i]!.id);
    if (m) {
      latestMetrics = m;
      break;
    }
  }

  const stepUiByStepId = buildStepUiByStepId({
    laddersWithSteps,
    achievementsByStepId,
    stateByStepId,
    observationsByStepId,
    metricsByCaseId,
    casesChronological: cases,
    latestMetrics,
  });

  const weeklyReviews = (reviewRows ?? []) as TrainingCompetencyWeeklyReviewRow[];
  const waveStart = competencyWaveAnchor(doctor);
  const competencyWeek = currentCompetencyWeekNumber(waveStart);
  const waveWindowLabel =
    waveStart && competencyWeek != null
      ? (() => {
          const w = competencyWeekDateWindow(waveStart, competencyWeek);
          return `${w.start} – ${w.end}`;
        })()
      : null;

  const reviewForWeek = pickReviewForCompetencyWeek(weeklyReviews, competencyWeek);
  const weekFocusBullets = buildWeekFocusBullets({ competencyWeek, reviewForWeek });

  const totalTargets = countTargetMilestones(laddersWithSteps);
  const signedTargetCount = countSignedTargetMilestones(laddersWithSteps, achievedSet);
  const targetsMet =
    totalTargets === 0 ||
    laddersWithSteps.every((l) => {
      const targets = l.steps.filter((s) => s.is_target);
      if (!targets.length) return true;
      return targets.every((t) => achievedSet.has(t.id));
    });

  const readinessSummary = buildReadinessSummary({
    doctor,
    allTargetsAchieved: targetsMet,
  });

  const snapshot = computeTraineeProgressSnapshot({
    doctor,
    metricsByCaseId,
    assessmentsNewestFirst: assessments,
  });

  const trajectory = computeTraineeTrajectoryPhase({
    readinessStatus: (doctor.competency_final_readiness_status || null) as CompetencyFinalReadinessStatus | null,
    snapshotBadge: snapshot.badge,
    signedTargetCount,
    totalTargets,
    caseCount: cases.length,
    achievementCount: achievementRows.length,
  });

  const suggestedStepIds = suggestStepIdsFromLatestMetrics(laddersWithSteps, latestMetrics);
  const stepLabelById = new Map(stepRows.map((s) => [s.id, s.short_label || s.label]));
  const suggestedStepLabels = [...new Set(suggestedStepIds.map((id) => stepLabelById.get(id)).filter(Boolean))] as string[];

  const highlightLadderKeys = collectLadderKeysForTrainingHints(laddersWithSteps, suggestedStepIds, achievedSet);
  const modules = filterModulesForViewer(rawModules, {
    userId: access.userId,
    isStaff: false,
    traineeCohortIds,
  });

  const moduleRecs: TraineeDashboardModuleRec[] = [];
  const pushRec = (m: (typeof modules)[0], reason: TraineeDashboardModuleRec["reason"]) => {
    moduleRecs.push({
      id: m.id,
      title: m.title,
      shortDescription: m.shortDescription,
      readOnlineUrl: m.readOnlineUrl ?? null,
      reason,
    });
  };
  for (const m of modules) {
    if (competencyWeek != null && m.recommendedForWeeks?.includes(competencyWeek)) pushRec(m, "week");
  }
  for (const m of modules) {
    if (m.flags?.mandatory) pushRec(m, "mandatory");
  }
  for (const m of modules) {
    const keys = m.flags?.relatedCompetencyLadderKeys ?? [];
    if (keys.some((k) => highlightLadderKeys.includes(k))) pushRec(m, "milestone");
  }

  const moduleHints = modules.map((m) => ({
    id: m.id,
    title: m.title,
    readOnlineUrl: m.readOnlineUrl ?? null,
  }));

  const latestAchievementNote =
    achievementRows.find((a) => (a.trainer_comments ?? "").trim().length > 0)?.trainer_comments ?? null;

  const domainAvg = domainAveragesFromAssessments(assessments, 5);
  const tTrend = trendValuesFromCases(cases, metricsByCaseId, "transection_rate");
  const impTrend = trendValuesFromCases(cases, metricsByCaseId, "implantation_grafts_per_hour");
  const extTrend = trendValuesFromCases(cases, metricsByCaseId, "extraction_grafts_per_hour");

  const stageHistory = (stageHistoryRows ?? []) as TrainingStageHistoryRow[];

  return (
    <TraineeDashboardView
      userId={access.userId}
      doctor={doctor}
      programName={programName}
      cohortLabel={cohortLabel}
      siteLabel={siteLabel}
      competencyWeek={competencyWeek}
      waveWindowLabel={waveWindowLabel}
      snapshot={snapshot}
      trajectory={trajectory}
      readinessSummary={readinessSummary}
      achievedStepIds={achievedStepIds}
      cases={cases}
      assessments={assessments}
      metricsByCaseId={metricsByCaseId}
      stageHistory={stageHistory}
      laddersWithSteps={laddersWithSteps}
      signedTargetCount={signedTargetCount}
      totalTargets={totalTargets}
      suggestedStepLabels={suggestedStepLabels}
      stepUiByStepId={stepUiByStepId}
      weeklyReviews={weeklyReviews}
      reviewForWeek={reviewForWeek}
      weekFocusBullets={weekFocusBullets}
      moduleRecs={moduleRecs}
      moduleHints={moduleHints}
      latestAchievementNote={latestAchievementNote}
      trendTransection={tTrend}
      trendImplant={impTrend}
      trendExtract={extTrend}
      domainAvg={domainAvg}
    />
  );
}
