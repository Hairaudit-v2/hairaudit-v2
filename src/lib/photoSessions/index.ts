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
export {
  buildReconcileUploadSignals,
  latestCorrectionCategoryByUploadId,
  weakCategoryFromFilename,
  type ReconcileUploadSignal,
  type UploadAuditCorrectionRow,
} from "@/lib/photoSessions/reconcileSignals";
export {
  groupUploadsIntoSessionCandidates,
  SESSION_CLUSTER_WINDOW_MS,
  type SessionCandidate,
} from "@/lib/photoSessions/groupUploadsIntoSessionCandidates";
export {
  attachUploadToPhotoSession,
  createOrSelectPhotoSession,
} from "@/lib/photoSessions/attachUploadToPhotoSession";
