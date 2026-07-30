/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Clinician approval / rejection / sharing control.
 * Patients never see projections until status === approved AND sharing enabled.
 */

import { NextResponse } from "next/server";
import { requirePreSurgeryClinicianAccess } from "@/lib/preSurgeryIntelligence/access.server";
import {
  approveIllustrativeProjectionWithChecklist,
  createAuditEvent,
  emptyApprovalChecklist,
  rejectIllustrativeProjection,
  REJECTION_REASONS,
  supersedeApprovedProjection,
} from "@/lib/preSurgeryIntelligence";
import {
  decidePatientSharingAllowed,
  resolveProjectionActivationControls,
} from "@/lib/preSurgeryIntelligence/projection/activationControls";
import type {
  PreSurgeryApprovalChecklist,
  PreSurgeryProjectionRejectionReason,
  PreSurgeryProjectionStaleReason,
} from "@/lib/preSurgeryIntelligence/types";
import {
  insertAuditEvent,
  loadWorkspaceBundle,
  updateProjectionRow,
} from "@/lib/preSurgeryIntelligence/repository.server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const gate = await requirePreSurgeryClinicianAccess(caseId);
    if (!gate.ok) return gate.response;
    const { admin, user, accessRole, caseRow } = gate.data;

    const body = (await req.json()) as {
      projectionId?: string;
      action?: "approve" | "reject" | "enable_sharing" | "revoke_sharing";
      reason?: string;
      reasonCode?: PreSurgeryProjectionRejectionReason;
      checklist?: Partial<PreSurgeryApprovalChecklist>;
      approvalNote?: string | null;
      overrideReason?: string | null;
    };

    if (
      !body.projectionId ||
      (body.action !== "approve" &&
        body.action !== "reject" &&
        body.action !== "enable_sharing" &&
        body.action !== "revoke_sharing")
    ) {
      return NextResponse.json(
        { ok: false, error: "projectionId and action required" },
        { status: 400 }
      );
    }

    const bundle = await loadWorkspaceBundle(admin, caseId);
    const existing = bundle.projections.find((p) => p.id === body.projectionId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Projection not found" }, { status: 404 });
    }

    if (body.action === "approve") {
      const checklist = {
        ...emptyApprovalChecklist(),
        ...(body.checklist ?? {}),
      } as PreSurgeryApprovalChecklist;

      // Move generated → clinician_review first if needed for transition bookkeeping.
      const forApproval =
        existing.status === "generated"
          ? { ...existing, status: "clinician_review" as const }
          : existing;

      const activation = resolveProjectionActivationControls();
      const approved = approveIllustrativeProjectionWithChecklist({
        projection: forApproval,
        actor: {
          clinicianId: user.id,
          role: accessRole,
          organisationId:
            accessRole === "assigned_clinic" ? caseRow.clinic_id : caseRow.clinic_id,
        },
        checklist,
        approvalNote: body.approvalNote ?? null,
        overrideReason: body.overrideReason ?? null,
        providerModelVersion: existing.providerModelVersion ?? null,
        shadowMode: activation.shadowMode || existing.shadowMode === true,
        patientSharingKillSwitch: activation.patientSharingKillSwitch,
      });
      if (!approved.ok) {
        return NextResponse.json(
          { ok: false, error: approved.error, code: approved.code },
          { status: 400 }
        );
      }

      // Supersede prior approved projections for same case/mode without deleting.
      for (const prior of bundle.projections) {
        if (prior.id === approved.projection.id) continue;
        if (prior.status !== "approved") continue;
        if (prior.mode !== approved.projection.mode) continue;
        const superseded = supersedeApprovedProjection(prior);
        await updateProjectionRow(admin, superseded);
        await insertAuditEvent(
          admin,
          createAuditEvent({
            caseId,
            eventType: "projection_superseded",
            actorId: user.id,
            metadata: {
              projectionId: superseded.id,
              supersededBy: approved.projection.id,
            },
          })
        );
      }

      await updateProjectionRow(admin, approved.projection);
      await insertAuditEvent(
        admin,
        createAuditEvent({
          caseId,
          eventType: "projection_approved",
          actorId: user.id,
          metadata: {
            projectionId: approved.projection.id,
            mode: approved.projection.mode,
            graftPlanId: approved.projection.graftPlanId,
            graftPlanVersion: approved.projection.graftPlanVersion,
            inputChecksum: approved.projection.inputChecksum,
            providerModelVersion: approved.projection.providerModelVersion,
            safetyLabelVersion: approved.projection.safetyLabelVersion,
            generationPolicyVersion: approved.projection.generationPolicyVersion,
            checklist: approved.projection.approvalChecklist,
            patientSharingEnabled: approved.projection.patientSharingEnabled === true,
            shadowMode: approved.projection.shadowMode === true,
          },
        })
      );
      if (approved.projection.patientSharingEnabled) {
        await insertAuditEvent(
          admin,
          createAuditEvent({
            caseId,
            eventType: "projection_patient_sharing_enabled",
            actorId: user.id,
            metadata: { projectionId: approved.projection.id },
          })
        );
      }
      return NextResponse.json({ ok: true, projection: approved.projection });
    }

    if (body.action === "enable_sharing" || body.action === "revoke_sharing") {
      if (existing.status !== "approved" && body.action === "enable_sharing") {
        return NextResponse.json(
          { ok: false, error: "Only approved projections can enable patient sharing" },
          { status: 400 }
        );
      }
      if (body.action === "enable_sharing") {
        const controls = resolveProjectionActivationControls();
        const shareGate = decidePatientSharingAllowed({
          controls,
          shadowMode: existing.shadowMode === true,
          patientConsentRecorded: Boolean(existing.patientConsentId),
          projectionApproved: true,
        });
        if (!shareGate.allowed) {
          return NextResponse.json(
            { ok: false, error: shareGate.message, code: shareGate.code },
            { status: 403 }
          );
        }
        if (existing.staleAt) {
          return NextResponse.json(
            { ok: false, error: "Stale projections cannot be shared with patients", code: "stale" },
            { status: 400 }
          );
        }
      }
      const updated = {
        ...existing,
        patientSharingEnabled: body.action === "enable_sharing",
        ...(body.action === "revoke_sharing"
          ? {
              staleAt: existing.staleAt ?? new Date().toISOString(),
              staleReasons: existing.staleReasons?.length
                ? existing.staleReasons
                : (["patient_sharing_revoked"] as PreSurgeryProjectionStaleReason[]),
            }
          : {}),
      };
      await updateProjectionRow(admin, updated);
      await insertAuditEvent(
        admin,
        createAuditEvent({
          caseId,
          eventType:
            body.action === "enable_sharing"
              ? "projection_patient_sharing_enabled"
              : "projection_patient_sharing_revoked",
          actorId: user.id,
          metadata: { projectionId: updated.id },
        })
      );
      return NextResponse.json({ ok: true, projection: updated });
    }

    const reasonCode = body.reasonCode ?? "other_safety_concern";
    if (!REJECTION_REASONS.includes(reasonCode)) {
      return NextResponse.json({ ok: false, error: "Invalid rejection reasonCode" }, { status: 400 });
    }
    const rejected = rejectIllustrativeProjection(
      existing,
      user.id,
      String(body.reason ?? reasonCode).slice(0, 500),
      undefined,
      reasonCode
    );
    await updateProjectionRow(admin, rejected);
    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: "projection_rejected",
        actorId: user.id,
        metadata: {
          projectionId: rejected.id,
          mode: rejected.mode,
          reasonCode: rejected.rejectionReasonCode,
        },
      })
    );
    return NextResponse.json({ ok: true, projection: rejected });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
