/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C / REAL-ASSET-1A — Request illustrative projection generation.
 * Defaults to the latest approved plan; requires clinician confirmation; writes real image assets
 * via ImagingOS or local-illustrative-v1. Stub paths are never treated as complete projections.
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
import { resolveRuntimeProjectionProvider } from "@/lib/preSurgeryIntelligence/projection/health";
import {
  createBoundLocalIllustrativeProvider,
  downloadCaseFilesObject,
} from "@/lib/preSurgeryIntelligence/projection/localIllustrativeStorage.server";
import {
  probeStoredProjectionAsset,
  validateProbedProjectionAsset,
  STUB_GENERATION_NO_ASSET_MESSAGE,
} from "@/lib/preSurgeryIntelligence/projection/assetValidation";
import { resolvePlanForProjectionGeneration } from "@/lib/preSurgeryIntelligence/projection/planConfirmation";
import { buildRegenerationSeed } from "@/lib/preSurgeryIntelligence/projection/service";

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
      confirmCurrentApprovedPlan?: boolean;
      allowSupersededPlan?: boolean;
    };

    if (!body.mode || !MODES.includes(body.mode)) {
      return NextResponse.json({ ok: false, error: "Invalid projection mode" }, { status: 400 });
    }
    if (!body.sourceImageId) {
      return NextResponse.json({ ok: false, error: "sourceImageId required" }, { status: 400 });
    }

    const bundle = await loadWorkspaceBundle(admin, caseId);
    const planResolved = resolvePlanForProjectionGeneration({
      graftPlans: bundle.graftPlans,
      requestedGraftPlanId: body.graftPlanId ?? null,
      confirmation: {
        confirmCurrentApprovedPlan: body.confirmCurrentApprovedPlan === true,
        allowSupersededPlan: body.allowSupersededPlan === true,
        graftPlanId: body.graftPlanId ?? null,
      },
      imageReviews: bundle.imageReviews,
    });
    if (!planResolved.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: planResolved.message,
          code: planResolved.code,
          planPreview: planResolved.preview ?? null,
        },
        { status: 400 }
      );
    }
    const plan = planResolved.plan;

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
      // Allow regen from rejected/failed OR historical stub/unavailable assets (replace flow).
      const priorIsStub =
        typeof prior.storagePath === "string" && /\.stub$/i.test(prior.storagePath);
      const regenerableStatus =
        prior.status === "rejected" ||
        prior.status === "failed" ||
        prior.status === "validation_failed" ||
        priorIsStub;
      if (!regenerableStatus) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Regeneration is only allowed from rejected, failed, or stub/unavailable attempts",
          },
          { status: 400 }
        );
      }
      const seed = buildRegenerationSeed(prior);
      projectionVersion = seed.projectionVersion;
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

    const runtime = resolveRuntimeProjectionProvider();
    let provider = runtime.provider;
    let providerId = runtime.providerId;
    let modelVersion = runtime.modelVersion;
    let providerKind = runtime.config.kind;

    if (runtime.requiresStorageBinding || runtime.config.kind === "local_illustrative") {
      const uploadById = new Map(
        (uploads ?? []).map((u) => [u.id as string, String(u.storage_path ?? "")])
      );
      provider = createBoundLocalIllustrativeProvider({
        admin,
        resolveImageIdToPath: async (imageId) => uploadById.get(imageId) || null,
      });
      providerId = "local-illustrative-v1";
      modelVersion = "local-illustrative-v1";
      providerKind = "local_illustrative";
    }

    if (runtime.disabled && !runtime.requiresStorageBinding) {
      return NextResponse.json(
        {
          ok: false,
          error: "Projection provider is unavailable because it is not configured",
          code: "provider_unavailable",
          providerId,
        },
        { status: 503 }
      );
    }

    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: "projection_requested",
        actorId: user.id,
        metadata: {
          mode: body.mode,
          graftPlanId: plan.id,
          graftPlanVersion: plan.version,
          sourceImageId: body.sourceImageId,
          providerId,
          confirmCurrentApprovedPlan: true,
        },
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
      provider,
      providerId,
      modelVersion,
      requireValidImageAsset: true,
      activation: {
        clinicId: gate.data.caseRow.clinic_id ?? null,
        requestsForCase: bundle.projections.length,
        caseLevelEnabled: true,
        providerKind:
          providerKind === "imagingos" ||
          providerKind === "local_illustrative" ||
          providerKind === "stub" ||
          providerKind === "disabled"
            ? providerKind
            : "local_illustrative",
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
          planPreview: planResolved.preview,
        },
        { status: 400 }
      );
    }

    // REAL-ASSET-1A — Confirm storage object exists before marking generation complete.
    const probe = await probeStoredProjectionAsset({
      storagePath: result.projection.storagePath ?? "",
      download: (path) => downloadCaseFilesObject(admin, path),
    });
    const assetGate = validateProbedProjectionAsset({
      caseId,
      attemptId: result.projection.id,
      storagePath: result.projection.storagePath,
      expectedChecksum: result.projection.outputChecksum,
      probe,
    });
    if (!assetGate.ok) {
      const failedProjection = {
        ...result.projection,
        status: "failed" as const,
        failureCode: assetGate.code,
        failureMessage: assetGate.message,
        storagePath: assetGate.code === "stub_placeholder" ? result.projection.storagePath : null,
        patientSharingEnabled: false,
      };
      try {
        await insertOrReuseProjection(admin, failedProjection);
      } catch {
        // ignore persist race
      }
      await insertAuditEvent(
        admin,
        createAuditEvent({
          caseId,
          eventType: "projection_provider_failure",
          actorId: user.id,
          metadata: {
            code: assetGate.code,
            message: assetGate.message,
            providerId: result.providerId,
          },
        })
      );
      return NextResponse.json(
        {
          ok: false,
          errors: [{ code: assetGate.code, message: assetGate.message }],
          degradable: true,
          providerId: result.providerId,
          projection: failedProjection,
          planPreview: planResolved.preview,
          assetMessage: STUB_GENERATION_NO_ASSET_MESSAGE,
        },
        { status: 400 }
      );
    }

    const persisted = await insertOrReuseProjection(admin, {
      ...result.projection,
      outputChecksum: assetGate.probe.checksumSha256 ?? result.projection.outputChecksum,
      status: "clinician_review",
      patientSharingEnabled: false,
    });
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
            mimeType: assetGate.probe.mimeType,
            fileSizeBytes: assetGate.probe.fileSizeBytes,
            widthPx: assetGate.probe.widthPx,
            heightPx: assetGate.probe.heightPx,
            storagePath: projection.storagePath,
            lifecycle: "asset_stored_clinician_review_required",
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
      planPreview: planResolved.preview,
      asset: {
        mimeType: assetGate.probe.mimeType,
        fileSizeBytes: assetGate.probe.fileSizeBytes,
        widthPx: assetGate.probe.widthPx,
        heightPx: assetGate.probe.heightPx,
        checksumSha256: assetGate.probe.checksumSha256,
        storagePath: assetGate.probe.storagePath,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
