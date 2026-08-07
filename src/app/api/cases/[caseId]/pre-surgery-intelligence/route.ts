/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Workspace bundle + initialise AI seed.
 */

import { NextResponse } from "next/server";
import { requirePreSurgeryClinicianAccess } from "@/lib/preSurgeryIntelligence/access.server";
import {
  buildImageReviewFromUpload,
  createAuditEvent,
  seedAiGraftPlan,
  seedPendingObservations,
  buildPlanComparisonView,
} from "@/lib/preSurgeryIntelligence";
import {
  insertAuditEvent,
  insertGraftPlan,
  loadWorkspaceBundle,
  upsertImageReview,
  upsertObservation,
} from "@/lib/preSurgeryIntelligence/repository.server";
import { getCaseFilesBucketNameForReadOnlyUse } from "@/lib/hairaudit/uploadStorage";
import {
  getPathwayEvidencePack,
  normalizePatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";
import { classifyProjectionStoragePath } from "@/lib/preSurgeryIntelligence/projectionAssetStatus";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const gate = await requirePreSurgeryClinicianAccess(caseId);
    if (!gate.ok) return gate.response;
    const { admin, caseRow } = gate.data;

    const pathway = normalizePatientReviewPathway(caseRow.patient_review_pathway);
    if (pathway !== "pre_surgery") {
      return NextResponse.json(
        { ok: false, error: "Case is not on the pre-surgery pathway" },
        { status: 400 }
      );
    }

    const bundle = await loadWorkspaceBundle(admin, caseId, {
      includeDeletedAnnotations: true,
    });

    const { data: uploads } = await admin
      .from("uploads")
      .select("id, type, storage_path, metadata, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    const clinicalUploads = (uploads ?? []).filter((u) => {
      const t = String(u.type ?? "");
      return (
        t.startsWith("patient_photo:") ||
        t.startsWith("doctor_photo:") ||
        t.startsWith("clinic_photo:") ||
        t.startsWith("surgery_photo:")
      );
    });

    const bucket = getCaseFilesBucketNameForReadOnlyUse();
    const pack = getPathwayEvidencePack("pre_surgery");
    const requiredKeys = pack?.requiredPhotoKeys ?? [];

    const reviewByImage = new Map(bundle.imageReviews.map((r) => [r.imageId, r]));
    const images = await Promise.all(
      clinicalUploads.map(async (u) => {
        const { data } = await admin.storage.from(bucket).createSignedUrl(String(u.storage_path), 60 * 15);
        const review =
          reviewByImage.get(u.id) ??
          buildImageReviewFromUpload(caseId, u, { requiredKeys });
        return {
          uploadId: u.id,
          type: u.type,
          storagePath: u.storage_path,
          signedUrl: data?.signedUrl ?? null,
          createdAt: u.created_at,
          review,
        };
      })
    );

    const uploadSignedById = new Map(images.map((img) => [img.uploadId, img.signedUrl]));

    const projectionMedia = await Promise.all(
      bundle.projections.map(async (projection) => {
        const asset = classifyProjectionStoragePath(projection.storagePath);
        const sourceSignedUrl = uploadSignedById.get(projection.sourceImageId) ?? null;
        let projectedSignedUrl: string | null = null;
        let loadError: string | null = null;
        if (asset.canAttemptSignedUrl && asset.storagePath) {
          const { data, error } = await admin.storage
            .from(bucket)
            .createSignedUrl(asset.storagePath, 60 * 15);
          if (error || !data?.signedUrl) {
            loadError = error?.message || "Could not sign projection storage path";
          } else {
            projectedSignedUrl = data.signedUrl;
          }
        }
        return {
          projectionId: projection.id,
          assetKind: asset.kind,
          assetMessage: asset.message,
          storagePath: asset.storagePath,
          sourceSignedUrl,
          projectedSignedUrl,
          loadError,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      caseId,
      pathway,
      images,
      annotations: bundle.annotations,
      observations: bundle.observations,
      graftPlans: bundle.graftPlans,
      planComparison: buildPlanComparisonView(bundle.graftPlans),
      projections: bundle.projections,
      projectionMedia,
      auditEvents: bundle.auditEvents,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

/** Initialise image reviews, observations, and AI graft seed when missing. */
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { caseId } = await ctx.params;
    const gate = await requirePreSurgeryClinicianAccess(caseId);
    if (!gate.ok) return gate.response;
    const { admin, user, caseRow } = gate.data;

    const pathway = normalizePatientReviewPathway(caseRow.patient_review_pathway);
    if (pathway !== "pre_surgery") {
      return NextResponse.json(
        { ok: false, error: "Case is not on the pre-surgery pathway" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      norwood?: string;
      crown?: string;
      donorBand?: string;
    };

    const existing = await loadWorkspaceBundle(admin, caseId);
    const { data: uploads } = await admin
      .from("uploads")
      .select("id, type, storage_path, metadata, created_at")
      .eq("case_id", caseId);

    const clinicalUploads = (uploads ?? []).filter((u) =>
      String(u.type ?? "").startsWith("patient_photo:")
    );
    const pack = getPathwayEvidencePack("pre_surgery");
    const requiredKeys = pack?.requiredPhotoKeys ?? [];
    const evidenceIds = clinicalUploads.map((u) => u.id);

    const reviewByImage = new Map(existing.imageReviews.map((r) => [r.imageId, r]));
    for (const u of clinicalUploads) {
      if (reviewByImage.has(u.id)) continue;
      const review = buildImageReviewFromUpload(caseId, u, { requiredKeys });
      await upsertImageReview(admin, review);
    }

    if (existing.observations.length === 0) {
      const observations = seedPendingObservations({ caseId, evidenceImageIds: evidenceIds });
      for (const o of observations) await upsertObservation(admin, o);
    }

    if (existing.graftPlans.length === 0) {
      const plan = seedAiGraftPlan({
        caseId,
        createdBy: user.id,
        norwood: (body.norwood as never) ?? "III",
        crown: (body.crown as never) ?? "early",
        donorBand: (body.donorBand as never) ?? "moderate",
        evidenceImageIds: evidenceIds,
      });
      await insertGraftPlan(admin, plan);
      const event = createAuditEvent({
        caseId,
        eventType: "ai_analysis_created",
        actorId: user.id,
        metadata: { graftPlanId: plan.id, version: plan.version },
      });
      await insertAuditEvent(admin, event);
    }

    const bundle = await loadWorkspaceBundle(admin, caseId);
    return NextResponse.json({ ok: true, ...bundle, planComparison: buildPlanComparisonView(bundle.graftPlans) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
