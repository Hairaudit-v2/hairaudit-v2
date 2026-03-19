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
  /** For joining with public case counts (cases.clinic_id = linked_user_id) */
  linked_user_id?: string | null;
  /** Public-only case count for sorting/filtering (set by directory page) */
  public_case_count?: number;
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
  /** sort: public_cases | certification | name */
  sort?: string;
  /** has_public_cases=1: only clinics with at least one public case */
  has_public_cases?: string;
  /** founding=1: only founding clinics (requires founding_slugs) */
  founding?: string;
  /** Slugs considered founding (from env); used when founding=1 */
  founding_slugs?: string[];
};

/**
 * Filter and sort directory rows. Only rows with non-null clinic_slug are included.
 * Uses public_case_count when sort=public_cases or has_public_cases=1.
 */
export function filterAndSortDirectory(
  rows: DirectoryClinicRow[],
  params: DirectoryFilterParams
): DirectoryClinicRow[] {
  let list = rows.filter((r) => r.clinic_slug != null) as (DirectoryClinicRow & { clinic_slug: string; public_case_count?: number })[];

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
  if (params.has_public_cases === "1") {
    list = list.filter((r) => (r.public_case_count ?? 0) > 0);
  }
  if (params.founding === "1" && params.founding_slugs?.length) {
    const set = new Set(params.founding_slugs);
    list = list.filter((r) => r.clinic_slug && set.has(r.clinic_slug));
  }

  const tierRank = (t: string | null) => TIER_RANK[t ?? "VERIFIED"] ?? 0;
  const sortMode = params.sort === "public_cases" || params.sort === "certification" || params.sort === "name" ? params.sort : "certification";

  list.sort((a, b) => {
    if (sortMode === "name") {
      return (a.clinic_name ?? "").localeCompare(b.clinic_name ?? "");
    }
    if (sortMode === "public_cases") {
      const pa = a.public_case_count ?? 0;
      const pb = b.public_case_count ?? 0;
      if (pb !== pa) return pb - pa;
      return (a.clinic_name ?? "").localeCompare(b.clinic_name ?? "");
    }
    // certification (default): tier first, then public cases, then name
    const tierA = tierRank(a.current_award_tier);
    const tierB = tierRank(b.current_award_tier);
    if (tierB !== tierA) return tierB - tierA;
    const pa = a.public_case_count ?? 0;
    const pb = b.public_case_count ?? 0;
    if (pb !== pa) return pb - pa;
    return (a.clinic_name ?? "").localeCompare(b.clinic_name ?? "");
  });

  return list;
}
