/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Annotations CRUD (soft-delete).
 */

import { NextResponse } from "next/server";
import { requirePreSurgeryClinicianAccess } from "@/lib/preSurgeryIntelligence/access.server";
import {
  createAnnotation,
  createAuditEvent,
  restoreAnnotation,
  softDeleteAnnotation,
  validateAnnotationCoordinates,
} from "@/lib/preSurgeryIntelligence";
import type { ClinicalAnnotationGeometryType, ClinicalAnnotationType } from "@/lib/preSurgeryIntelligence/types";
import {
  insertAnnotation,
  insertAuditEvent,
  loadWorkspaceBundle,
  restoreAnnotationRow,
  softDeleteAnnotationRow,
} from "@/lib/preSurgeryIntelligence/repository.server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const gate = await requirePreSurgeryClinicianAccess(caseId);
    if (!gate.ok) return gate.response;
    const { admin, user } = gate.data;

    const body = (await req.json()) as {
      imageId?: string;
      annotationType?: ClinicalAnnotationType;
      geometryType?: ClinicalAnnotationGeometryType;
      coordinates?: Array<{ x: number; y: number }>;
      note?: string;
      imageWidthPx?: number;
      imageHeightPx?: number;
      imageOrientationDegrees?: 0 | 90 | 180 | 270;
    };

    if (!body.imageId || !body.annotationType || !body.geometryType || !body.coordinates) {
      return NextResponse.json({ ok: false, error: "Missing annotation fields" }, { status: 400 });
    }
    const coordErr = validateAnnotationCoordinates(body.geometryType, body.coordinates);
    if (coordErr) return NextResponse.json({ ok: false, error: coordErr }, { status: 400 });

    const annotation = createAnnotation({
      caseId,
      imageId: body.imageId,
      annotationType: body.annotationType,
      geometryType: body.geometryType,
      coordinates: body.coordinates,
      note: body.note,
      createdBy: user.id,
      source: "clinician",
      approved: true,
      imageWidthPx: body.imageWidthPx,
      imageHeightPx: body.imageHeightPx,
      imageOrientationDegrees: body.imageOrientationDegrees,
    });

    await insertAnnotation(admin, annotation);
    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: "annotation_added",
        actorId: user.id,
        metadata: { annotationId: annotation.id, imageId: body.imageId, type: body.annotationType },
      })
    );

    return NextResponse.json({ ok: true, annotation });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const gate = await requirePreSurgeryClinicianAccess(caseId);
    if (!gate.ok) return gate.response;
    const { admin, user } = gate.data;

    const { searchParams } = new URL(req.url);
    const annotationId = searchParams.get("annotationId")?.trim();
    if (!annotationId) {
      return NextResponse.json({ ok: false, error: "annotationId required" }, { status: 400 });
    }

    const bundle = await loadWorkspaceBundle(admin, caseId, { includeDeletedAnnotations: true });
    const existing = bundle.annotations.find((a) => a.id === annotationId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Annotation not found" }, { status: 404 });
    }

    const deleted = softDeleteAnnotation(existing);
    await softDeleteAnnotationRow(admin, deleted);
    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: "annotation_deleted",
        actorId: user.id,
        metadata: { annotationId },
      })
    );

    return NextResponse.json({ ok: true, annotation: deleted });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

/** Restore a soft-deleted annotation (historical row remains immutable otherwise). */
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const gate = await requirePreSurgeryClinicianAccess(caseId);
    if (!gate.ok) return gate.response;
    const { admin, user } = gate.data;

    const body = (await req.json()) as { annotationId?: string; action?: "restore" };
    if (!body.annotationId || body.action !== "restore") {
      return NextResponse.json({ ok: false, error: "annotationId and action=restore required" }, { status: 400 });
    }

    const bundle = await loadWorkspaceBundle(admin, caseId, { includeDeletedAnnotations: true });
    const existing = bundle.annotations.find((a) => a.id === body.annotationId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Annotation not found" }, { status: 404 });
    }
    if (!existing.deletedAt) {
      return NextResponse.json({ ok: true, annotation: existing });
    }

    const restored = restoreAnnotation(existing);
    await restoreAnnotationRow(admin, restored);
    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: "annotation_added",
        actorId: user.id,
        metadata: { annotationId: restored.id, restored: true },
      })
    );

    return NextResponse.json({ ok: true, annotation: restored });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
