/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Image review corrections.
 */

import { NextResponse } from "next/server";
import { requirePreSurgeryClinicianAccess } from "@/lib/preSurgeryIntelligence/access.server";
import {
  applyImageReviewCorrection,
  buildImageReviewFromUpload,
  createAuditEvent,
  isPreSurgeryImageRole,
} from "@/lib/preSurgeryIntelligence";
import {
  insertAuditEvent,
  insertImageCorrections,
  loadWorkspaceBundle,
  upsertImageReview,
} from "@/lib/preSurgeryIntelligence/repository.server";
import type { ImageQualityFlag, ImageClinicianReviewStatus } from "@/lib/preSurgeryIntelligence/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const gate = await requirePreSurgeryClinicianAccess(caseId);
    if (!gate.ok) return gate.response;
    const { admin, user } = gate.data;

    const body = (await req.json()) as {
      imageId?: string;
      assignedRole?: string;
      orientationDegrees?: 0 | 90 | 180 | 270;
      mirrored?: boolean;
      qualityFlags?: ImageQualityFlag[];
      reviewStatus?: ImageClinicianReviewStatus;
      clinicianNote?: string | null;
      reason?: string | null;
    };

    if (!body.imageId) {
      return NextResponse.json({ ok: false, error: "imageId required" }, { status: 400 });
    }
    if (body.assignedRole != null && !isPreSurgeryImageRole(body.assignedRole)) {
      return NextResponse.json({ ok: false, error: "Invalid image role" }, { status: 400 });
    }

    const bundle = await loadWorkspaceBundle(admin, caseId);
    let review = bundle.imageReviews.find((r) => r.imageId === body.imageId);
    if (!review) {
      const { data: upload } = await admin
        .from("uploads")
        .select("id, type, metadata, created_at")
        .eq("id", body.imageId)
        .eq("case_id", caseId)
        .maybeSingle();
      if (!upload) {
        return NextResponse.json({ ok: false, error: "Image not found" }, { status: 404 });
      }
      review = buildImageReviewFromUpload(caseId, upload);
    }

    const { review: next, corrections } = applyImageReviewCorrection(
      review,
      {
        assignedRole: body.assignedRole as never,
        orientationDegrees: body.orientationDegrees,
        mirrored: body.mirrored,
        qualityFlags: body.qualityFlags,
        reviewStatus: body.reviewStatus,
        clinicianNote: body.clinicianNote,
        reason: body.reason,
      },
      user.id
    );

    await upsertImageReview(admin, next);
    await insertImageCorrections(admin, corrections);

    if (corrections.some((c) => c.field === "assignedRole")) {
      await insertAuditEvent(
        admin,
        createAuditEvent({
          caseId,
          eventType: "image_role_corrected",
          actorId: user.id,
          metadata: { imageId: body.imageId, correctionCount: corrections.length },
        })
      );
    }

    return NextResponse.json({ ok: true, review: next, corrections });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
