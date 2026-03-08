import { determineAwardTier, type AwardTier, type TransparencyMetrics } from "@/lib/transparency/awardRules";
import { isProvisionalForAward } from "@/lib/auditor/eligibility";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  let benchmarkEligibleCount = 0;

  if (caseIds.length > 0) {
    const { data: reports } = await admin
      .from("reports")
      .select("case_id, version, summary, auditor_review_eligibility, auditor_review_status")
      .in("case_id", caseIds)
      .order("version", { ascending: false });

    const latestByCase = new Map<string, { summary: unknown; auditor_review_eligibility?: string; auditor_review_status?: string }>();
    for (const r of reports ?? []) {
      const caseId = String(r.case_id ?? "");
      if (!caseId || latestByCase.has(caseId)) continue;
      latestByCase.set(caseId, {
        summary: r.summary,
        auditor_review_eligibility: (r as { auditor_review_eligibility?: string }).auditor_review_eligibility,
        auditor_review_status: (r as { auditor_review_status?: string }).auditor_review_status,
      });
    }

    const scores: number[] = [];
    const integrity: number[] = [];
    for (const [, report] of latestByCase) {
      const parsed = parseForensicMetrics(report.summary);
      if (typeof parsed.averageAuditScore === "number") scores.push(parsed.averageAuditScore);
      if (typeof parsed.documentationIntegrityAverage === "number") integrity.push(parsed.documentationIntegrityAverage);
      const provisional = isProvisionalForAward(report.auditor_review_eligibility, report.auditor_review_status);
      if (parsed.benchmarkEligible && !provisional) benchmarkEligibleCount += 1;
    }
    averageAuditScore = avg(scores);
    documentationIntegrityAverage = avg(integrity);
  }

  const transparencyParticipationRate = auditedCaseCount > 0 ? contributedCaseCount / auditedCaseCount : 0;
  const metrics: TransparencyMetrics = {
    transparencyParticipationRate,
    contributedCaseCount,
    benchmarkEligibleCount,
    averageAuditScore,
    documentationIntegrityAverage,
    auditedCaseCount,
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
      participation_status: computeParticipationStatus(transparencyParticipationRate, auditedCaseCount),
      transparency_score: Number((transparencyParticipationRate * 100).toFixed(2)),
      performance_score: Number(averageAuditScore.toFixed(2)),
      current_award_tier: nextAward,
      audited_case_count: auditedCaseCount,
      contributed_case_count: contributedCaseCount,
      benchmark_eligible_count: benchmarkEligibleCount,
      average_forensic_score: Number(averageAuditScore.toFixed(2)),
      documentation_integrity_average: Number(documentationIntegrityAverage.toFixed(2)),
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
  let benchmarkEligibleCount = 0;

  if (caseIds.length > 0) {
    const { data: reports } = await admin
      .from("reports")
      .select("case_id, version, summary, auditor_review_eligibility, auditor_review_status")
      .in("case_id", caseIds)
      .order("version", { ascending: false });

    const latestByCase = new Map<string, { summary: unknown; auditor_review_eligibility?: string; auditor_review_status?: string }>();
    for (const r of reports ?? []) {
      const caseId = String(r.case_id ?? "");
      if (!caseId || latestByCase.has(caseId)) continue;
      latestByCase.set(caseId, {
        summary: r.summary,
        auditor_review_eligibility: (r as { auditor_review_eligibility?: string }).auditor_review_eligibility,
        auditor_review_status: (r as { auditor_review_status?: string }).auditor_review_status,
      });
    }

    const scores: number[] = [];
    const integrity: number[] = [];
    for (const [, report] of latestByCase) {
      const parsed = parseForensicMetrics(report.summary);
      if (typeof parsed.averageAuditScore === "number") scores.push(parsed.averageAuditScore);
      if (typeof parsed.documentationIntegrityAverage === "number") integrity.push(parsed.documentationIntegrityAverage);
      const provisional = isProvisionalForAward(report.auditor_review_eligibility, report.auditor_review_status);
      if (parsed.benchmarkEligible && !provisional) benchmarkEligibleCount += 1;
    }
    averageAuditScore = avg(scores);
    documentationIntegrityAverage = avg(integrity);
  }

  const transparencyParticipationRate = auditedCaseCount > 0 ? contributedCaseCount / auditedCaseCount : 0;
  const metrics: TransparencyMetrics = {
    transparencyParticipationRate,
    contributedCaseCount,
    benchmarkEligibleCount,
    averageAuditScore,
    documentationIntegrityAverage,
    auditedCaseCount,
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
      participation_status: computeParticipationStatus(transparencyParticipationRate, auditedCaseCount),
      transparency_score: Number((transparencyParticipationRate * 100).toFixed(2)),
      performance_score: Number(averageAuditScore.toFixed(2)),
      current_award_tier: nextAward,
      audited_case_count: auditedCaseCount,
      contributed_case_count: contributedCaseCount,
      benchmark_eligible_count: benchmarkEligibleCount,
      average_forensic_score: Number(averageAuditScore.toFixed(2)),
      documentation_integrity_average: Number(documentationIntegrityAverage.toFixed(2)),
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
