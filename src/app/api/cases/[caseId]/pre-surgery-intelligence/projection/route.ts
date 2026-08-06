/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Request illustrative projection generation.
 */

import { NextResponse } from "next/server";
import { requirePreSurgeryClinicianAccess } from "@/lib/preSurgeryIntelligence/access.server";
import {
  createAuditEvent,
  isProjectionSourceRole,
  requestPreSurgeryProjection,
  type PreSurgeryAuditEventType,
} from "@/lib/preSurgeryIntelligence";
import type { PreSurgeryProjectionMode } from "@/lib/preSurgeryIntelligence/types";
import {
  insertAuditEvent,
  insertOrReuseProjection,
  loadWorkspaceBundle,
} from "@/lib/preSurgeryIntelligence/repository.server";
import {
  getPathwayEvidencePack,
  isPathwayRequiredUploadComplete,
} from "@/lib/patient/patientReviewPathway";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ caseId: string }> };

const MODES: PreSurgeryProjectionMode[] = [
  "conservative",
  "planned",
  "optimistic_within_approved_range",
];

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const gate = await requirePreSurgeryClinicianAccess(caseId);
    if (!gate.ok) return gate.response;
    const { admin, user } = gate.data;

    const body = (await req.json()) as {
      mode?: PreSurgeryProjectionMode;
      sourceImageId?: string;
      graftPlanId?: string;
      proposedHairlineConfirmed?: boolean;
      treatmentAreaConfirmed?: boolean;
      deterministicSeed?: string | null;
      regeneratesFromProjectionId?: string | null;
      idempotencyKey?: string | null;
    };

    if (!body.mode || !MODES.includes(body.mode)) {
      return NextResponse.json({ ok: false, error: "Invalid projection mode" }, { status: 400 });
    }
    if (!body.sourceImageId) {
      return NextResponse.json({ ok: false, error: "sourceImageId required" }, { status: 400 });
    }

    const bundle = await loadWorkspaceBundle(admin, caseId);
    const plan =
      (body.graftPlanId
        ? bundle.graftPlans.find((p) => p.id === body.graftPlanId)
        : null) ??
      [...bundle.graftPlans].reverse().find((p) => p.status === "approved");

    if (!plan || plan.status !== "approved") {
      return NextResponse.json(
        { ok: false, error: "An approved graft plan is required before projection generation" },
        { status: 400 }
      );
    }

    const sourceReview = bundle.imageReviews.find((r) => r.imageId === body.sourceImageId);
    if (!sourceReview) {
      return NextResponse.json({ ok: false, error: "Source image review not found" }, { status: 404 });
    }
    if (!isProjectionSourceRole(sourceReview.assignedRole)) {
      return NextResponse.json(
        { ok: false, error: "Source image must be frontal or overhead" },
        { status: 400 }
      );
    }

    let regeneratesFrom = body.regeneratesFromProjectionId ?? null;
    let projectionVersion = 1;
    if (regeneratesFrom) {
      const prior = bundle.projections.find((p) => p.id === regeneratesFrom);
      if (!prior) {
        return NextResponse.json({ ok: false, error: "Prior projection not found" }, { status: 404 });
      }
      if (prior.status !== "rejected" && prior.status !== "failed" && prior.status !== "validation_failed") {
        return NextResponse.json(
          { ok: false, error: "Regeneration is only allowed from rejected or failed attempts" },
          { status: 400 }
        );
      }
      projectionVersion = (prior.projectionVersion ?? 1) + 1;
      await insertAuditEvent(
        admin,
        createAuditEvent({
          caseId,
          eventType: "projection_regeneration_requested",
          actorId: user.id,
          metadata: {
            regeneratesFromProjectionId: regeneratesFrom,
            projectionVersion,
            mode: body.mode,
          },
        })
      );
    }

    const { data: uploads } = await admin
      .from("uploads")
      .select("id, type, storage_path")
      .eq("case_id", caseId);
    const pack = getPathwayEvidencePack("pre_surgery");
    const requiredImagesPresent = isPathwayRequiredUploadComplete(
      "pre_surgery",
      (uploads ?? []).map((u) => ({ type: u.type }))
    );

    const sourceUpload = (uploads ?? []).find((u) => u.id === body.sourceImageId);
    const sourceImageRef = sourceUpload?.storage_path
      ? `storage:${sourceUpload.storage_path}`
      : `image:${body.sourceImageId}`;

    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: "projection_requested",
        actorId: user.id,
        metadata: { mode: body.mode, graftPlanId: plan.id, sourceImageId: body.sourceImageId },
      })
    );

    const result = await requestPreSurgeryProjection({
      caseId,
      plan,
      sourceReview,
      sourceReviews: bundle.imageReviews,
      sourceImageRef,
      approvedAnnotations: bundle.annotations.filter(
        (a) => a.imageId === body.sourceImageId && a.approved && !a.deletedAt
      ),
      approvedObservations: bundle.observations,
      mode: body.mode,
      requiredImagesPresent: pack ? requiredImagesPresent : true,
      proposedHairlineConfirmed: Boolean(body.proposedHairlineConfirmed),
      treatmentAreaConfirmed: Boolean(body.treatmentAreaConfirmed),
      requestedBy: user.id,
      deterministicSeed: body.deterministicSeed ?? null,
      regeneratesFromProjectionId: regeneratesFrom,
      projectionVersion,
      idempotencyKey: body.idempotencyKey ?? null,
      activation: {
        clinicId: gate.data.caseRow.clinic_id ?? null,
        requestsForCase: bundle.projections.length,
        caseLevelEnabled: true,
      },
    });

    for (const hint of result.auditHints ?? []) {
      await insertAuditEvent(
        admin,
        createAuditEvent({
          caseId,
          eventType: hint.eventType as PreSurgeryAuditEventType,
          actorId: user.id,
          metadata: hint.metadata,
        })
      );
    }

    if (!result.ok) {
      if (result.projection) {
        try {
          await insertOrReuseProjection(admin, result.projection);
        } catch {
          // Persistence conflict — still return degradable failure to the client.
        }
      }
      return NextResponse.json(
        {
          ok: false,
          errors: result.errors,
          degradable: result.degradable === true,
          providerId: result.providerId,
          projection: result.projection ?? null,
        },
        { status: 400 }
      );
    }

    const persisted = await insertOrReuseProjection(admin, result.projection);
    const projection = persisted.projection;

    if (persisted.kind !== "reused") {
      await insertAuditEvent(
        admin,
        createAuditEvent({
          caseId,
          eventType: "projection_generated",
          actorId: user.id,
          metadata: {
            projectionId: projection.id,
            mode: projection.mode,
            inputChecksum: projection.inputChecksum,
            outputChecksum: projection.outputChecksum,
            providerId: result.providerId,
            latencyMs: result.latencyMs,
            status: projection.status,
            patientVisible: false,
            persistKind: persisted.kind,
          },
        })
      );
    }

    return NextResponse.json({
      ok: true,
      projection,
      providerId: result.providerId,
      latencyMs: result.latencyMs,
      patientVisible: false,
      reused: persisted.kind === "reused",
      replaced: persisted.kind === "replaced",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
