/**
 * HA-PHOTO-TIMELINE-2A — Attach an upload row to a photo session (overlay only).
 */

import type { PhotoSessionImageRole } from "@/lib/photoSessions/types";

export type AttachUploadToPhotoSessionArgs = {
  uploadId: string;
  photoSessionId: string;
  role: PhotoSessionImageRole;
  roleConfidence?: number;
  confirmedRole?: PhotoSessionImageRole | null;
  qualityStatus?: "ok" | "low" | "unusable" | "unknown";
};

export type AttachUploadToPhotoSessionResult = {
  attached: boolean;
  alreadyLinked: boolean;
  imageRowId?: string;
};

/**
 * Idempotent attach: if upload already linked to any session, leave it (return alreadyLinked).
 * Marks first image for a role as canonical when no confirmed canonical exists.
 */
export async function attachUploadToPhotoSession(
  args: AttachUploadToPhotoSessionArgs
): Promise<AttachUploadToPhotoSessionResult> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("hairaudit_photo_session_images")
    .select("id, photo_session_id")
    .eq("upload_id", args.uploadId)
    .maybeSingle();

  if (existing) {
    return {
      attached: false,
      alreadyLinked: true,
      imageRowId: String((existing as { id: string }).id),
    };
  }

  const { data: canonicalExisting } = await admin
    .from("hairaudit_photo_session_images")
    .select("id")
    .eq("photo_session_id", args.photoSessionId)
    .eq("is_canonical_for_role", true)
    .eq("confirmed_role", args.confirmedRole ?? args.role)
    .is("excluded_at", null)
    .limit(1);

  const isCanonical =
    args.role !== "unknown" &&
    args.role !== "other" &&
    !(canonicalExisting && canonicalExisting.length > 0);

  // Also check detected_role canonicals when confirmed is null.
  let canBeCanonical = isCanonical;
  if (canBeCanonical && !args.confirmedRole) {
    const { data: detectedCanonical } = await admin
      .from("hairaudit_photo_session_images")
      .select("id")
      .eq("photo_session_id", args.photoSessionId)
      .eq("is_canonical_for_role", true)
      .eq("detected_role", args.role)
      .is("excluded_at", null)
      .limit(1);
    if (detectedCanonical && detectedCanonical.length > 0) canBeCanonical = false;
  }

  const { data: inserted, error } = await admin
    .from("hairaudit_photo_session_images")
    .insert({
      photo_session_id: args.photoSessionId,
      upload_id: args.uploadId,
      detected_role: args.role,
      confirmed_role: args.confirmedRole ?? null,
      role_confidence: args.roleConfidence ?? 0.95,
      quality_status: args.qualityStatus ?? "unknown",
      is_canonical_for_role: canBeCanonical,
      excluded_at: null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`attachUploadToPhotoSession failed: ${error?.message ?? "no row"}`);
  }

  return {
    attached: true,
    alreadyLinked: false,
    imageRowId: String((inserted as { id: string }).id),
  };
}

export type CreateOrSelectPhotoSessionArgs = {
  caseId: string;
  milestone: import("@/lib/photoSessions/types").PhotoSessionMilestone;
  procedureDate?: string | null;
  source?: import("@/lib/photoSessions/types").PhotoSessionSource;
  milestoneSource?: import("@/lib/photoSessions/types").PhotoSessionMilestoneSource;
  patientConfirmed?: boolean;
};

/**
 * Reuse an active session for the same milestone when present; otherwise create one.
 */
export async function createOrSelectPhotoSession(
  args: CreateOrSelectPhotoSessionArgs
): Promise<{ id: string; created: boolean }> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const {
    relativeDayFromMilestone,
    capturedAtFromProcedureAndRelativeDay,
  } = await import("@/lib/photoSessions/milestones");

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("hairaudit_photo_sessions")
    .select("id")
    .eq("case_id", args.caseId)
    .eq("milestone", args.milestone)
    .eq("status", "active")
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    const id = String((existing[0] as { id: string }).id);
    if (args.patientConfirmed) {
      await admin
        .from("hairaudit_photo_sessions")
        .update({
          patient_confirmed_at: new Date().toISOString(),
          milestone_source: args.milestoneSource ?? "patient",
        })
        .eq("id", id);
    }
    return { id, created: false };
  }

  const relativeDay = relativeDayFromMilestone(args.milestone);
  const capturedAt = capturedAtFromProcedureAndRelativeDay(
    args.procedureDate ?? null,
    relativeDay
  );
  const now = new Date().toISOString();

  const { data: row, error } = await admin
    .from("hairaudit_photo_sessions")
    .insert({
      case_id: args.caseId,
      captured_at: capturedAt,
      uploaded_at: now,
      relative_day: relativeDay,
      milestone: args.milestone,
      milestone_source: args.milestoneSource ?? "patient",
      milestone_confidence: 0.9,
      source: args.source ?? "patient_upload",
      status: "active",
      patient_confirmed_at: args.patientConfirmed ? now : null,
    })
    .select("id")
    .single();

  if (error || !row) {
    throw new Error(`createOrSelectPhotoSession failed: ${error?.message ?? "no row"}`);
  }

  return { id: String((row as { id: string }).id), created: true };
}
