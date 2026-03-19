/**
 * Lightweight certification engine for HairAudit.
 * Uses existing public case data only; no schema changes.
 */

export { evaluateCertification, certificationResultToProgress } from "./evaluate";
export { isCaseEligible } from "./eligibility";
export { computeCertificationMetrics } from "./metrics";
export { getTierFromMetrics, getNextTierKey } from "./tier";
export {
  computeProgressToNextTier,
  getHelpingReasons,
  getLimitingReasons,
} from "./progress";
export { CERTIFICATION_TIER_RULES, TIER_ORDER, ELIGIBILITY_MIN_CONFIDENCE, ELIGIBILITY_MIN_INTEGRITY } from "./constants";
export type {
  CertificationTierKey,
  CaseRowForCert,
  ReportSummaryForCert,
  CaseWithReportForCert,
  CertificationMetrics,
  CertificationResult,
  CaseEligibility,
} from "./types";
