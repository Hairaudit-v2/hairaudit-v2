import type { AwardTier } from "@/lib/transparency/awardRules";

export type DirectoryClinicRow = {
  clinic_slug: string | null;
  clinic_name: string;
  country: string | null;
  city: string | null;
  participation_status: string | null;
  current_award_tier: string | null;
  transparency_score: number | null;
  audited_case_count: number | null;
  contributed_case_count: number | null;
  benchmark_eligible_count: number | null;
  benchmark_eligible_validated_count: number | null;
  average_forensic_score: number | null;
  documentation_integrity_average: number | null;
};

const TIER_ORDER: AwardTier[] = ["PLATINUM", "GOLD", "SILVER", "VERIFIED"];
const TIER_RANK: Record<string, number> = {
  PLATINUM: 4,
  GOLD: 3,
  SILVER: 2,
  VERIFIED: 1,
};

export type DirectoryFilterParams = {
  search?: string;
  tier?: string;
  country?: string;
  status?: string;
  benchmark?: string;
};

/**
 * Filter and sort directory rows. Only rows with non-null clinic_slug are included.
 * Sort: highest tier first, then benchmark-eligible validated count desc, then average score desc, then clinic name asc.
 */
export function filterAndSortDirectory(
  rows: DirectoryClinicRow[],
  params: DirectoryFilterParams
): DirectoryClinicRow[] {
  let list = rows.filter((r) => r.clinic_slug != null) as (DirectoryClinicRow & { clinic_slug: string })[];

  const search = params.search?.trim().toLowerCase();
  if (search) {
    list = list.filter(
      (r) =>
        r.clinic_name?.toLowerCase().includes(search) ||
        r.city?.toLowerCase().includes(search) ||
        r.country?.toLowerCase().includes(search)
    );
  }
  if (params.tier) {
    list = list.filter((r) => (r.current_award_tier ?? "") === params.tier);
  }
  if (params.country) {
    list = list.filter((r) => (r.country ?? "") === params.country);
  }
  if (params.status) {
    list = list.filter((r) => (r.participation_status ?? "") === params.status);
  }
  if (params.benchmark === "1") {
    list = list.filter(
      (r) => (r.benchmark_eligible_validated_count ?? r.benchmark_eligible_count ?? 0) > 0
    );
  }

  const tierRank = (t: string | null) => TIER_RANK[t ?? "VERIFIED"] ?? 0;
  list.sort((a, b) => {
    const tierA = tierRank(a.current_award_tier);
    const tierB = tierRank(b.current_award_tier);
    if (tierB !== tierA) return tierB - tierA;
    const benchA = a.benchmark_eligible_validated_count ?? a.benchmark_eligible_count ?? 0;
    const benchB = b.benchmark_eligible_validated_count ?? b.benchmark_eligible_count ?? 0;
    if (benchB !== benchA) return benchB - benchA;
    const scoreA = Number(a.average_forensic_score ?? 0);
    const scoreB = Number(b.average_forensic_score ?? 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (a.clinic_name ?? "").localeCompare(b.clinic_name ?? "");
  });

  return list;
}
