import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { getAcademyAccess } from "@/lib/academy/auth";
import {
  collectLadderKeysForTrainingHints,
  filterModulesForViewer,
  loadTrainingModulesCatalog,
} from "@/lib/academy/trainingModulesCatalog";
import {
  competencyWaveAnchor,
  currentCompetencyWeekNumber,
  groupStepsByLadder,
  suggestStepIdsFromLatestMetrics,
} from "@/lib/academy/competency";
import { fetchTrainingCasesForDoctor, fetchTrainingDoctorForUser } from "@/lib/academy/queries";
import type {
  TrainingCaseMetricsRow,
  TrainingCompetencyAchievementRow,
  TrainingCompetencyLadderRow,
  TrainingCompetencyStepRow,
} from "@/lib/academy/types";
import TrainingModulesLibraryClient from "@/components/academy/TrainingModulesLibraryClient";

export const dynamic = "force-dynamic";

export default async function TrainingModulesPage() {
  const access = await getAcademyAccess();
  if (!access.ok) redirect("/academy/login");

  const rawModules = await loadTrainingModulesCatalog();
  const modules = filterModulesForViewer(rawModules, { userId: access.userId, isStaff: access.isStaff });

  const supabase = await createSupabaseAuthServerClient();

  let traineeWeek: number | null = null;
  let highlightLadderKeys: string[] = [];
  let competencyHref: string | null = null;

  if (!access.isStaff) {
    const doctor = await fetchTrainingDoctorForUser(supabase, access.userId);
    if (doctor) {
      competencyHref = `/academy/trainees/${doctor.id}/competency`;
      const wave = competencyWaveAnchor(doctor);
      traineeWeek = currentCompetencyWeekNumber(wave);

      const [{ data: ladders }, { data: allSteps }, { data: achievements }, cases] = await Promise.all([
        supabase.from("training_competency_ladders").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
        supabase.from("training_competency_steps").select("*").order("step_index", { ascending: true }),
        supabase.from("training_competency_achievements").select("*").eq("training_doctor_id", doctor.id),
        fetchTrainingCasesForDoctor(supabase, doctor.id),
      ]);

      const ladderRows = (ladders ?? []) as TrainingCompetencyLadderRow[];
      const ladderIdSet = new Set(ladderRows.map((l) => l.id));
      const stepRows = (allSteps ?? []).filter((s) =>
        ladderIdSet.has((s as TrainingCompetencyStepRow).ladder_id)
      ) as TrainingCompetencyStepRow[];
      const laddersWithSteps = groupStepsByLadder(ladderRows, stepRows);
      const achievementRows = (achievements ?? []) as TrainingCompetencyAchievementRow[];
      const achievedIds = new Set(achievementRows.map((a) => a.step_id));

      let latestMetrics: TrainingCaseMetricsRow | null = null;
      const caseIds = cases.map((c) => c.id);
      if (caseIds.length) {
        const { data: mrows } = await supabase.from("training_case_metrics").select("*").in("training_case_id", caseIds);
        const metricsByCaseId = new Map<string, TrainingCaseMetricsRow>();
        for (const m of mrows ?? []) {
          const row = m as TrainingCaseMetricsRow;
          metricsByCaseId.set(row.training_case_id, row);
        }
        for (let i = cases.length - 1; i >= 0; i--) {
          const m = metricsByCaseId.get(cases[i].id);
          if (m) {
            latestMetrics = m;
            break;
          }
        }
      }

      const suggestedStepIds = suggestStepIdsFromLatestMetrics(laddersWithSteps, latestMetrics);
      highlightLadderKeys = collectLadderKeysForTrainingHints(laddersWithSteps, suggestedStepIds, achievedIds);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6 pb-10">
      <div>
        <Link href="/academy/dashboard" className="text-sm font-medium text-amber-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Training module library</h1>
        <p className="mt-1 text-sm text-slate-600">
          Approved IIOHR self-study materials. Read or download anytime — this does not replace trainer sign-off on the competency
          dashboard.
        </p>
      </div>

      <TrainingModulesLibraryClient
        modules={modules}
        storageUserId={access.userId}
        traineeWeek={traineeWeek}
        highlightLadderKeys={highlightLadderKeys}
        competencyHref={competencyHref}
        isStaff={access.isStaff}
      />
    </div>
  );
}
