/**
 * Clinic certification ranking (public-safe, engine-derived).
 *
 * Foundation only: compute + rank, do not persist.
 * Excludes clinics without an engine certification tier to avoid implying ranking performers.
 */

import { evaluateCertification } from "@/lib/certification";
import type { AwardTier } from "@/lib/transparency/awardRules";
import type { CaseRowForCert, CaseWithReportForCert } from "@/lib/certification";

type ClinicRankingInput = {
  id: string;
  clinic_slug: string | null;
  clinic_name: string;
  /**
   * Internal linking key:
   * - clinic_profiles.linked_user_id (auth.users.id)
   * - cases.clinic_id == clinic_profiles.linked_user_id in the normal flow.
   */
  linked_user_id: string | null;
};

export type ClinicCertificationRankingRow = {
  clinicId: string;
  clinicSlug: string | null;
  clinicName: string;
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

export function rankClinicsByCertification(
  snapshots: Array<ClinicRankingInput & EngineCertificationSnapshot>
): ClinicCertificationRankingRow[] {
  const ordered = [...snapshots].sort((a, b) => {
    const tierA = tierRankValue(a.currentTier);
    const tierB = tierRankValue(b.currentTier);
    if (tierA !== tierB) return tierB - tierA;

    if (a.certificationScore !== b.certificationScore) return b.certificationScore - a.certificationScore;
    if (a.eligiblePublicCases !== b.eligiblePublicCases) return b.eligiblePublicCases - a.eligiblePublicCases;
    if (a.transparencyRatioRaw !== b.transparencyRatioRaw) return b.transparencyRatioRaw - a.transparencyRatioRaw;

    // Deterministic tie-breakers (no additional semantics).
    if (a.clinic_name !== b.clinic_name) return a.clinic_name.localeCompare(b.clinic_name);
    return a.id.localeCompare(b.id);
  });

  return ordered.map((s, idx) => ({
    clinicId: s.id,
    clinicSlug: s.clinic_slug,
    clinicName: s.clinic_name,
    currentTier: s.currentTier,
    certificationScore: s.certificationScore,
    eligiblePublicCases: s.eligiblePublicCases,
    transparencyRatioRaw: s.transparencyRatioRaw,
    rankPosition: idx + 1,
  }));
}

async function fetchPublicCompletedCasesForClinic(
  admin: any,
  clinicLinkedUserId: string
): Promise<CaseRowForCert[]> {
  const { data: publicCompletedCases } = await admin
    .from("cases")
    .select("id, status, audit_mode, visibility_scope, is_test")
    .eq("clinic_id", clinicLinkedUserId)
    .eq("status", "complete")
    .or("audit_mode.eq.public,visibility_scope.eq.public")
    .eq("is_test", false);

  return (publicCompletedCases ?? []) as CaseRowForCert[];
}

async function fetchLatestReportsSummaryForCases(
  admin: any,
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
    latestByCaseId.set(cid, (r as { summary?: unknown }).summary as any);
  }

  return latestByCaseId;
}

export async function computeClinicCertificationRanking({
  admin,
  clinics,
  maxClinics = 50,
}: {
  admin: any;
  clinics: ClinicRankingInput[];
  /**
   * Safety/perf guard: compute certification for at most this many clinics in one pass.
   * Ranking foundation can still be reused with larger sets later.
   */
  maxClinics?: number;
}): Promise<ClinicCertificationRankingRow[]> {
  const candidates = clinics.slice(0, Math.max(0, maxClinics));

  const snapshots: Array<ClinicRankingInput & EngineCertificationSnapshot> = [];

  for (const clinic of candidates) {
    const linkedUserId = clinic.linked_user_id;
    if (!linkedUserId) continue;

    const caseRows = await fetchPublicCompletedCasesForClinic(admin, linkedUserId);
    // Suppress no-evidence/no-certification clinics from ranked output.
    if (caseRows.length === 0) continue;

    const caseIds = caseRows.map((c) => c.id).filter(Boolean);
    const latestReportSummaries = await fetchLatestReportsSummaryForCases(admin, caseIds);

    const casesWithReports: CaseWithReportForCert[] = caseRows.map((c) => ({
      case: c,
      latestReportSummary: latestReportSummaries.get(c.id) ?? null,
    }));

    const result = evaluateCertification(casesWithReports);
    if (!result.tier) continue; // no-tier suppression

    snapshots.push({
      ...clinic,
      currentTier: result.tier,
      certificationScore: result.score,
      eligiblePublicCases: result.metrics.eligiblePublicCaseCount,
      transparencyRatioRaw: result.metrics.transparencyRatioRaw,
    });
  }

  return rankClinicsByCertification(snapshots);
}

