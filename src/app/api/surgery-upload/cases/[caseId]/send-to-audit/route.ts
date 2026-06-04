// POST /api/surgery-upload/cases/[caseId]/send-to-audit — Stage 6B
// Controlled, AUDITOR-ONLY handoff of a submitted + ready_for_audit mobile surgery
// upload into the HairAudit audit workflow.
//
// IMPORTANT SAFETY MODEL (Option C — controlled marker):
//   The existing audit pipeline (/api/submit + Inngest "case/submitted") is NOT
//   safe to call directly for surgery uploads: it explicitly forbids auditors,
//   validates patient/doctor/clinic photo categories, and depends on audit_type /
//   submission_channel semantics surgery uploads do not have. There is also no
//   dedicated audit queue table. So Stage 6B records a controlled MARKER only:
//   it sets audit_handoff_status = sent and logs an event. It does NOT mutate
//   cases.status and does NOT send any Inngest event. Stage 6C will connect this
//   marker to the real engine. Becoming ready_for_audit never auto-triggers this —
//   the auditor must call this route explicitly.
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import { getSurgeryRequirementFailures } from "@/lib/surgeryUpload/checklist";
import {
  AUDIT_HANDOFF_PIPELINE_MODE,
  canTriggerAuditHandoff,
  computeAuditHandoffEligibility,
  normalizeAuditHandoffStatus,
} from "@/lib/surgeryUpload/auditHandoff";
import { logEvidenceEvent } from "@/lib/surgeryUpload/logEvidenceEvent";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/surgery-upload/send-to-audit]";
const MAX_NOTES = 2000;

function trimNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t === "" ? null : t.slice(0, MAX_NOTES);
}

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    if (!caseId) {
      return NextResponse.json({ ok: false, error: "Missing caseId" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const notes = trimNotes(body.notes);

    const auth = await createSupabaseAuthServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Auditor/admin only. Clinics/doctors/patients can never trigger handoff.
    const actor = await resolveSurgeryUploadActor(user);
    if (!canTriggerAuditHandoff(actor)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // Case access is enforced independently of clinic_profile_id (never a grant).
    const { data: c } = await admin
      .from("cases")
      .select("id, user_id, patient_id, doctor_id, clinic_id")
      .eq("id", caseId)
      .maybeSingle();
    if (!c || !(await canAccessCase(user.id, c))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data: existing } = await admin
      .from("surgery_upload_details")
      .select(
        "id, status, evidence_review_status, audit_handoff_status, photo_checklist_config"
      )
      .eq("case_id", caseId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Surgery upload not found for this case" },
        { status: 404 }
      );
    }

    const currentHandoff = normalizeAuditHandoffStatus(existing.audit_handoff_status);

    // ---- Idempotency (before doing any work) --------------------------------
    if (currentHandoff === "sent") {
      return NextResponse.json({
        ok: true,
        alreadySent: true,
        auditHandoffStatus: "sent",
        message: "This upload has already been sent to audit.",
      });
    }
    if (currentHandoff === "sending") {
      return NextResponse.json(
        {
          ok: false,
          auditHandoffStatus: "sending",
          error: "A handoff for this upload is already in progress.",
        },
        { status: 409 }
      );
    }

    // ---- Status gates -------------------------------------------------------
    if (existing.status !== "submitted") {
      return NextResponse.json(
        { ok: false, error: "Only submitted surgery uploads can be handed off." },
        { status: 409 }
      );
    }
    if (existing.evidence_review_status !== "ready_for_audit") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Evidence must be reviewed and marked Ready for audit before handoff.",
        },
        { status: 409 }
      );
    }

    // ---- Required-evidence completeness (authoritative, server-side) --------
    const { data: uploads } = await admin
      .from("uploads")
      .select("type")
      .eq("case_id", caseId);
    const failures = getSurgeryRequirementFailures(
      uploads ?? [],
      existing.photo_checklist_config
    );
    if (failures.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Required evidence is incomplete.",
          missingRequiredSlots: failures.map((f) => f.key),
          missingRequiredLabels: failures.map((f) => f.label),
          requirementFailures: failures,
          requirementMessages: failures.map((f) => f.message),
        },
        { status: 422 }
      );
    }

    // Belt-and-braces: re-run the shared eligibility evaluation so the route and
    // the UI agree on the rules from a single source of truth.
    const eligibility = computeAuditHandoffEligibility({
      status: existing.status,
      evidenceReviewStatus: existing.evidence_review_status,
      auditHandoffStatus: currentHandoff,
      requiredEvidenceComplete: failures.length === 0,
    });
    if (!eligibility.eligible) {
      return NextResponse.json(
        { ok: false, error: eligibility.reason ?? "Not eligible for handoff." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    // ---- Atomic, idempotent transition --------------------------------------
    // Only transition from not_sent/failed (failed => retry after correction). The
    // conditional update guards against duplicate concurrent handoffs: only one
    // request can win the transition; a racing request matches zero rows.
    try {
      const { data: updated, error: updErr } = await admin
        .from("surgery_upload_details")
        .update({
          audit_handoff_status: "sent",
          audit_handoff_requested_at: now,
          audit_handoff_requested_by: user.id,
          audit_handoff_completed_at: now,
          audit_handoff_completed_by: user.id,
          audit_handoff_error: null,
          ...(notes !== null ? { audit_handoff_notes: notes } : {}),
        })
        .eq("case_id", caseId)
        .in("audit_handoff_status", ["not_sent", "failed"])
        .select("*")
        .maybeSingle();

      if (updErr) throw new Error(updErr.message);

      if (!updated) {
        // Lost the race (or status changed under us). Re-read for an accurate reply.
        const { data: fresh } = await admin
          .from("surgery_upload_details")
          .select("audit_handoff_status")
          .eq("case_id", caseId)
          .maybeSingle();
        const freshStatus = normalizeAuditHandoffStatus(fresh?.audit_handoff_status);
        if (freshStatus === "sent") {
          return NextResponse.json({
            ok: true,
            alreadySent: true,
            auditHandoffStatus: "sent",
            message: "This upload has already been sent to audit.",
          });
        }
        return NextResponse.json(
          {
            ok: false,
            auditHandoffStatus: freshStatus,
            error: "A handoff for this upload is already in progress.",
          },
          { status: 409 }
        );
      }

      // Stage 6B marker mode: no audit engine is invoked here.
      await logEvidenceEvent(admin, {
        caseId,
        actorId: user.id,
        eventType: "audit_handoff",
        metadata: {
          previousHandoffStatus: currentHandoff,
          newHandoffStatus: "sent",
          pipelineMode: AUDIT_HANDOFF_PIPELINE_MODE,
          result: "success",
          ...(notes !== null ? { notes } : {}),
        },
      });

      return NextResponse.json({
        ok: true,
        auditHandoffStatus: "sent",
        pipelineMode: AUDIT_HANDOFF_PIPELINE_MODE,
        details: updated,
      });
    } catch (pipelineErr) {
      // Mark failed so the auditor can retry after correction; log the failure.
      const message =
        pipelineErr instanceof Error ? pipelineErr.message : "Audit handoff failed.";
      const safeMessage = message.slice(0, MAX_NOTES);
      try {
        await admin
          .from("surgery_upload_details")
          .update({
            audit_handoff_status: "failed",
            audit_handoff_requested_at: now,
            audit_handoff_requested_by: user.id,
            audit_handoff_error: safeMessage,
          })
          .eq("case_id", caseId)
          .in("audit_handoff_status", ["not_sent", "failed", "sending"]);
      } catch {
        /* best-effort failure marking */
      }
      await logEvidenceEvent(admin, {
        caseId,
        actorId: user.id,
        eventType: "audit_handoff",
        metadata: {
          previousHandoffStatus: currentHandoff,
          newHandoffStatus: "failed",
          pipelineMode: AUDIT_HANDOFF_PIPELINE_MODE,
          result: "failed",
          errorMessage: safeMessage,
        },
      });
      console.error(LOG_PREFIX, "handoff failed", { caseId, error: safeMessage });
      return NextResponse.json(
        {
          ok: false,
          auditHandoffStatus: "failed",
          error: "Could not complete the audit handoff. You can retry.",
        },
        { status: 502 }
      );
    }
  } catch (e) {
    console.error(LOG_PREFIX, "unhandled error", e);
    return NextResponse.json(
      { ok: false, error: "Could not send to audit pipeline." },
      { status: 500 }
    );
  }
}
