import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import { competencyWaveAnchor, groupStepsByLadder, suggestStepIdsFromLatestMetrics } from "@/lib/academy/competency";
import { buildReadinessSummary, buildStepUiByStepId } from "@/lib/academy/competencyPhase2";
import { fetchTrainingCasesForDoctor } from "@/lib/academy/queries";
import type {
  TrainingCaseMetricsRow,
  TrainingCompetencyAchievementRow,
  TrainingCompetencyLadderRow,
  TrainingCompetencyStepObservationRow,
  TrainingCompetencyStepRow,
  TrainingCompetencyStepStateRow,
  TrainingCompetencyWeeklyReviewRow,
  TrainingDoctorRow,
} from "@/lib/academy/types";
import CompetencyDashboardClient from "@/components/academy/CompetencyDashboardClient";

export const dynamic = "force-dynamic";

export default async function TraineeCompetencyPage({ params }: { params: Promise<{ doctorId: string }> }) {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");

  const { doctorId } = await params;
  const supabase = await createSupabaseAuthServerClient();

  const { data: doctor, error: dErr } = await supabase.from("training_doctors").select("*").eq("id", doctorId).maybeSingle();
  if (dErr || !doctor) notFound();

  const doctorRow = doctor as TrainingDoctorRow;

  const [
    { data: ladders },
    { data: allSteps },
    { data: achievements },
    { data: stateRows },
    { data: obsRows },
    { data: reviewRows },
    cases,
  ] = await Promise.all([
    supabase.from("training_competency_ladders").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("training_competency_steps").select("*").order("step_index", { ascending: true }),
    supabase
      .from("training_competency_achievements")
      .select("*")
      .eq("training_doctor_id", doctorId)
      .order("achieved_at", { ascending: false }),
    supabase.from("training_competency_step_states").select("*").eq("training_doctor_id", doctorId),
    supabase
      .from("training_competency_step_observations")
      .select("*")
      .eq("training_doctor_id", doctorId)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_competency_weekly_reviews")
      .select("*")
      .eq("training_doctor_id", doctorId)
      .order("week_number", { ascending: true }),
    fetchTrainingCasesForDoctor(supabase, doctorId),
  ]);

  const ladderRows = (ladders ?? []) as TrainingCompetencyLadderRow[];
  const ladderIdSet = new Set(ladderRows.map((l) => l.id));
  const stepRows = (allSteps ?? []).filter((s) => ladderIdSet.has((s as TrainingCompetencyStepRow).ladder_id)) as TrainingCompetencyStepRow[];
  const laddersWithSteps = groupStepsByLadder(ladderRows, stepRows);

  const achievementRows = (achievements ?? []) as TrainingCompetencyAchievementRow[];
  const stateList = (stateRows ?? []) as TrainingCompetencyStepStateRow[];
  const observationList = (obsRows ?? []) as TrainingCompetencyStepObservationRow[];
  const weeklyReviews = (reviewRows ?? []) as TrainingCompetencyWeeklyReviewRow[];

  const achievementsByStepId = new Map(achievementRows.map((a) => [a.step_id, a]));
  const stateByStepId = new Map(stateList.map((r) => [r.step_id, r]));
  const observationsByStepId = new Map<string, TrainingCompetencyStepObservationRow[]>();
  for (const o of observationList) {
    const list = observationsByStepId.get(o.step_id) ?? [];
    list.push(o);
    observationsByStepId.set(o.step_id, list);
  }

  let latestMetrics: TrainingCaseMetricsRow | null = null;
  let defaultEvidenceCaseId: string | null = null;
  const caseIds = cases.map((c) => c.id);
  const metricsByCaseId = new Map<string, TrainingCaseMetricsRow>();
  const caseIdsWithMetrics = new Set<string>();
  if (caseIds.length) {
    const { data: mrows } = await supabase.from("training_case_metrics").select("*").in("training_case_id", caseIds);
    for (const m of mrows ?? []) {
      const row = m as TrainingCaseMetricsRow;
      metricsByCaseId.set(row.training_case_id, row);
      caseIdsWithMetrics.add(row.training_case_id);
    }
    for (let i = cases.length - 1; i >= 0; i--) {
      const m = metricsByCaseId.get(cases[i].id);
      if (m) {
        latestMetrics = m;
        defaultEvidenceCaseId = cases[i].id;
        break;
      }
    }
  }

  const suggestedStepIds = suggestStepIdsFromLatestMetrics(laddersWithSteps, latestMetrics);

  const stepUiByStepId = buildStepUiByStepId({
    laddersWithSteps,
    achievementsByStepId,
    stateByStepId,
    observationsByStepId,
    metricsByCaseId,
    casesChronological: cases,
    latestMetrics,
  });

  const achievedIds = new Set(achievementRows.map((a) => a.step_id));
  const targetsMet = laddersWithSteps.every((l) => {
    const targets = l.steps.filter((s) => s.is_target);
    if (targets.length === 0) return true;
    return targets.every((t) => achievedIds.has(t.id));
  });

  const readinessSummary = buildReadinessSummary({
    doctor: doctorRow,
    allTargetsAchieved: targetsMet,
  });

  const trainerIds = [
    ...new Set([
      ...achievementRows.map((a) => a.signed_off_by),
      ...(doctorRow.competency_final_readiness_by ? [doctorRow.competency_final_readiness_by] : []),
      ...observationList.map((o) => o.recorded_by),
      ...weeklyReviews.map((r) => r.reviewed_by),
    ]),
  ];
  const trainerNames: Record<string, string> = {};
  if (trainerIds.length) {
    const { data: nameRows } = await supabase.from("academy_users").select("user_id, display_name").in("user_id", trainerIds);
    for (const r of nameRows ?? []) {
      const uid = (r as { user_id: string }).user_id;
      const dn = (r as { display_name: string | null }).display_name;
      trainerNames[uid] = dn?.trim() || "Trainer";
    }
  }

  if (!laddersWithSteps.length) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Link href={`/academy/trainees/${doctorId}`} className="text-sm font-medium text-amber-700 hover:underline">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">Competency dashboard</h1>
        <p className="text-sm text-slate-600">
          No competency ladders are configured. Apply the latest database migrations for competency ladders and Phase 2.
        </p>
      </div>
    );
  }

  const waveStart = competencyWaveAnchor(doctorRow);

  return (
    <CompetencyDashboardClient
      doctorId={doctorId}
      doctor={{
        ...doctorRow,
        competency_wave_start_date: doctorRow.competency_wave_start_date ?? null,
        competency_final_readiness_at: doctorRow.competency_final_readiness_at ?? null,
        competency_final_readiness_by: doctorRow.competency_final_readiness_by ?? null,
        competency_final_readiness_status: doctorRow.competency_final_readiness_status ?? null,
        competency_final_readiness_notes: doctorRow.competency_final_readiness_notes ?? null,
        competency_restrictions_json:
          doctorRow.competency_restrictions_json && typeof doctorRow.competency_restrictions_json === "object"
            ? (doctorRow.competency_restrictions_json as Record<string, unknown>)
            : {},
      }}
      laddersWithSteps={laddersWithSteps}
      achievements={achievementRows}
      stepUiByStepId={stepUiByStepId}
      observations={observationList}
      weeklyReviews={weeklyReviews}
      cases={cases}
      suggestedStepIds={suggestedStepIds}
      trainerNames={trainerNames}
      isStaff={access.isStaff}
      readinessSummary={readinessSummary}
      waveStartIso={waveStart ? waveStart.toISOString() : null}
      defaultEvidenceCaseId={defaultEvidenceCaseId}
      caseIdsWithMetrics={[...caseIdsWithMetrics]}
    />
  );
}
