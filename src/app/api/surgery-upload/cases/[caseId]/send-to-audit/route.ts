// POST /api/surgery-upload/cases/[caseId]/send-to-audit — Stage 6C
// Controlled, AUDITOR-ONLY handoff of a submitted + ready_for_audit mobile surgery
// upload into the HairAudit audit INTAKE QUEUE.
//
// IMPORTANT SAFETY MODEL (queue mode):
//   The existing audit pipeline (/api/submit + Inngest "case/submitted") is NOT
//   safe to call directly for surgery uploads: it explicitly forbids auditors,
//   validates patient/doctor/clinic photo categories, and depends on audit_type /
//   submission_channel semantics surgery uploads do not have. So instead of
//   touching that engine, Stage 6C creates a controlled record in the dedicated
//   surgery_upload_audit_intake queue, sets audit_handoff_status = sent, and logs
//   events. It does NOT mutate cases.status, does NOT send any Inngest event, does
//   NOT call /api/submit, and does NOT generate a report. Stage 7 will connect
//   intake records to real report generation. Becoming ready_for_audit never
//   auto-triggers this — the auditor must call this route explicitly.
//
//   Idempotent: one intake record per case (UNIQUE case_id). Calling twice returns
//   the existing intake status and does not log duplicate events.
import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCase } from "@/lib/case-access";
import { resolveSurgeryUploadActor } from "@/lib/surgeryUpload/access";
import {
  getRequiredPhotoCountSummary,
  getSurgeryRequirementFailures,
} from "@/lib/surgeryUpload/checklist";
import {
  AUDIT_HANDOFF_PIPELINE_MODE,
  canTriggerAuditHandoff,
  computeAuditHandoffEligibility,
  normalizeAuditHandoffStatus,
} from "@/lib/surgeryUpload/auditHandoff";
import {
  AUDIT_INTAKE_SOURCE,
  priorityFromPayload,
  type AuditIntakeRow,
} from "@/lib/surgeryUpload/auditIntake";
import { loadAuditIntakeByCase } from "@/lib/surgeryUpload/auditIntakeQuery";
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
        "id, status, evidence_review_status, audit_handoff_status, photo_checklist_config, clinic_profile_id, clinic_name, surgeon_name, surgery_date, procedure_type"
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
    const priority = priorityFromPayload(body.priority);

    // ---- Idempotency (before doing any work) --------------------------------
    // If an intake record already exists, this case has already been handed off.
    // Return the existing intake status and do NOT log duplicate events.
    const existingIntake = await loadAuditIntakeByCase(admin, caseId);
    if (currentHandoff === "sent" && existingIntake) {
      return NextResponse.json({
        ok: true,
        alreadySent: true,
        auditHandoffStatus: "sent",
        pipelineMode: AUDIT_HANDOFF_PIPELINE_MODE,
        intakeStatus: existingIntake.status,
        intakePriority: existingIntake.priority,
        message: "This upload has already been sent to audit intake.",
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
    // the UI agree on the rules from a single source of truth. The not-already-sent
    // gate is enforced above (idempotent intake handling), so it is neutralized here
    // to allow backfilling an intake record for a legacy "sent" row.
    const eligibility = computeAuditHandoffEligibility({
      status: existing.status,
      evidenceReviewStatus: existing.evidence_review_status,
      auditHandoffStatus: "not_sent",
      requiredEvidenceComplete: failures.length === 0,
    });
    if (!eligibility.eligible) {
      return NextResponse.json(
        { ok: false, error: eligibility.reason ?? "Not eligible for handoff." },
        { status: 409 }
      );
    }

    // Sanitized snapshot stored on the intake record (reporting/context only).
    const completionSummary = getRequiredPhotoCountSummary(
      uploads ?? [],
      existing.photo_checklist_config
    );
    const intakeMetadata = {
      evidence_review_status: existing.evidence_review_status,
      audit_handoff_status: "sent",
      required_evidence: {
        satisfied: completionSummary.requiredSatisfiedCount,
        total: completionSummary.requiredCountTotal,
        complete: !completionSummary.missingRequired,
      },
      clinic_profile_id: existing.clinic_profile_id,
      clinic_name: existing.clinic_name,
      surgeon: existing.surgeon_name,
      procedure_type: existing.procedure_type,
      surgery_date: existing.surgery_date,
      handoff_notes: notes,
    };

    const now = new Date().toISOString();

    // ---- Create intake record, then mark the handoff sent --------------------
    // The intake record is the real work. We create it FIRST (the risky op); only
    // if that succeeds do we flip the handoff marker to "sent". One intake per case
    // (UNIQUE case_id) keeps this idempotent even under concurrent requests.
    try {
      let intake: AuditIntakeRow | null = existingIntake;
      let intakeCreated = false;
      if (!intake) {
        const { data: inserted, error: insErr } = await admin
          .from("surgery_upload_audit_intake")
          .insert({
            case_id: caseId,
            surgery_upload_details_id: existing.id,
            status: "pending",
            priority,
            created_by: user.id,
            intake_notes: notes,
            source: AUDIT_INTAKE_SOURCE,
            metadata: intakeMetadata,
          })
          .select("*")
          .maybeSingle();
        if (insErr || !inserted) {
          // A concurrent request may have inserted first (unique violation). If a
          // row now exists, treat this as idempotent success; otherwise it's a real
          // failure and we fall through to the catch.
          const raced = await loadAuditIntakeByCase(admin, caseId);
          if (!raced) throw new Error(insErr?.message ?? "Could not create intake record.");
          intake = raced;
        } else {
          intake = inserted as AuditIntakeRow;
          intakeCreated = true;
        }
      }

      // Flip the handoff marker (idempotent: only from not_sent/failed). If it is
      // already "sent" (backfill of a legacy row), updated is null and that's fine.
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

      // Only log when we actually created the intake (no duplicate events on retry
      // of an already-handed-off case).
      if (intakeCreated) {
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
        await logEvidenceEvent(admin, {
          caseId,
          actorId: user.id,
          eventType: "audit_intake_created",
          metadata: {
            intakeStatus: "pending",
            priority,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        alreadySent: !intakeCreated,
        auditHandoffStatus: "sent",
        pipelineMode: AUDIT_HANDOFF_PIPELINE_MODE,
        intakeStatus: intake?.status ?? "pending",
        intakePriority: intake?.priority ?? priority,
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
