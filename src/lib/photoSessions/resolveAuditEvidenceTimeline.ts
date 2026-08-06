/**
 * HA-PHOTO-TIMELINE-2A — Canonical audit evidence timeline resolver.
 * `current` is never required; latest follow-up is selected by clinical timing.
 */

import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";
import {
  compareClinicalRecency,
  isFollowUpMilestone,
  isMatureFollowUpMilestone,
  parseIsoDateOnly,
} from "@/lib/photoSessions/milestones";
import {
  deriveSessionSummariesFromUploads,
  missingCoreBaselineRoles,
  missingFollowUpCoreHint,
  sessionHasBaselineCore,
  sessionHasFollowUpCore,
  type DeriveSessionsContext,
  type LegacyUploadSignal,
} from "@/lib/photoSessions/deriveSessionsFromUploads";
import type {
  AuditEvidenceLimitation,
  AuditEvidenceRequirement,
  PhotoSessionImageRole,
  PhotoSessionSummary,
  ResolvedAuditEvidenceTimeline,
} from "@/lib/photoSessions/types";

export type ResolveAuditEvidenceTimelineInput = {
  caseId: string;
  pathway: PatientReviewPathway;
  sessions: PhotoSessionSummary[];
  procedureDate?: string | null;
  monthsSinceBand?: string | null;
};

function pickBestBaseline(sessions: PhotoSessionSummary[]): PhotoSessionSummary | null {
  const candidates = sessions.filter(
    (s) =>
      (s.status === "active" || s.status === "needs_review") && s.milestone === "pre_surgery"
  );
  // Incomplete pre_surgery rows (e.g. donor-closeup-only) must not become an
  // authoritative baseline that blocks otherwise-valid follow-up evidence.
  const withCore = candidates.filter((s) => sessionHasBaselineCore(s));
  if (!withCore.length) return null;
  return [...withCore].sort((a, b) => {
    if (b.milestoneConfidence !== a.milestoneConfidence) {
      return b.milestoneConfidence - a.milestoneConfidence;
    }
    return (b.imageCount ?? 0) - (a.imageCount ?? 0);
  })[0]!;
}

function pickSurgeryDay(sessions: PhotoSessionSummary[]): PhotoSessionSummary | null {
  const candidates = sessions.filter(
    (s) =>
      (s.status === "active" || s.status === "needs_review") && s.milestone === "surgery_day"
  );
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => b.milestoneConfidence - a.milestoneConfidence)[0]!;
}

function pickLatestFollowUp(sessions: PhotoSessionSummary[]): {
  latest: PhotoSessionSummary | null;
  intermediate: PhotoSessionSummary[];
} {
  const followUps = sessions.filter(
    (s) =>
      (s.status === "active" || s.status === "needs_review") && isFollowUpMilestone(s.milestone)
  );

  const withCore = followUps.filter((s) => sessionHasFollowUpCore(s));
  // Prefer clinically eligible (core roles) sessions for readiness/comparison.
  const pool = withCore.length > 0 ? withCore : [];

  if (!pool.length) {
    // Fallback: unknown/needs_review sessions with follow-up-like core roles.
    const unknowns = sessions.filter(
      (s) =>
        (s.status === "active" || s.status === "needs_review") &&
        s.milestone === "unknown" &&
        sessionHasFollowUpCore(s)
    );
    if (!unknowns.length) {
      return { latest: null, intermediate: followUps };
    }
    const sortedUnknown = [...unknowns].sort(compareClinicalRecency);
    const latest = sortedUnknown[sortedUnknown.length - 1]!;
    return {
      latest,
      intermediate: [...followUps, ...sortedUnknown.slice(0, -1)],
    };
  }

  const sorted = [...pool].sort(compareClinicalRecency);
  const latest = sorted[sorted.length - 1]!;
  const intermediate = [
    ...followUps.filter((s) => s.id !== latest.id),
  ];
  return { latest, intermediate };
}

function optionalMissingRoles(session: PhotoSessionSummary | null): PhotoSessionImageRole[] {
  if (!session) return [];
  const optional: PhotoSessionImageRole[] = ["left", "right", "crown", "recipient_closeup"];
  const set = new Set(session.rolesPresent);
  return optional.filter((r) => !set.has(r));
}

/** Soft notes (optional views) stay in `limitations` but do not downgrade mature `ready`. */
const SUBSTANTIVE_LIMITATION_CODES = new Set([
  "early_outcome_follow_up",
  "missing_optional_milestone",
  "no_distinct_baseline_session",
  "surgery_day_without_outcome",
  "low_milestone_confidence",
  "needs_review_session",
  "procedure_date_unknown",
]);

function finalizeReadiness(
  base: "ready" | "not_ready",
  limitations: AuditEvidenceLimitation[]
): ResolvedAuditEvidenceTimeline["readiness"] {
  if (base === "not_ready") return "not_ready";
  const hasSubstantive = limitations.some((l) => SUBSTANTIVE_LIMITATION_CODES.has(l.code));
  return hasSubstantive ? "ready_with_limitations" : "ready";
}

function isLegacyCurrentStyleFollowUp(session: PhotoSessionSummary): boolean {
  // Explicit month-banded / early_recovery sessions require a true baseline.
  // Legacy patient_current_* maps to band with medium confidence or needs_review/unknown.
  if (session.milestone === "unknown" || session.milestoneSource === "needs_review") return true;
  if (session.milestoneConfidence < 0.6) return true;
  return false;
}

function buildPreSurgeryReadiness(
  baseline: PhotoSessionSummary | null
): Pick<
  ResolvedAuditEvidenceTimeline,
  "readiness" | "limitations" | "blockingRequirements"
> {
  const limitations: AuditEvidenceLimitation[] = [];
  const blocking: AuditEvidenceRequirement[] = [];

  if (!baseline) {
    blocking.push({
      code: "baseline_session",
      message: "A before-surgery photo session is required.",
    });
    return { readiness: "not_ready", limitations, blockingRequirements: blocking };
  }

  if (!sessionHasBaselineCore(baseline)) {
    const missing = missingCoreBaselineRoles(baseline);
    blocking.push({
      code: "baseline_core_roles",
      message: "Before-surgery photos need front, top, and donor rear views.",
      roles: missing,
    });
    return { readiness: "not_ready", limitations, blockingRequirements: blocking };
  }

  for (const role of optionalMissingRoles(baseline)) {
    limitations.push({
      code: "missing_optional_role",
      message: `Optional view missing: ${role.replaceAll("_", " ")}.`,
      sessionId: baseline.id,
      role,
    });
  }

  return {
    readiness: finalizeReadiness("ready", limitations),
    limitations,
    blockingRequirements: [],
  };
}

function buildPostSurgeryReadiness(args: {
  baseline: PhotoSessionSummary | null;
  surgeryDay: PhotoSessionSummary | null;
  latestFollowUp: PhotoSessionSummary | null;
}): Pick<
  ResolvedAuditEvidenceTimeline,
  "readiness" | "limitations" | "blockingRequirements"
> {
  const limitations: AuditEvidenceLimitation[] = [];
  const blocking: AuditEvidenceRequirement[] = [];
  const { baseline, surgeryDay, latestFollowUp } = args;

  // Pathway wizard still stores “current appearance” under preop_* keys.
  // A sole pre_surgery session with core roles and no follow-up is treated as
  // legacy outcome evidence (ready_with_limitations), not a hard block.
  if (
    baseline &&
    sessionHasBaselineCore(baseline) &&
    !latestFollowUp &&
    !surgeryDay
  ) {
    limitations.push({
      code: "no_distinct_baseline_session",
      message:
        "Photos were allocated as a single appearance set. A separate before-surgery comparison session is recommended when available.",
      sessionId: baseline.id,
    });
    for (const role of optionalMissingRoles(baseline)) {
      limitations.push({
        code: "missing_optional_role",
        message:
          role === "crown"
            ? "A crown view was not included. Add one if available — this does not block the review."
            : `Optional view missing: ${role.replaceAll("_", " ")}.`,
        sessionId: baseline.id,
        role,
      });
    }
    return {
      readiness: finalizeReadiness("ready", limitations),
      limitations,
      blockingRequirements: [],
    };
  }

  // Legacy: patient_current-style (uncertain band) set with core roles and no baseline.
  // Explicit postop_month* sessions are NOT legacy — they still require a baseline session.
  const legacyOnly =
    !baseline &&
    !surgeryDay &&
    latestFollowUp &&
    sessionHasFollowUpCore(latestFollowUp) &&
    isLegacyCurrentStyleFollowUp(latestFollowUp);

  if (legacyOnly && latestFollowUp) {
    limitations.push({
      code: "no_distinct_baseline_session",
      message:
        "No separate before-surgery session was found. Photos allocated as current appearance are used for this review with limitations.",
      sessionId: latestFollowUp.id,
    });
    if (!isMatureFollowUpMilestone(latestFollowUp.milestone) && latestFollowUp.milestone !== "unknown") {
      limitations.push({
        code: "early_outcome_follow_up",
        message: "Follow-up photos are earlier than the preferred six-month outcome window.",
        sessionId: latestFollowUp.id,
        milestone: latestFollowUp.milestone,
      });
    }
    if (latestFollowUp.milestoneConfidence < 0.5) {
      limitations.push({
        code: "low_milestone_confidence",
        message: "Photo timing confidence is low; confirm the capture period when possible.",
        sessionId: latestFollowUp.id,
      });
    }
    for (const role of optionalMissingRoles(latestFollowUp)) {
      if (role === "crown" || role === "left" || role === "right" || role === "recipient_closeup") {
        limitations.push({
          code: "missing_optional_role",
          message:
            role === "crown"
              ? "A crown view was not included. Add one if available — this does not block the review."
              : `Optional view missing: ${role.replaceAll("_", " ")}.`,
          sessionId: latestFollowUp.id,
          role,
        });
      }
    }
    return {
      readiness: finalizeReadiness("ready", limitations),
      limitations,
      blockingRequirements: [],
    };
  }

  if (!baseline || !sessionHasBaselineCore(baseline)) {
    if (!baseline) {
      blocking.push({
        code: "baseline_session",
        message: "A before-surgery photo session is required for comparison.",
      });
    } else {
      blocking.push({
        code: "baseline_core_roles",
        message: "Before-surgery photos need front, top, and donor rear views.",
        roles: missingCoreBaselineRoles(baseline),
      });
    }
  }

  if (latestFollowUp && sessionHasFollowUpCore(latestFollowUp)) {
    if (!isMatureFollowUpMilestone(latestFollowUp.milestone)) {
      limitations.push({
        code: "early_outcome_follow_up",
        message: "Follow-up photos are earlier than the preferred six-month outcome window.",
        sessionId: latestFollowUp.id,
        milestone: latestFollowUp.milestone,
      });
    }
    for (const role of optionalMissingRoles(latestFollowUp)) {
      limitations.push({
        code: "missing_optional_role",
        message:
          role === "crown"
            ? "A crown view was not included. Add one if available — this does not block the review."
            : `Optional view missing: ${role.replaceAll("_", " ")}.`,
        sessionId: latestFollowUp.id,
        role,
      });
    }
    if (latestFollowUp.status === "needs_review" || latestFollowUp.milestoneConfidence < 0.5) {
      limitations.push({
        code: "low_milestone_confidence",
        message: "Photo timing confidence is low; confirm the capture period when possible.",
        sessionId: latestFollowUp.id,
      });
    }

    if (blocking.length) {
      return { readiness: "not_ready", limitations, blockingRequirements: blocking };
    }
    return {
      readiness: finalizeReadiness("ready", limitations),
      limitations,
      blockingRequirements: [],
    };
  }

  // Procedure reconstruction: baseline + surgery day, no outcome yet.
  if (
    baseline &&
    sessionHasBaselineCore(baseline) &&
    surgeryDay &&
    (surgeryDay.rolesPresent.includes("front") || surgeryDay.imageCount > 0)
  ) {
    limitations.push({
      code: "surgery_day_without_outcome",
      message:
        "Surgery-day photos support procedure reconstruction. An outcome follow-up session is still recommended.",
      sessionId: surgeryDay.id,
    });
    return {
      readiness: "ready_with_limitations",
      limitations,
      blockingRequirements: [],
    };
  }

  if (!latestFollowUp) {
    blocking.push({
      code: "follow_up_session",
      message: "A after-surgery photo session is required (or surgery-day photos for procedure reconstruction).",
    });
  } else if (!sessionHasFollowUpCore(latestFollowUp)) {
    blocking.push({
      code: "follow_up_core_roles",
      message: "After-surgery photos need front, top, and either donor rear or crown.",
      roles: missingFollowUpCoreHint(latestFollowUp),
    });
  }

  if (!blocking.length) {
    blocking.push({
      code: "any_eligible_postop_session",
      message: "Eligible postoperative photo evidence is incomplete.",
    });
  }

  return { readiness: "not_ready", limitations, blockingRequirements: blocking };
}

/**
 * Resolve evidence timeline from session summaries (pure).
 */
export function resolveAuditEvidenceTimelineFromSessions(
  input: ResolveAuditEvidenceTimelineInput
): ResolvedAuditEvidenceTimeline {
  const activeSessions = input.sessions.filter(
    (s) => s.status === "active" || s.status === "needs_review"
  );

  const baselineSession = pickBestBaseline(activeSessions);
  const surgeryDaySession = pickSurgeryDay(activeSessions);
  const { latest: latestFollowUpSession, intermediate: intermediateSessions } =
    pickLatestFollowUp(activeSessions);

  let recommendedComparison: ResolvedAuditEvidenceTimeline["recommendedComparison"] = null;
  if (baselineSession && latestFollowUpSession) {
    recommendedComparison = {
      fromSessionId: baselineSession.id,
      toSessionId: latestFollowUpSession.id,
    };
  } else if (baselineSession && surgeryDaySession) {
    recommendedComparison = {
      fromSessionId: baselineSession.id,
      toSessionId: surgeryDaySession.id,
    };
  }

  const readinessParts =
    input.pathway === "pre_surgery"
      ? buildPreSurgeryReadiness(baselineSession)
      : buildPostSurgeryReadiness({
          baseline: baselineSession,
          surgeryDay: surgeryDaySession,
          latestFollowUp: latestFollowUpSession,
        });

  if (!input.procedureDate && input.pathway === "post_surgery") {
    readinessParts.limitations.push({
      code: "procedure_date_unknown",
      message: "Procedure date is unknown; timing bands may be approximate.",
    });
    if (readinessParts.readiness !== "not_ready") {
      readinessParts.readiness = finalizeReadiness("ready", readinessParts.limitations);
    }
  }

  return {
    baselineSession,
    surgeryDaySession,
    latestFollowUpSession,
    intermediateSessions,
    recommendedComparison,
    readiness: readinessParts.readiness,
    limitations: readinessParts.limitations,
    blockingRequirements: readinessParts.blockingRequirements,
  };
}

export type ResolveFromUploadsArgs = {
  caseId: string;
  pathway: PatientReviewPathway;
  uploads: LegacyUploadSignal[];
  procedureDate?: string | null;
  monthsSinceBand?: string | null;
  /** When provided, preferred over deriving from uploads. */
  sessions?: PhotoSessionSummary[];
};

/**
 * Gate-friendly entry: derive sessions from uploads (or use provided sessions) and resolve.
 */
export function resolveAuditEvidenceTimelineFromUploads(
  args: ResolveFromUploadsArgs
): ResolvedAuditEvidenceTimeline {
  const ctx: DeriveSessionsContext = {
    caseId: args.caseId,
    procedureDate: parseIsoDateOnly(args.procedureDate) ?? args.procedureDate ?? null,
    monthsSinceBand: args.monthsSinceBand ?? null,
  };
  const sessions =
    args.sessions && args.sessions.length > 0
      ? args.sessions
      : deriveSessionSummariesFromUploads(args.uploads, ctx);

  return resolveAuditEvidenceTimelineFromSessions({
    caseId: args.caseId,
    pathway: args.pathway,
    sessions,
    procedureDate: ctx.procedureDate,
    monthsSinceBand: ctx.monthsSinceBand,
  });
}

/**
 * Async case-scoped resolver. Loads uploads + sessions, ensures legacy bridge when empty,
 * then resolves. Soft-fails to upload derivation if session tables are unavailable.
 */
export async function resolveAuditEvidenceTimeline(
  caseId: string,
  opts?: {
    pathway?: PatientReviewPathway;
    patientAnswers?: Record<string, unknown> | null;
    uploadRows?: LegacyUploadSignal[];
  }
): Promise<ResolvedAuditEvidenceTimeline> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const { normalizePatientReviewPathway } = await import("@/lib/patient/patientReviewPathway");
  const { readMonthsSinceFromPatientAnswers } = await import(
    "@/lib/patientPhoto/patientPhotoReadinessPolicy"
  );
  const { reconcileLegacyImagesIntoSessions } = await import(
    "@/lib/photoSessions/reconcileLegacyImagesIntoSessions"
  );

  const admin = createSupabaseAdminClient();

  let pathway = opts?.pathway;
  let procedureDate: string | null = null;
  let monthsSinceBand: string | null = null;
  let uploads = opts?.uploadRows ?? [];

  if (!pathway || !opts?.patientAnswers) {
    const { data: caseRow } = await admin
      .from("cases")
      .select("id, patient_review_pathway")
      .eq("id", caseId)
      .maybeSingle();
    pathway = normalizePatientReviewPathway(
      pathway ?? (caseRow as { patient_review_pathway?: string | null } | null)?.patient_review_pathway
    );
  } else {
    pathway = normalizePatientReviewPathway(pathway);
  }

  const answers = opts?.patientAnswers ?? null;
  if (answers) {
    monthsSinceBand = readMonthsSinceFromPatientAnswers(answers);
    const raw = answers.procedure_date ?? answers.procedureDate;
    procedureDate = typeof raw === "string" ? raw : null;
  } else {
    const { data: reportRow } = await admin
      .from("reports")
      .select("summary, patient_audit_version, patient_audit_v2")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { normalizedPatientAnswersFromReportRow } = await import(
      "@/lib/patient/answersFromReportRow"
    );
    const patientAnswers = normalizedPatientAnswersFromReportRow(reportRow);
    monthsSinceBand = readMonthsSinceFromPatientAnswers(patientAnswers);
    const raw = patientAnswers?.procedure_date ?? patientAnswers?.procedureDate;
    procedureDate = typeof raw === "string" ? raw : null;
  }

  if (!opts?.uploadRows) {
    const { data: uploadRows } = await admin
      .from("uploads")
      .select("id, type, metadata, created_at")
      .eq("case_id", caseId);
    uploads = (uploadRows ?? []) as LegacyUploadSignal[];
  }

  let sessions: PhotoSessionSummary[] = [];
  try {
    await reconcileLegacyImagesIntoSessions(caseId, {
      uploads,
      procedureDate,
      monthsSinceBand,
    });
    sessions = await loadSessionSummariesForCase(admin, caseId);
  } catch {
    sessions = [];
  }

  return resolveAuditEvidenceTimelineFromUploads({
    caseId,
    pathway,
    uploads,
    procedureDate,
    monthsSinceBand,
    sessions: sessions.length ? sessions : undefined,
  });
}

async function loadSessionSummariesForCase(
  admin: ReturnType<Awaited<typeof import("@/lib/supabase/admin")>["createSupabaseAdminClient"]>,
  caseId: string
): Promise<PhotoSessionSummary[]> {
  const { data: sessionRows, error } = await admin
    .from("hairaudit_photo_sessions")
    .select(
      "id, case_id, captured_at, uploaded_at, relative_day, milestone, milestone_source, milestone_confidence, status"
    )
    .eq("case_id", caseId);

  if (error || !sessionRows?.length) return [];

  const sessionIds = sessionRows.map((r) => String((r as { id: string }).id));
  const { data: imageRows } = await admin
    .from("hairaudit_photo_session_images")
    .select(
      "photo_session_id, detected_role, confirmed_role, excluded_at, is_canonical_for_role"
    )
    .in("photo_session_id", sessionIds);

  const rolesBySession = new Map<string, Set<PhotoSessionImageRole>>();
  const countBySession = new Map<string, number>();

  for (const raw of imageRows ?? []) {
    const row = raw as {
      photo_session_id: string;
      detected_role: string;
      confirmed_role: string | null;
      excluded_at: string | null;
    };
    if (row.excluded_at) continue;
    const sid = row.photo_session_id;
    const role = (row.confirmed_role || row.detected_role || "unknown") as PhotoSessionImageRole;
    if (!rolesBySession.has(sid)) rolesBySession.set(sid, new Set());
    rolesBySession.get(sid)!.add(role);
    countBySession.set(sid, (countBySession.get(sid) ?? 0) + 1);
  }

  return sessionRows.map((raw) => {
    const s = raw as {
      id: string;
      case_id: string;
      captured_at: string | null;
      uploaded_at: string;
      relative_day: number | null;
      milestone: PhotoSessionSummary["milestone"];
      milestone_source: PhotoSessionSummary["milestoneSource"];
      milestone_confidence: number;
      status: PhotoSessionSummary["status"];
    };
    return {
      id: s.id,
      caseId: s.case_id,
      milestone: s.milestone,
      capturedAt: s.captured_at,
      uploadedAt: s.uploaded_at,
      relativeDay: s.relative_day,
      milestoneSource: s.milestone_source,
      milestoneConfidence: Number(s.milestone_confidence),
      status: s.status,
      rolesPresent: [...(rolesBySession.get(s.id) ?? [])],
      imageCount: countBySession.get(s.id) ?? 0,
    };
  });
}

/** @internal exported for tests */
export const __test = {
  pickBestBaseline,
  pickSurgeryDay,
  pickLatestFollowUp,
  buildPostSurgeryReadiness,
};
