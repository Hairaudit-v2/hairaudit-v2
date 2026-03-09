/**
 * Public-safe data for HairAudit clinic badge and verification widget.
 * Only fields allowed for public embed are included.
 */

export type PublicBadgePayload = {
  clinic_name: string;
  clinic_slug: string;
  current_award_tier: string | null;
  participation_status: string | null;
  city: string | null;
  country: string | null;
  profile_visible: boolean;
};

/** Select string for public badge — must not include private fields. */
export const BADGE_PUBLIC_SELECT =
  "clinic_name, clinic_slug, current_award_tier, participation_status, city, country, profile_visible";

/** Fields that must never appear in badge/widget responses. */
export const BADGE_FORBIDDEN_FIELDS = [
  "clinic_email",
  "linked_user_id",
  "id",
  "contribution_payload",
  "secure_token",
  "transparency_score",
  "audited_case_count",
  "contributed_case_count",
  "benchmark_eligible_count",
  "average_forensic_score",
  "documentation_integrity_average",
  "award_progression_paused",
  "volume_confidence_score",
  "validated_case_count",
  "provisional_high_score_count",
  "validated_high_score_count",
  "low_score_case_count",
  "benchmark_eligible_validated_count",
  "performance_score",
] as const;
