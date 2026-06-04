// PATCH /api/surgery-upload/audit-intake/[intakeId] — Stage 6C
// AUDITOR/ADMIN-ONLY management of an audit intake queue record. Lets an auditor
// triage a handed-off mobile surgery upload: change status (with validated
// transitions + timestamps), priority, assignment, and notes.
//
// IMPORTANT SAFETY MODEL:
//   This route NEVER triggers report generation, NEVER calls /api/submit, NEVER
//   sends Inngest events, and NEVER mutates cases.status. status = processing /
//   completed are workflow markers only in Stage 6C; Stage 7 will connect them to
//   real report generation.
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import {
  canManageAuditIntake,
  isValidAuditIntakeTransition,
  normalizeAuditIntakeStatus,
  sanitizeAuditIntakePatch,
  type AuditIntakeRow,
  type AuditIntakeStatus,
} from "@/lib/surgeryUpload/auditIntake";
import { logEvidenceEvent } from "@/lib/surgeryUpload/logEvidenceEvent";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/surgery-upload/audit-intake]";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Build the timestamp columns to write for a status change. Moving back to
 * `pending` is a full reset (we clear started/completed/failed/cancelled + error)
 * so the record reflects an active, not-yet-started item; the lifecycle story is
 * preserved in surgery_upload_evidence_events, not in stale timestamps.
 */
function timestampsForStatus(
  status: AuditIntakeStatus,
  current: AuditIntakeRow,
  now: string
): Record<string, string | null> {
  switch (status) {
    case "processing":
      return { started_at: current.started_at ?? now };
    case "completed":
      return { completed_at: now };
    case "failed":
      return { failed_at: now };
    case "cancelled":
      return { cancelled_at: now };
    case "pending":
      return {
        started_at: null,
        completed_at: null,
        failed_at: null,
        cancelled_at: null,
        error_message: null,
      };
    default:
      return {};
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ intakeId: string }> }
) {
  try {
    const { intakeId } = await ctx.params;
    if (!intakeId || !UUID_RE.test(intakeId)) {
      return NextResponse.json({ ok: false, error: "Invalid intake id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const auth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Auditor/admin only. Clinics/doctors/patients can never manage intake records.
    const actor = await resolveSurgeryUploadActor(user);
    if (!canManageAuditIntake(actor)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const sanitized = sanitizeAuditIntakePatch(body);
    if ("error" in sanitized) {
      return NextResponse.json({ ok: false, error: sanitized.error }, { status: 400 });
    }
    const patch = sanitized.patch;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: current } = await admin
      .from("surgery_upload_audit_intake")
      .select("*")
      .eq("id", intakeId)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ ok: false, error: "Intake record not found" }, { status: 404 });
    }
    const row = current as AuditIntakeRow;
    const fromStatus = normalizeAuditIntakeStatus(row.status);

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {};

    // ---- Status transition --------------------------------------------------
    const statusChanged = patch.status !== undefined && patch.status !== fromStatus;
    if (patch.status !== undefined && statusChanged) {
      if (!isValidAuditIntakeTransition(fromStatus, patch.status)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Cannot change intake status from ${fromStatus} to ${patch.status}.`,
          },
          { status: 409 }
        );
      }
      update.status = patch.status;
      Object.assign(update, timestampsForStatus(patch.status, row, now));
    }

    // ---- Priority / assignment / notes --------------------------------------
    const priorityChanged = patch.priority !== undefined && patch.priority !== row.priority;
    if (priorityChanged) update.priority = patch.priority;

    const assignedChanged =
      patch.assignedTo !== undefined && (patch.assignedTo ?? null) !== (row.assigned_to ?? null);
    if (patch.assignedTo !== undefined) update.assigned_to = patch.assignedTo;

    const intakeNotesChanged =
      patch.intakeNotes !== undefined && (patch.intakeNotes ?? null) !== (row.intake_notes ?? null);
    if (patch.intakeNotes !== undefined) update.intake_notes = patch.intakeNotes;

    const reviewerNotesChanged =
      patch.reviewerNotes !== undefined &&
      (patch.reviewerNotes ?? null) !== (row.reviewer_notes ?? null);
    if (patch.reviewerNotes !== undefined) update.reviewer_notes = patch.reviewerNotes;

    if (Object.keys(update).length === 0) {
      // Nothing actually changed; return the current row unchanged.
      return NextResponse.json({ ok: true, intake: row, unchanged: true });
    }

    const { data: updated, error: updErr } = await admin
      .from("surgery_upload_audit_intake")
      .update(update)
      .eq("id", intakeId)
      .select("*")
      .maybeSingle();
    if (updErr || !updated) {
      console.error(LOG_PREFIX, "update failed", { intakeId, error: updErr?.message });
      return NextResponse.json(
        { ok: false, error: "Could not update intake record." },
        { status: 500 }
      );
    }

    // ---- Timeline events (sanitized; no raw metadata / internal ids) ---------
    if (statusChanged && patch.status !== undefined) {
      await logEvidenceEvent(admin, {
        caseId: row.case_id,
        actorId: user.id,
        eventType: "audit_intake_status_changed",
        metadata: { from: fromStatus, to: patch.status },
      });
    }
    const otherChanged =
      priorityChanged || assignedChanged || intakeNotesChanged || reviewerNotesChanged;
    if (otherChanged) {
      await logEvidenceEvent(admin, {
        caseId: row.case_id,
        actorId: user.id,
        eventType: "audit_intake_updated",
        metadata: {
          ...(priorityChanged ? { priority: patch.priority } : {}),
          ...(assignedChanged
            ? { assignedChanged: true, assigned: patch.assignedTo != null }
            : {}),
          ...(intakeNotesChanged || reviewerNotesChanged ? { notesUpdated: true } : {}),
        },
      });
    }

    return NextResponse.json({ ok: true, intake: updated as AuditIntakeRow });
  } catch (e) {
    console.error(LOG_PREFIX, "unhandled error", e);
    return NextResponse.json(
      { ok: false, error: "Could not update intake record." },
      { status: 500 }
    );
  }
}
