import {
  determineAwardTier,
  AWARD_RULES,
  computeVolumeConfidenceScore,
  shouldPauseProgression,
  type AwardTier,
  type TransparencyMetrics,
} from "@/lib/transparency/awardRules";
import { computeAwardContributionWeight } from "@/lib/auditor/eligibility";
import { evaluateEvidenceValidation, evaluateConsistencyEligibility } from "@/lib/auditor/provisionalValidation";
import type { SupabaseClient } from "@supabase/supabase-js";

type ReportRow = {
  id: string;
  case_id: string;
  summary: unknown;
  counts_for_awards?: boolean;
  provisional_status?: string;
  award_contribution_weight?: number | null;
};

type AdminClient = SupabaseClient;

function avg(values: number[]) {
  const filtered = values.filter((n) => Number.isFinite(n));
  if (!filtered.length) return 0;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

function parseForensicMetrics(summary: unknown): { averageAuditScore: number | null; documentationIntegrityAverage: number | null; benchmarkEligible: boolean } {
  const s = (summary ?? {}) as Record<string, unknown>;
  const forensic = (s.forensic_audit ?? {}) as Record<string, unknown>;
  const overall = (forensic.overall_scores_v1 ?? {}) as Record<string, unknown>;
  const benchmark = (forensic.benchmark ?? {}) as Record<string, unknown>;
  const domains = (((forensic.domain_scores_v1 as Record<string, unknown> | undefined)?.domains ?? []) as unknown[]) ?? [];

  const score = Number(overall.benchmark_score);
  const diDomain = domains.find((d) => String((d as Record<string, unknown>)?.domain_id ?? "") === "DI") as
    | Record<string, unknown>
    | undefined;
  const documentationIntegrity = Number(diDomain?.weighted_score);
  return {
    averageAuditScore: Number.isFinite(score) ? score : null,
    documentationIntegrityAverage: Number.isFinite(documentationIntegrity) ? documentationIntegrity : null,
    benchmarkEligible: Boolean(benchmark.eligible),
  };
}

function computeParticipationStatus(rate: number, invitedCount: number) {
  if (invitedCount === 0) return "not_started";
  if (rate >= 0.8) return "high_transparency";
  if (rate >= 0.3) return "active";
  return "invited";
}

export async function refreshClinicTransparencyMetrics(admin: AdminClient, clinicProfileId: string) {
  console.info("[transparency-refresh] refreshClinicTransparencyMetrics start", { clinicProfileId });
  const { data: requests } = await admin
    .from("case_contribution_requests")
    .select("id, case_id, status")
    .eq("clinic_profile_id", clinicProfileId);

  const rows = requests ?? [];
  const auditedCaseCount = rows.length;
  const contributedRows = rows.filter((r) =>
    ["doctor_contribution_received", "benchmark_recalculated", "benchmark_eligible"].includes(String(r.status ?? ""))
  );
  const contributedCaseCount = contributedRows.length;

  const caseIds = Array.from(new Set(contributedRows.map((r) => String(r.case_id ?? "")).filter(Boolean)));
  let averageAuditScore = 0;
  let documentationIntegrityAverage = 0;
  let benchmarkEligibleValidatedCount = 0;
  let validatedCaseCount = 0;
  let provisionalHighScoreCount = 0;
  let validatedHighScoreCount = 0;
  let lowScoreCaseCount = 0;

  if (caseIds.length > 0) {
    const { data: reports } = await admin
      .from("reports")
      .select("id, case_id, version, summary, counts_for_awards, provisional_status, award_contribution_weight")
      .in("case_id", caseIds)
      .order("version", { ascending: false });

    const latestByCase = new Map<string, ReportRow>();
    for (const r of reports ?? []) {
      const caseId = String((r as ReportRow).case_id ?? "");
      if (!caseId || latestByCase.has(caseId)) continue;
      latestByCase.set(caseId, r as ReportRow);
    }

    const scores: number[] = [];
    const integrity: number[] = [];
    for (const [, report] of latestByCase) {
      const parsed = parseForensicMetrics(report.summary);
      const score = parsed.averageAuditScore ?? 0;
      const counts = report.counts_for_awards !== false;
      if (report.provisional_status === "pending_validation" && typeof score === "number" && score >= 90) {
        provisionalHighScoreCount += 1;
      }
      if (!counts) continue;
      validatedCaseCount += 1;
      if (typeof score === "number" && score >= 90) validatedHighScoreCount += 1;
      if (typeof score === "number" && score < 60) lowScoreCaseCount += 1;
      if (typeof parsed.averageAuditScore === "number") scores.push(parsed.averageAuditScore);
      if (typeof parsed.documentationIntegrityAverage === "number") integrity.push(parsed.documentationIntegrityAverage);
      if (parsed.benchmarkEligible) benchmarkEligibleValidatedCount += 1;
    }
    averageAuditScore = avg(scores);
    documentationIntegrityAverage = avg(integrity);

    const { data: cases } = await admin.from("cases").select("id, clinic_id").in("id", caseIds);
    const caseToClinic = new Map<string, string>();
    for (const row of cases ?? []) {
      const c = row as { id: string; clinic_id?: string };
      if (c.clinic_id) caseToClinic.set(c.id, c.clinic_id);
    }

    for (const [caseId, report] of latestByCase) {
      if (report.provisional_status !== "pending_validation") continue;
      const evidenceResult = evaluateEvidenceValidation(report.summary);
      if (evidenceResult.pass) {
        const forensic = (report.summary as Record<string, unknown>)?.forensic_audit as Record<string, unknown> | undefined;
        const overall = forensic?.overall_scores_v1 as { performance_score?: number; benchmark_score?: number } | undefined;
        const benchmark = forensic?.benchmark as { eligible?: boolean } | undefined;
        const score = Number(overall?.performance_score ?? overall?.benchmark_score ?? 0);
        const weight = computeAwardContributionWeight({
          score,
          provisionalStatus: "validated_by_evidence",
          countsForAwards: true,
          benchmarkEligible: Boolean(benchmark?.eligible),
        });
        await admin.from("reports").update({
          provisional_status: "validated_by_evidence",
          counts_for_awards: true,
          validation_method: "evidence",
          validated_at: new Date().toISOString(),
          award_contribution_weight: weight,
        }).eq("id", report.id);
        continue;
      }
      const clinicId = caseToClinic.get(caseId);
      if (!clinicId) continue;
      const clinicCaseIds = Array.from(caseToClinic.entries()).filter(([, cid]) => cid === clinicId).map(([cid]) => cid);
      const validatedReportsForClinic: ReportRow[] = [];
      for (const cid of clinicCaseIds) {
        if (cid === caseId) continue;
        const rep = latestByCase.get(cid);
        if (rep && rep.counts_for_awards !== false) validatedReportsForClinic.push(rep);
      }
      if (validatedReportsForClinic.length < 3) continue;
      const validatedScores = validatedReportsForClinic
        .map((r) => parseForensicMetrics(r.summary).averageAuditScore)
        .filter((n): n is number => typeof n === "number");
      const clinicAvg = validatedScores.length ? validatedScores.reduce((a, b) => a + b, 0) / validatedScores.length : 0;
      const consistencyResult = evaluateConsistencyEligibility({ validatedCount: validatedReportsForClinic.length, averageScore: clinicAvg });
      if (consistencyResult.pass) {
        const forensic = (report.summary as Record<string, unknown>)?.forensic_audit as Record<string, unknown> | undefined;
        const overall = forensic?.overall_scores_v1 as { performance_score?: number; benchmark_score?: number } | undefined;
        const benchmark = forensic?.benchmark as { eligible?: boolean } | undefined;
        const score = Number(overall?.performance_score ?? overall?.benchmark_score ?? 0);
        const weight = computeAwardContributionWeight({
          score,
          provisionalStatus: "validated_by_consistency",
          countsForAwards: true,
          benchmarkEligible: Boolean(benchmark?.eligible),
        });
        await admin.from("reports").update({
          provisional_status: "validated_by_consistency",
          counts_for_awards: true,
          validation_method: "consistency",
          validated_at: new Date().toISOString(),
          award_contribution_weight: weight,
        }).eq("id", report.id);
      }
    }
  }

  const transparencyParticipationRate = auditedCaseCount > 0 ? contributedCaseCount / auditedCaseCount : 0;
  const participationStatus = computeParticipationStatus(transparencyParticipationRate, auditedCaseCount);
  const volumeConfidenceScore = computeVolumeConfidenceScore(validatedCaseCount, AWARD_RULES);
  const awardProgressionPaused = shouldPauseProgression(lowScoreCaseCount, AWARD_RULES);
  const participationStatusActive = contributedCaseCount >= 1 && participationStatus !== "not_started";

  const metrics: TransparencyMetrics = {
    transparencyParticipationRate,
    contributedCaseCount,
    validatedCaseCount,
    benchmarkEligibleValidatedCount,
    provisionalHighScoreCount,
    validatedHighScoreCount,
    lowScoreCaseCount,
    averageAuditScore,
    documentationIntegrityAverage,
    auditedCaseCount,
    volumeConfidenceScore,
    awardProgressionPaused,
    participationStatusActive,
  };
  const nextAward = determineAwardTier(metrics);

  const { data: current } = await admin
    .from("clinic_profiles")
    .select("id, current_award_tier")
    .eq("id", clinicProfileId)
    .maybeSingle();

  await admin
    .from("clinic_profiles")
    .update({
      participation_status: participationStatus,
      transparency_score: Number((transparencyParticipationRate * 100).toFixed(2)),
      performance_score: Number(averageAuditScore.toFixed(2)),
      current_award_tier: nextAward,
      audited_case_count: auditedCaseCount,
      contributed_case_count: contributedCaseCount,
      benchmark_eligible_count: benchmarkEligibleValidatedCount,
      average_forensic_score: Number(averageAuditScore.toFixed(2)),
      documentation_integrity_average: Number(documentationIntegrityAverage.toFixed(2)),
      award_progression_paused: awardProgressionPaused,
      volume_confidence_score: Number((volumeConfidenceScore * 100).toFixed(2)),
      validated_case_count: validatedCaseCount,
      provisional_high_score_count: provisionalHighScoreCount,
      validated_high_score_count: validatedHighScoreCount,
      low_score_case_count: lowScoreCaseCount,
      benchmark_eligible_validated_count: benchmarkEligibleValidatedCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clinicProfileId);

  if (current && String(current.current_award_tier ?? "") !== nextAward) {
    await admin.from("clinic_award_history").insert({
      clinic_profile_id: clinicProfileId,
      award_tier: nextAward,
      reason: "Transparency metrics recalculated",
      metrics_snapshot: metrics,
    });
  }

  return { ...metrics, currentAwardTier: nextAward as AwardTier };
}

export async function refreshDoctorTransparencyMetrics(admin: AdminClient, doctorProfileId: string) {
  console.info("[transparency-refresh] refreshDoctorTransparencyMetrics start", { doctorProfileId });
  const { data: requests } = await admin
    .from("case_contribution_requests")
    .select("id, case_id, status")
    .eq("doctor_profile_id", doctorProfileId);

  const rows = requests ?? [];
  const auditedCaseCount = rows.length;
  const contributedRows = rows.filter((r) =>
    ["doctor_contribution_received", "benchmark_recalculated", "benchmark_eligible"].includes(String(r.status ?? ""))
  );
  const contributedCaseCount = contributedRows.length;

  const caseIds = Array.from(new Set(contributedRows.map((r) => String(r.case_id ?? "")).filter(Boolean)));
  let averageAuditScore = 0;
  let documentationIntegrityAverage = 0;
  let benchmarkEligibleValidatedCount = 0;
  let validatedCaseCount = 0;
  let provisionalHighScoreCount = 0;
  let validatedHighScoreCount = 0;
  let lowScoreCaseCount = 0;

  if (caseIds.length > 0) {
    const { data: reports } = await admin
      .from("reports")
      .select("id, case_id, version, summary, counts_for_awards, provisional_status")
      .in("case_id", caseIds)
      .order("version", { ascending: false });

    const latestByCaseDoctor = new Map<string, ReportRow>();
    for (const r of reports ?? []) {
      const caseId = String((r as ReportRow).case_id ?? "");
      if (!caseId || latestByCaseDoctor.has(caseId)) continue;
      latestByCaseDoctor.set(caseId, r as ReportRow);
    }

    const scores: number[] = [];
    const integrity: number[] = [];
    for (const [, report] of latestByCaseDoctor) {
      const parsed = parseForensicMetrics(report.summary);
      const score = parsed.averageAuditScore ?? 0;
      const counts = report.counts_for_awards !== false;
      if (report.provisional_status === "pending_validation" && typeof score === "number" && score >= 90) {
        provisionalHighScoreCount += 1;
      }
      if (!counts) continue;
      validatedCaseCount += 1;
      if (typeof score === "number" && score >= 90) validatedHighScoreCount += 1;
      if (typeof score === "number" && score < 60) lowScoreCaseCount += 1;
      if (typeof parsed.averageAuditScore === "number") scores.push(parsed.averageAuditScore);
      if (typeof parsed.documentationIntegrityAverage === "number") integrity.push(parsed.documentationIntegrityAverage);
      if (parsed.benchmarkEligible) benchmarkEligibleValidatedCount += 1;
    }
    averageAuditScore = avg(scores);
    documentationIntegrityAverage = avg(integrity);

    for (const [, report] of latestByCaseDoctor) {
      if (report.provisional_status !== "pending_validation") continue;
      const evidenceResult = evaluateEvidenceValidation(report.summary);
      if (evidenceResult.pass) {
        const forensic = (report.summary as Record<string, unknown>)?.forensic_audit as Record<string, unknown> | undefined;
        const overall = forensic?.overall_scores_v1 as { performance_score?: number; benchmark_score?: number } | undefined;
        const benchmark = forensic?.benchmark as { eligible?: boolean } | undefined;
        const score = Number(overall?.performance_score ?? overall?.benchmark_score ?? 0);
        const weight = computeAwardContributionWeight({
          score,
          provisionalStatus: "validated_by_evidence",
          countsForAwards: true,
          benchmarkEligible: Boolean(benchmark?.eligible),
        });
        await admin.from("reports").update({
          provisional_status: "validated_by_evidence",
          counts_for_awards: true,
          validation_method: "evidence",
          validated_at: new Date().toISOString(),
          award_contribution_weight: weight,
        }).eq("id", report.id);
      }
    }
  }

  const transparencyParticipationRate = auditedCaseCount > 0 ? contributedCaseCount / auditedCaseCount : 0;
  const participationStatusDoctor = computeParticipationStatus(transparencyParticipationRate, auditedCaseCount);
  const volumeConfidenceScoreDoctor = computeVolumeConfidenceScore(validatedCaseCount, AWARD_RULES);
  const awardProgressionPausedDoctor = shouldPauseProgression(lowScoreCaseCount, AWARD_RULES);
  const participationStatusActiveDoctor = contributedCaseCount >= 1 && participationStatusDoctor !== "not_started";

  const metrics: TransparencyMetrics = {
    transparencyParticipationRate,
    contributedCaseCount,
    validatedCaseCount,
    benchmarkEligibleValidatedCount,
    provisionalHighScoreCount,
    validatedHighScoreCount,
    lowScoreCaseCount,
    averageAuditScore,
    documentationIntegrityAverage,
    auditedCaseCount,
    volumeConfidenceScore: volumeConfidenceScoreDoctor,
    awardProgressionPaused: awardProgressionPausedDoctor,
    participationStatusActive: participationStatusActiveDoctor,
  };
  const nextAward = determineAwardTier(metrics);

  const { data: current } = await admin
    .from("doctor_profiles")
    .select("id, current_award_tier")
    .eq("id", doctorProfileId)
    .maybeSingle();

  await admin
    .from("doctor_profiles")
    .update({
      participation_status: participationStatusDoctor,
      transparency_score: Number((transparencyParticipationRate * 100).toFixed(2)),
      performance_score: Number(averageAuditScore.toFixed(2)),
      current_award_tier: nextAward,
      audited_case_count: auditedCaseCount,
      contributed_case_count: contributedCaseCount,
      benchmark_eligible_count: benchmarkEligibleValidatedCount,
      average_forensic_score: Number(averageAuditScore.toFixed(2)),
      documentation_integrity_average: Number(documentationIntegrityAverage.toFixed(2)),
      award_progression_paused: awardProgressionPausedDoctor,
      volume_confidence_score: Number((volumeConfidenceScoreDoctor * 100).toFixed(2)),
      validated_case_count: validatedCaseCount,
      provisional_high_score_count: provisionalHighScoreCount,
      validated_high_score_count: validatedHighScoreCount,
      low_score_case_count: lowScoreCaseCount,
      benchmark_eligible_validated_count: benchmarkEligibleValidatedCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", doctorProfileId);

  if (current && String(current.current_award_tier ?? "") !== nextAward) {
    await admin.from("doctor_award_history").insert({
      doctor_profile_id: doctorProfileId,
      award_tier: nextAward,
      reason: "Transparency metrics recalculated",
      metrics_snapshot: metrics,
    });
  }

  return { ...metrics, currentAwardTier: nextAward as AwardTier };
}
