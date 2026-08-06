/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Auditor projection corrections API.
 * Professional/auditor only. Never mutates immutable projection snapshot bytes.
 */

import { NextResponse } from "next/server";
import { requirePreSurgeryClinicianAccess } from "@/lib/preSurgeryIntelligence/access.server";
import {
  adjustProjectionCorrection,
  assertProjectionSnapshotImmutable,
  buildProjectionCorrectionAuditMetadata,
  createProjectionCorrection,
  isProjectionCorrectionCode,
  type ProjectionCorrectionCode,
} from "@/lib/preSurgeryIntelligence/projectionCorrections";
import {
  assertLearningSignalHasNoPhi,
  buildProjectionLearningSignal,
} from "@/lib/preSurgeryIntelligence/projectionLearningSignals";
import { createAuditEvent } from "@/lib/preSurgeryIntelligence/auditTimeline";
import {
  insertAuditEvent,
  insertProjectionCorrection,
  listProjectionCorrections,
  loadWorkspaceBundle,
  updateProjectionCorrectionStatus,
} from "@/lib/preSurgeryIntelligence/repository.server";
import type { ClinicalAnnotationGeometryType, NormalisedPoint, PreSurgeryProjectionMode } from "@/lib/preSurgeryIntelligence/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const gate = await requirePreSurgeryClinicianAccess(caseId);
    if (!gate.ok) return gate.response;

    const url = new URL(_req.url);
    const projectionId = url.searchParams.get("projectionId") ?? undefined;
    const rows = await listProjectionCorrections(gate.data.admin, caseId, projectionId);
    return NextResponse.json({ ok: true, corrections: rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const gate = await requirePreSurgeryClinicianAccess(caseId);
    if (!gate.ok) return gate.response;
    const { admin, user } = gate.data;

    const body = (await req.json()) as {
      projectionSnapshotId?: string;
      correctionCodes?: string[];
      clinicalNote?: string;
      zoneRefs?: string[];
      geometryType?: ClinicalAnnotationGeometryType | null;
      coordinates?: NormalisedPoint[];
      suggestedMode?: PreSurgeryProjectionMode | null;
      supersedesCorrectionId?: string | null;
    };

    if (!body.projectionSnapshotId || !body.clinicalNote || !body.correctionCodes?.length) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const codes = body.correctionCodes.filter(isProjectionCorrectionCode) as ProjectionCorrectionCode[];
    if (codes.length !== body.correctionCodes.length) {
      return NextResponse.json({ ok: false, error: "Invalid correction code" }, { status: 400 });
    }

    const bundle = await loadWorkspaceBundle(admin, caseId);
    const projection = bundle.projections.find((p) => p.id === body.projectionSnapshotId);
    if (!projection || projection.caseId !== caseId) {
      return NextResponse.json({ ok: false, error: "Projection not found on case" }, { status: 404 });
    }

    // Snapshot immutability guard — capture before/after identity.
    const snapshotBefore = {
      id: projection.id,
      storagePath: projection.storagePath,
      outputChecksum: projection.outputChecksum,
    };

    let correction = createProjectionCorrection({
      caseId,
      projectionSnapshotId: projection.id,
      projectionVersion: projection.projectionVersion ?? 1,
      correctionCodes: codes,
      clinicalNote: body.clinicalNote,
      zoneRefs: body.zoneRefs,
      geometryType: body.geometryType,
      coordinates: body.coordinates,
      suggestedMode: body.suggestedMode,
      createdBy: user.id,
      supersedesCorrectionId: body.supersedesCorrectionId,
    });

    if (body.supersedesCorrectionId) {
      const prior = (await listProjectionCorrections(admin, caseId, projection.id)).find(
        (c) => c.id === body.supersedesCorrectionId
      );
      if (!prior) {
        return NextResponse.json({ ok: false, error: "Prior correction not found" }, { status: 404 });
      }
      const adjusted = adjustProjectionCorrection(prior, {
        correctionCodes: codes,
        clinicalNote: body.clinicalNote,
        zoneRefs: body.zoneRefs,
        geometryType: body.geometryType,
        coordinates: body.coordinates,
        suggestedMode: body.suggestedMode,
        updatedBy: user.id,
        id: correction.id,
      });
      await updateProjectionCorrectionStatus(admin, adjusted.priorWithdrawn);
      correction = adjusted.superseding;
    }

    const learningSignal = buildProjectionLearningSignal({
      correction,
      projectionMode: projection.mode,
    });
    assertLearningSignalHasNoPhi(learningSignal, caseId);
    correction = { ...correction, learningSignalId: learningSignal.id };

    await insertProjectionCorrection(admin, correction, learningSignal);

    // Re-load projection to prove bytes unchanged.
    const afterBundle = await loadWorkspaceBundle(admin, caseId);
    const after = afterBundle.projections.find((p) => p.id === projection.id);
    if (!after) {
      return NextResponse.json({ ok: false, error: "Projection missing after write" }, { status: 500 });
    }
    assertProjectionSnapshotImmutable(snapshotBefore, {
      id: after.id,
      storagePath: after.storagePath,
      outputChecksum: after.outputChecksum,
    });

    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: body.supersedesCorrectionId
          ? "projection_correction_adjusted"
          : "projection_correction_recorded",
        actorId: user.id,
        metadata: buildProjectionCorrectionAuditMetadata(correction),
      })
    );
    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: "projection_learning_signal_emitted",
        actorId: user.id,
        metadata: {
          learningSignalId: learningSignal.id,
          schemaVersion: learningSignal.schemaVersion,
          correctionCodes: learningSignal.correctionCodes,
          projectionKeyHash: learningSignal.projectionKeyHash,
        },
      })
    );

    return NextResponse.json({
      ok: true,
      correction,
      learningSignalId: learningSignal.id,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
