/**
 * Data for the extreme-score review queue (high-score validation + low-score optional review).
 * Used by admin/extreme-score-review page.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ReportSummaryParsed = {
  score: number;
  confidence: number;
  confidenceGrade?: string;
  benchmarkEligible: boolean;
  documentationScore: number;
  completenessScore: number;
  validationPathwayAvailable: string;
};

export function parseReportSummaryForQueue(summary: unknown): ReportSummaryParsed {
  const s = (summary ?? {}) as Record<string, unknown>;
  const forensic = (s.forensic_audit ?? s.forensic ?? {}) as Record<string, unknown>;
  const overall = (forensic.overall_scores_v1 ?? {}) as Record<string, unknown>;
  const benchmark = (forensic.benchmark ?? {}) as Record<string, unknown>;
  const domains = (((forensic.domain_scores_v1 as Record<string, unknown> | undefined)?.domains ?? []) as unknown[]) ?? [];
  const completeness = (forensic.completeness_index_v1 as { score?: number } | undefined)?.score;

  const score = Number(overall.benchmark_score ?? overall.performance_score ?? 0);
  const confidence = Number(overall.confidence_multiplier ?? 0);
  const diDomain = domains.find((d) => String((d as Record<string, unknown>)?.domain_id ?? "") === "DI") as Record<string, unknown> | undefined;
  const documentationScore = Number(diDomain?.weighted_score ?? 0);

  let validationPathwayAvailable = "—";
  if (benchmark.eligible && typeof completeness === "number" && completeness >= 85) validationPathwayAvailable = "Evidence";
  validationPathwayAvailable += " / Auditor / Consistency";

  return {
    score: Number.isFinite(score) ? score : 0,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    confidenceGrade: String(overall.confidence_grade ?? ""),
    benchmarkEligible: Boolean(benchmark.eligible),
    documentationScore: Number.isFinite(documentationScore) ? documentationScore : 0,
    completenessScore: Number.isFinite(completeness) ? Number(completeness) : 0,
    validationPathwayAvailable,
  };
}

export type HighScoreQueueItem = {
  reportId: string;
  caseId: string;
  clinicName: string;
  doctorName: string;
  score: number;
  benchmarkEligible: boolean;
  documentationScore: number;
  doctorContributionReceived: boolean;
  provisionalStatus: string;
  validationPathwayAvailable: string;
  parsed: ReportSummaryParsed;
  contributionPayloadSummary: string | null;
  overrideCount: number;
  feedbackCount: number;
};

export type LowScoreQueueItem = {
  reportId: string;
  caseId: string;
  clinicName: string;
  doctorName: string;
  score: number;
  confidence: number;
  doctorContributionReceived: boolean;
  benchmarkEligible: boolean;
  auditorReviewStatus: string;
  parsed: ReportSummaryParsed;
  overrideCount: number;
  feedbackCount: number;
};

export type ExtremeScoreQueueData = {
  highScoreQueue: HighScoreQueueItem[];
  lowScoreQueue: LowScoreQueueItem[];
  summary: {
    provisionalHighAwaiting: number;
    lowScoreAwaiting: number;
    validatedThisWeek: number;
    rejectedThisWeek: number;
  };
};

const CONTRIBUTED_STATUSES = ["doctor_contribution_received", "benchmark_recalculated", "benchmark_eligible"];

export async function fetchExtremeScoreQueueData(admin: SupabaseClient): Promise<ExtremeScoreQueueData> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfWeekIso = startOfWeek.toISOString();

  const [
    { data: highReports },
    { data: lowReports },
    { data: validatedThisWeek },
    { data: rejectedThisWeek },
  ] = await Promise.all([
    admin
      .from("reports")
      .select("id, case_id, summary, provisional_status, counts_for_awards")
      .eq("status", "complete")
      .eq("provisional_status", "pending_validation")
      .eq("counts_for_awards", false)
      .order("created_at", { ascending: false }),
    admin
      .from("reports")
      .select("id, case_id, summary, auditor_review_eligibility, auditor_review_status")
      .eq("status", "complete")
      .eq("auditor_review_eligibility", "eligible_low_score")
      .in("auditor_review_status", ["not_requested", "available", "in_review"])
      .order("created_at", { ascending: false }),
    admin
      .from("reports")
      .select("id")
      .in("provisional_status", ["validated_by_auditor", "validated_by_evidence", "validated_by_consistency"])
      .gte("validated_at", startOfWeekIso),
    admin
      .from("reports")
      .select("id")
      .eq("provisional_status", "rejected")
      .gte("updated_at", startOfWeekIso),
  ]);

  const highList = (highReports ?? []) as { id: string; case_id: string; summary: unknown; provisional_status: string; counts_for_awards: boolean }[];
  const lowList = (lowReports ?? []) as { id: string; case_id: string; summary: unknown; auditor_review_eligibility: string; auditor_review_status: string }[];

  const allCaseIds = [...new Set([...highList.map((r) => r.case_id), ...lowList.map((r) => r.case_id)].filter(Boolean))];

  if (allCaseIds.length === 0) {
    return {
      highScoreQueue: [],
      lowScoreQueue: [],
      summary: {
        provisionalHighAwaiting: highList.length,
        lowScoreAwaiting: lowList.length,
        validatedThisWeek: validatedThisWeek?.length ?? 0,
        rejectedThisWeek: rejectedThisWeek?.length ?? 0,
      },
    };
  }

  const [{ data: cases }, { data: contribRequests }, { data: overrides }, { data: feedback }] = await Promise.all([
    admin.from("cases").select("id, clinic_id, doctor_id").in("id", allCaseIds),
    admin.from("case_contribution_requests").select("case_id, status, contribution_payload").in("case_id", allCaseIds),
    admin.from("audit_score_overrides").select("report_id").in("report_id", [...highList.map((r) => r.id), ...lowList.map((r) => r.id)]),
    admin.from("audit_section_feedback").select("report_id").in("report_id", [...highList.map((r) => r.id), ...lowList.map((r) => r.id)]),
  ]);

  const caseRows = (cases ?? []) as { id: string; clinic_id?: string; doctor_id?: string }[];
  const clinicUserIds = [...new Set(caseRows.map((c) => c.clinic_id).filter(Boolean))] as string[];
  const doctorUserIds = [...new Set(caseRows.map((c) => c.doctor_id).filter(Boolean))] as string[];

  const [{ data: clinicProfiles }, { data: doctorProfiles }] = await Promise.all([
    clinicUserIds.length ? admin.from("clinic_profiles").select("id, linked_user_id, clinic_name").in("linked_user_id", clinicUserIds) : { data: [] },
    doctorUserIds.length ? admin.from("doctor_profiles").select("id, linked_user_id, doctor_name").in("linked_user_id", doctorUserIds) : { data: [] },
  ]);

  const clinicByUserId = new Map<string, { id: string; clinic_name: string }>();
  for (const c of clinicProfiles ?? []) {
    const row = c as { linked_user_id?: string; id: string; clinic_name: string };
    if (row.linked_user_id) clinicByUserId.set(row.linked_user_id, { id: row.id, clinic_name: row.clinic_name });
  }
  const doctorByUserId = new Map<string, { id: string; doctor_name: string }>();
  for (const d of doctorProfiles ?? []) {
    const row = d as { linked_user_id?: string; id: string; doctor_name: string };
    if (row.linked_user_id) doctorByUserId.set(row.linked_user_id, { id: row.id, doctor_name: row.doctor_name });
  }

  const caseById = new Map(caseRows.map((c) => [c.id, c]));
  const contribByCaseId = new Map<string, { status: string; contribution_payload: unknown }[]>();
  for (const r of (contribRequests ?? []) as { case_id: string; status: string; contribution_payload: unknown }[]) {
    const list = contribByCaseId.get(r.case_id) ?? [];
    list.push({ status: r.status, contribution_payload: r.contribution_payload });
    contribByCaseId.set(r.case_id, list);
  }
  const overrideCountByReportId = new Map<string, number>();
  for (const o of (overrides ?? []) as { report_id: string }[]) {
    overrideCountByReportId.set(o.report_id, (overrideCountByReportId.get(o.report_id) ?? 0) + 1);
  }
  const feedbackCountByReportId = new Map<string, number>();
  for (const f of (feedback ?? []) as { report_id: string }[]) {
    feedbackCountByReportId.set(f.report_id, (feedbackCountByReportId.get(f.report_id) ?? 0) + 1);
  }

  function contributionReceived(caseId: string): boolean {
    const list = contribByCaseId.get(caseId) ?? [];
    return list.some((x) => CONTRIBUTED_STATUSES.includes(x.status));
  }

  function contributionPayloadSummary(caseId: string): string | null {
    const list = contribByCaseId.get(caseId) ?? [];
    const received = list.find((x) => CONTRIBUTED_STATUSES.includes(x.status));
    if (!received?.contribution_payload || typeof received.contribution_payload !== "object") return null;
    const keys = Object.keys(received.contribution_payload as object);
    return keys.length ? `${keys.length} field(s)` : null;
  }

  const highScoreQueue: HighScoreQueueItem[] = highList.map((r) => {
    const parsed = parseReportSummaryForQueue(r.summary);
    const c = caseById.get(r.case_id);
    const clinic = c?.clinic_id ? clinicByUserId.get(c.clinic_id) : null;
    const doctor = c?.doctor_id ? doctorByUserId.get(c.doctor_id) : null;
    return {
      reportId: r.id,
      caseId: r.case_id,
      clinicName: clinic?.clinic_name ?? "—",
      doctorName: doctor?.doctor_name ?? "—",
      score: parsed.score,
      benchmarkEligible: parsed.benchmarkEligible,
      documentationScore: parsed.documentationScore,
      doctorContributionReceived: contributionReceived(r.case_id),
      provisionalStatus: r.provisional_status,
      validationPathwayAvailable: parsed.validationPathwayAvailable,
      parsed,
      contributionPayloadSummary: contributionPayloadSummary(r.case_id),
      overrideCount: overrideCountByReportId.get(r.id) ?? 0,
      feedbackCount: feedbackCountByReportId.get(r.id) ?? 0,
    };
  });

  const lowScoreQueue: LowScoreQueueItem[] = lowList.map((r) => {
    const parsed = parseReportSummaryForQueue(r.summary);
    const c = caseById.get(r.case_id);
    const clinic = c?.clinic_id ? clinicByUserId.get(c.clinic_id) : null;
    const doctor = c?.doctor_id ? doctorByUserId.get(c.doctor_id) : null;
    return {
      reportId: r.id,
      caseId: r.case_id,
      clinicName: clinic?.clinic_name ?? "—",
      doctorName: doctor?.doctor_name ?? "—",
      score: parsed.score,
      confidence: parsed.confidence,
      doctorContributionReceived: contributionReceived(r.case_id),
      benchmarkEligible: parsed.benchmarkEligible,
      auditorReviewStatus: r.auditor_review_status,
      parsed,
      overrideCount: overrideCountByReportId.get(r.id) ?? 0,
      feedbackCount: feedbackCountByReportId.get(r.id) ?? 0,
    };
  });

  return {
    highScoreQueue,
    lowScoreQueue,
    summary: {
      provisionalHighAwaiting: highScoreQueue.length,
      lowScoreAwaiting: lowScoreQueue.length,
      validatedThisWeek: validatedThisWeek?.length ?? 0,
      rejectedThisWeek: rejectedThisWeek?.length ?? 0,
    },
  };
}
