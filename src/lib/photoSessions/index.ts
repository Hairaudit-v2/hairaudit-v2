/**
 * HA-PHOTO-TIMELINE-2A — Photo session public exports.
 */

export * from "@/lib/photoSessions/types";
export * from "@/lib/photoSessions/milestones";
export {
  deriveSessionSummariesFromUploads,
  milestoneFromLegacyCategory,
  roleFromLegacyCategory,
  sessionHasBaselineCore,
  sessionHasFollowUpCore,
  type LegacyUploadSignal,
  type DeriveSessionsContext,
} from "@/lib/photoSessions/deriveSessionsFromUploads";
export {
  resolveAuditEvidenceTimeline,
  resolveAuditEvidenceTimelineFromSessions,
  resolveAuditEvidenceTimelineFromUploads,
} from "@/lib/photoSessions/resolveAuditEvidenceTimeline";
export {
  ensureSessionsFromLegacySignals,
  reconcileLegacyImagesIntoSessions,
  type EnsureSessionsOptions,
  type EnsureSessionsResult,
} from "@/lib/photoSessions/ensureSessionsFromLegacySignals";
