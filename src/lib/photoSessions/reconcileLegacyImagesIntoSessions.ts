/**
 * HA-PHOTO-TIMELINE-2A Phase C — Persist session overlay from multi-signal grouping.
 * Additive only: never merges existing sessions; never rewrites uploads.type.
 */

import {
  relativeDayFromMilestone,
  capturedAtFromProcedureAndRelativeDay,
} from "@/lib/photoSessions/milestones";
import { roleFromLegacyCategory, type LegacyUploadSignal } from "@/lib/photoSessions/deriveSessionsFromUploads";
import { groupUploadsIntoSessionCandidates } from "@/lib/photoSessions/groupUploadsIntoSessionCandidates";
import {
  buildReconcileUploadSignals,
  type UploadAuditCorrectionRow,
} from "@/lib/photoSessions/reconcileSignals";
import type { PhotoSessionImageRole, PhotoSessionSource } from "@/lib/photoSessions/types";

export type ReconcileOptions = {
  uploads?: LegacyUploadSignal[];
  corrections?: UploadAuditCorrectionRow[];
  procedureDate?: string | null;
  monthsSinceBand?: string | null;
  dryRun?: boolean;
};

export type ReconcileResult = {
  created: boolean;
  sessionCount: number;
  imageCount: number;
  linkedOnly: boolean;
  skippedReason?: "no_patient_photos" | "nothing_to_link" | "dry_run";
};

export async function reconcileLegacyImagesIntoSessions(
  caseId: string,
  opts: ReconcileOptions = {}
): Promise<ReconcileResult> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();

  let uploads = opts.uploads;
  if (!uploads) {
    const { data: uploadRows, error: uploadError } = await admin
      .from("uploads")
      .select("id, type, metadata, created_at")
      .eq("case_id", caseId);
    if (uploadError) throw new Error(`uploads load failed: ${uploadError.message}`);
    uploads = (uploadRows ?? []) as LegacyUploadSignal[];
  }

  let corrections = opts.corrections;
  if (!corrections) {
    const { data: correctionRows } = await admin
      .from("upload_audit_corrections")
      .select("upload_id, action, new_category, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    corrections = (correctionRows ?? []) as UploadAuditCorrectionRow[];
  }

  const allSignals = buildReconcileUploadSignals(uploads, corrections);
  if (!allSignals.length) {
    return {
      created: false,
      sessionCount: 0,
      imageCount: 0,
      linkedOnly: false,
      skippedReason: "no_patient_photos",
    };
  }

  const { data: linkedRows } = await admin
    .from("hairaudit_photo_session_images")
    .select("upload_id, photo_session_id")
    .in(
      "upload_id",
      allSignals.map((s) => s.uploadId)
    );

  const linkedIds = new Set((linkedRows ?? []).map((r) => String((r as { upload_id: string }).upload_id)));
  const unlinked = allSignals.filter((s) => !linkedIds.has(s.uploadId));

  if (!unlinked.length) {
    return {
      created: false,
      sessionCount: 0,
      imageCount: 0,
      linkedOnly: true,
      skippedReason: "nothing_to_link",
    };
  }

  const candidates = groupUploadsIntoSessionCandidates(unlinked, {
    monthsSinceBand: opts.monthsSinceBand ?? null,
  });

  if (opts.dryRun) {
    return {
      created: false,
      sessionCount: candidates.length,
      imageCount: unlinked.length,
      linkedOnly: linkedIds.size > 0,
      skippedReason: "dry_run",
    };
  }

  let sessionCount = 0;
  let imageCount = 0;
  const source: PhotoSessionSource = "reconciliation";

  for (const candidate of candidates) {
    const relativeDay = relativeDayFromMilestone(candidate.milestone);
    const capturedAt = capturedAtFromProcedureAndRelativeDay(
      opts.procedureDate ?? null,
      relativeDay
    );
    const uploadedAt =
      candidate.uploads
        .map((u) => u.createdAt)
        .filter((v): v is string => Boolean(v))
        .sort()
        .at(-1) ?? new Date().toISOString();

    const { data: sessionRow, error: sessionError } = await admin
      .from("hairaudit_photo_sessions")
      .insert({
        case_id: caseId,
        captured_at: capturedAt,
        uploaded_at: uploadedAt,
        relative_day: relativeDay,
        milestone: candidate.milestone,
        milestone_source: candidate.milestoneSource,
        milestone_confidence: candidate.confidence,
        source,
        status: candidate.status,
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

    for (const signal of candidate.uploads) {
      const role = roleFromLegacyCategory(signal.effectiveCategory);
      const isCanonical = !roleSeen.has(role) && role !== "unknown" && role !== "other";
      if (isCanonical) roleSeen.add(role);

      imageInserts.push({
        photo_session_id: sessionId,
        upload_id: signal.uploadId,
        detected_role: role,
        confirmed_role: null,
        role_confidence: Math.min(0.85, Math.max(0.4, candidate.confidence)),
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

  return {
    created: sessionCount > 0,
    sessionCount,
    imageCount,
    linkedOnly: linkedIds.size > 0,
  };
}
