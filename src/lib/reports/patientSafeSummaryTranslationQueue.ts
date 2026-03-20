import type { ReportNarrativeTranslationReviewStatus, ReportNarrativeTranslationStatus } from "@/lib/i18n/reportTranslationBlueprint";

export type PatientSafeSummaryTranslationQueueStatus =
  | "missing_translation"
  | "generated_unreviewed"
  | "approved"
  | "rejected"
  | "stale";

export type PatientSafeSummaryTranslationQueueItem = {
  caseId: string;
  caseTitle: string;
  reportId: string;
  reportVersion: number;
  targetLocale: "es";
  status: PatientSafeSummaryTranslationQueueStatus;
  translationStatus: ReportNarrativeTranslationStatus | "not_available";
  reviewStatus: ReportNarrativeTranslationReviewStatus | "not_available";
  fallbackCurrentlyEnglish: boolean;
  updatedAt: string | null;
  translatedAt: string | null;
  reviewedAt: string | null;
};

export function derivePatientSafeSummaryQueueStatus(args: {
  hasTranslation: boolean;
  translationStatus?: ReportNarrativeTranslationStatus | null;
  reviewStatus?: ReportNarrativeTranslationReviewStatus | null;
}): PatientSafeSummaryTranslationQueueStatus {
  if (!args.hasTranslation) return "missing_translation";
  if (args.translationStatus === "stale_due_to_source_change") return "stale";
  if (args.reviewStatus === "rejected") return "rejected";
  if (args.translationStatus === "reviewed_approved" && args.reviewStatus === "approved") return "approved";
  return "generated_unreviewed";
}

export function shouldFallbackToEnglishInQueue(status: PatientSafeSummaryTranslationQueueStatus): boolean {
  return status === "missing_translation" || status === "stale" || status === "rejected";
}

export type PatientSafeSummaryQueueFilters = {
  status?: "all" | PatientSafeSummaryTranslationQueueStatus;
  review?: "all" | ReportNarrativeTranslationReviewStatus | "not_available";
  freshness?: "all" | "current" | "stale";
  sort?: "updated_desc" | "updated_asc";
};

export function filterAndSortPatientSafeSummaryQueue(
  items: PatientSafeSummaryTranslationQueueItem[],
  filters: PatientSafeSummaryQueueFilters
): PatientSafeSummaryTranslationQueueItem[] {
  const filtered = items.filter((item) => {
    if (filters.status && filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.review && filters.review !== "all" && item.reviewStatus !== filters.review) return false;
    if (filters.freshness === "current" && item.status === "stale") return false;
    if (filters.freshness === "stale" && item.status !== "stale") return false;
    return true;
  });

  const sort = filters.sort ?? "updated_desc";
  return [...filtered].sort((a, b) => {
    const aTs = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTs = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return sort === "updated_asc" ? aTs - bTs : bTs - aTs;
  });
}

