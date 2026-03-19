/**
 * Doctor certification ranking (public-safe, engine-derived).
 *
 * Foundation only: compute + rank, do not persist.
 * Excludes doctors without an engine certification tier to avoid implying ranking performers.
 * Uses reliable doctor attribution only: cases.doctor_id === doctor_profiles.linked_user_id.
 */

import { evaluateCertification } from "@/lib/certification";
import type { AwardTier } from "@/lib/transparency/awardRules";
import type { CaseRowForCert, CaseWithReportForCert } from "@/lib/certification";

type DoctorRankingInput = {
  id: string;
  doctor_name: string;
  /**
   * doctor_profiles.linked_user_id (auth.users.id).
   * cases.doctor_id must match this for attribution.
   */
  linked_user_id: string | null;
  /** Optional; not in schema yet — for future public doctor profile URLs. */
  doctor_slug?: string | null;
};

export type DoctorCertificationRankingRow = {
  doctorId: string;
  doctorName: string;
  doctorSlug: string | null;
  currentTier: AwardTier;
  certificationScore: number;
  eligiblePublicCases: number;
  transparencyRatioRaw: number;
  rankPosition: number;
};

function tierRankValue(tier: AwardTier): number {
  if (tier === "PLATINUM") return 4;
  if (tier === "GOLD") return 3;
  if (tier === "SILVER") return 2;
  return 1; // VERIFIED
}

type EngineCertificationSnapshot = {
  currentTier: AwardTier;
  certificationScore: number;
  eligiblePublicCases: number;
  transparencyRatioRaw: number;
};

export function rankDoctorsByCertification(
  snapshots: Array<DoctorRankingInput & EngineCertificationSnapshot>
): DoctorCertificationRankingRow[] {
  const ordered = [...snapshots].sort((a, b) => {
    const tierA = tierRankValue(a.currentTier);
    const tierB = tierRankValue(b.currentTier);
    if (tierA !== tierB) return tierB - tierA;

    if (a.certificationScore !== b.certificationScore) return b.certificationScore - a.certificationScore;
    if (a.eligiblePublicCases !== b.eligiblePublicCases) return b.eligiblePublicCases - a.eligiblePublicCases;
    if (a.transparencyRatioRaw !== b.transparencyRatioRaw) return b.transparencyRatioRaw - a.transparencyRatioRaw;

    if (a.doctor_name !== b.doctor_name) return a.doctor_name.localeCompare(b.doctor_name);
    return a.id.localeCompare(b.id);
  });

  return ordered.map((s, idx) => ({
    doctorId: s.id,
    doctorName: s.doctor_name,
    doctorSlug: s.doctor_slug ?? null,
    currentTier: s.currentTier,
    certificationScore: s.certificationScore,
    eligiblePublicCases: s.eligiblePublicCases,
    transparencyRatioRaw: s.transparencyRatioRaw,
    rankPosition: idx + 1,
  }));
}

async function fetchPublicCompletedCasesForDoctor(
  admin: { from: (t: string) => any },
  doctorLinkedUserId: string
): Promise<CaseRowForCert[]> {
  const { data: publicCompletedCases } = await admin
    .from("cases")
    .select("id, status, audit_mode, visibility_scope, is_test")
    .eq("doctor_id", doctorLinkedUserId)
    .eq("status", "complete")
    .or("audit_mode.eq.public,visibility_scope.eq.public")
    .eq("is_test", false);

  return (publicCompletedCases ?? []) as CaseRowForCert[];
}

async function fetchLatestReportsSummaryForCases(
  admin: { from: (t: string) => any },
  caseIds: string[]
): Promise<Map<string, CaseWithReportForCert["latestReportSummary"]>> {
  if (caseIds.length === 0) return new Map();

  const { data: reportRows } = await admin
    .from("reports")
    .select("case_id, version, summary")
    .in("case_id", caseIds)
    .order("version", { ascending: false })
    .limit(3000);

  const latestByCaseId = new Map<string, CaseWithReportForCert["latestReportSummary"]>();
  for (const r of reportRows ?? []) {
    const cid = String(r.case_id ?? "");
    if (!cid || latestByCaseId.has(cid)) continue;
    latestByCaseId.set(cid, (r as { summary?: unknown }).summary as CaseWithReportForCert["latestReportSummary"]);
  }

  return latestByCaseId;
}

export async function computeDoctorCertificationRanking({
  admin,
  doctors,
  maxDoctors = 50,
}: {
  admin: { from: (t: string) => any };
  doctors: DoctorRankingInput[];
  /**
   * Safety/perf guard: compute certification for at most this many doctors in one pass.
   */
  maxDoctors?: number;
}): Promise<DoctorCertificationRankingRow[]> {
  const candidates = doctors.slice(0, Math.max(0, maxDoctors));

  const snapshots: Array<DoctorRankingInput & EngineCertificationSnapshot> = [];

  for (const doctor of candidates) {
    const linkedUserId = doctor.linked_user_id;
    if (!linkedUserId) continue;

    const caseRows = await fetchPublicCompletedCasesForDoctor(admin, linkedUserId);
    if (caseRows.length === 0) continue;

    const caseIds = caseRows.map((c) => c.id).filter(Boolean);
    const latestReportSummaries = await fetchLatestReportsSummaryForCases(admin, caseIds);

    const casesWithReports: CaseWithReportForCert[] = caseRows.map((c) => ({
      case: c,
      latestReportSummary: latestReportSummaries.get(c.id) ?? null,
    }));

    const result = evaluateCertification(casesWithReports);
    if (!result.tier) continue;

    snapshots.push({
      ...doctor,
      currentTier: result.tier,
      certificationScore: result.score,
      eligiblePublicCases: result.metrics.eligiblePublicCaseCount,
      transparencyRatioRaw: result.metrics.transparencyRatioRaw,
    });
  }

  return rankDoctorsByCertification(snapshots);
}
