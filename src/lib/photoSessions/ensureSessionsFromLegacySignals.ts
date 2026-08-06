/**
 * HA-PHOTO-TIMELINE-2A — Non-destructive legacy → photo session bridge.
 * Does not rewrite uploads.type / metadata.category.
 */

import {
  deriveSessionSummariesFromUploads,
  milestoneFromLegacyCategory,
  roleFromLegacyCategory,
  type LegacyUploadSignal,
} from "@/lib/photoSessions/deriveSessionsFromUploads";
import {
  capturedAtFromProcedureAndRelativeDay,
  relativeDayFromMilestone,
} from "@/lib/photoSessions/milestones";
import type {
  PhotoSessionImageRole,
  PhotoSessionMilestone,
  PhotoSessionMilestoneSource,
  PhotoSessionSource,
  PhotoSessionStatus,
} from "@/lib/photoSessions/types";

export type EnsureSessionsOptions = {
  uploads?: LegacyUploadSignal[];
  procedureDate?: string | null;
  monthsSinceBand?: string | null;
  /** When true, skip DB write and only return whether work would be needed. */
  dryRun?: boolean;
};

export type EnsureSessionsResult = {
  created: boolean;
  sessionCount: number;
  imageCount: number;
  skippedReason?: "already_has_sessions" | "no_patient_photos" | "dry_run";
};

function categoryFromUpload(u: LegacyUploadSignal): string | null {
  const fromType = String(u.type ?? "").trim();
  if (fromType.toLowerCase().startsWith("patient_photo:")) {
    return fromType.slice("patient_photo:".length).trim().toLowerCase();
  }
  const meta =
    u.metadata && typeof u.metadata === "object" && !Array.isArray(u.metadata)
      ? (u.metadata as Record<string, unknown>)
      : null;
  if (meta && typeof meta.category === "string" && meta.category.trim()) {
    return meta.category.trim().toLowerCase();
  }
  return null;
}

/**
 * If the case has no active/needs_review photo sessions, group existing patient
 * uploads by legacy category milestone and persist overlay sessions.
 */
export async function ensureSessionsFromLegacySignals(
  caseId: string,
  opts: EnsureSessionsOptions = {}
): Promise<EnsureSessionsResult> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("hairaudit_photo_sessions")
    .select("id")
    .eq("case_id", caseId)
    .in("status", ["active", "needs_review"])
    .limit(1);

  if (existingError) {
    // Table may not exist yet in some environments — surface as skip for callers.
    throw new Error(`photo_sessions lookup failed: ${existingError.message}`);
  }

  if (existing && existing.length > 0) {
    return {
      created: false,
      sessionCount: 0,
      imageCount: 0,
      skippedReason: "already_has_sessions",
    };
  }

  let uploads = opts.uploads;
  if (!uploads) {
    const { data: uploadRows, error: uploadError } = await admin
      .from("uploads")
      .select("id, type, metadata, created_at")
      .eq("case_id", caseId);
    if (uploadError) throw new Error(`uploads load failed: ${uploadError.message}`);
    uploads = (uploadRows ?? []) as LegacyUploadSignal[];
  }

  const patientUploads = uploads.filter((u) => categoryFromUpload(u));
  if (!patientUploads.length) {
    return {
      created: false,
      sessionCount: 0,
      imageCount: 0,
      skippedReason: "no_patient_photos",
    };
  }

  if (opts.dryRun) {
    const summaries = deriveSessionSummariesFromUploads(patientUploads, {
      caseId,
      procedureDate: opts.procedureDate ?? null,
      monthsSinceBand: opts.monthsSinceBand ?? null,
    });
    return {
      created: false,
      sessionCount: summaries.length,
      imageCount: patientUploads.length,
      skippedReason: "dry_run",
    };
  }

  // Group uploads the same way as pure derivation.
  type Group = {
    milestone: PhotoSessionMilestone;
    milestoneSource: PhotoSessionMilestoneSource;
    confidence: number;
    status: PhotoSessionStatus;
    uploads: LegacyUploadSignal[];
  };

  const groups = new Map<string, Group>();
  for (const u of patientUploads) {
    const category = categoryFromUpload(u)!;
    const inferred = milestoneFromLegacyCategory(category, opts.monthsSinceBand ?? null);
    const key = `${inferred.milestone}|${inferred.source === "needs_review" ? "review" : "ok"}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        milestone: inferred.milestone,
        milestoneSource: inferred.source,
        confidence: inferred.confidence,
        status: inferred.source === "needs_review" ? "needs_review" : "active",
        uploads: [],
      };
      groups.set(key, g);
    }
    g.uploads.push(u);
    g.confidence = Math.max(g.confidence, inferred.confidence);
  }

  let sessionCount = 0;
  let imageCount = 0;

  for (const g of groups.values()) {
    const relativeDay = relativeDayFromMilestone(g.milestone);
    const capturedAt = capturedAtFromProcedureAndRelativeDay(
      opts.procedureDate ?? null,
      relativeDay
    );
    const uploadedAt = g.uploads
      .map((u) => u.created_at)
      .filter((v): v is string => typeof v === "string" && Boolean(v))
      .sort()
      .at(-1) ?? new Date().toISOString();

    const source: PhotoSessionSource = "reconciliation";
    const { data: sessionRow, error: sessionError } = await admin
      .from("hairaudit_photo_sessions")
      .insert({
        case_id: caseId,
        captured_at: capturedAt,
        uploaded_at: uploadedAt,
        relative_day: relativeDay,
        milestone: g.milestone,
        milestone_source: g.milestoneSource,
        milestone_confidence: g.confidence,
        source,
        status: g.status,
      })
      .select("id")
      .single();

    if (sessionError || !sessionRow) {
      throw new Error(`photo_session insert failed: ${sessionError?.message ?? "no row"}`);
    }

    sessionCount += 1;
    const sessionId = String((sessionRow as { id: string }).id);

    const roleSeen = new Set<PhotoSessionImageRole>();
    const imageInserts = [];

    for (const u of g.uploads) {
      if (!u.id) continue;
      const category = categoryFromUpload(u)!;
      const role = roleFromLegacyCategory(category);
      const isCanonical = !roleSeen.has(role) && role !== "unknown" && role !== "other";
      if (isCanonical) roleSeen.add(role);

      imageInserts.push({
        photo_session_id: sessionId,
        upload_id: u.id,
        detected_role: role,
        confirmed_role: null,
        role_confidence: 0.6,
        quality_status: "unknown",
        is_canonical_for_role: isCanonical,
        excluded_at: null,
      });
    }

    if (imageInserts.length) {
      const { error: imageError } = await admin
        .from("hairaudit_photo_session_images")
        .insert(imageInserts);
      if (imageError) {
        throw new Error(`photo_session_images insert failed: ${imageError.message}`);
      }
      imageCount += imageInserts.length;
    }
  }

  return { created: true, sessionCount, imageCount };
}

/**
 * Phase C entrypoint (stub). Currently delegates to the minimal legacy bridge.
 * Future: upload batches, projection/audit refs, filename weak signals, low-confidence splits.
 */
export async function reconcileLegacyImagesIntoSessions(
  caseId: string,
  opts?: EnsureSessionsOptions
): Promise<EnsureSessionsResult> {
  return ensureSessionsFromLegacySignals(caseId, opts);
}
