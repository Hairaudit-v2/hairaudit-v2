/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C / OPENAI-IMAGE-PROVIDER-2B — Projection / overlay generation.
 *
 * Graft Allocation Map + Proposed Hairline Design → local-illustrative overlay renderer.
 * Illustrative Projected Outcome → OpenAI gpt-image (preferred) or ImagingOS; never local-illustrative.
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
  updateProjectionRow,
} from "@/lib/preSurgeryIntelligence/repository.server";
import {
  getPathwayEvidencePack,
  isPathwayRequiredUploadComplete,
} from "@/lib/patient/patientReviewPathway";
import {
  resolveCosmeticOutcomeProvider,
  resolveOverlayRendererProvider,
} from "@/lib/preSurgeryIntelligence/projection/health";
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
import {
  isOverlayRendererArtifact,
  isPreSurgeryArtifactType,
  PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
  type PreSurgeryArtifactType,
} from "@/lib/preSurgeryIntelligence/projection/artifactTypes";
import { assertApprovedHairlineDesignForOutcome } from "@/lib/preSurgeryIntelligence/projection/hairlineApprovalGate";
import { createBoundOpenAiGptImageProvider } from "@/lib/preSurgeryIntelligence/projection/openaiGptImageStorage.server";
import { buildRecipientEditMask } from "@/lib/preSurgeryIntelligence/projection/treatmentMask";
import { validateProjectedOutcomeAsset } from "@/lib/preSurgeryIntelligence/projection/outcomeValidation";

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
      artifactType?: PreSurgeryArtifactType;
    };

    if (!body.mode || !MODES.includes(body.mode)) {
      return NextResponse.json({ ok: false, error: "Invalid projection mode" }, { status: 400 });
    }
    if (!body.sourceImageId) {
      return NextResponse.json({ ok: false, error: "sourceImageId required" }, { status: 400 });
    }

    const artifactType: PreSurgeryArtifactType = isPreSurgeryArtifactType(body.artifactType)
      ? body.artifactType
      : "graft_allocation_map";

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
            artifactType,
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

    let provider;
    let providerId: string;
    let modelVersion: string;
    let providerKind: "openai" | "imagingos" | "local_illustrative" | "stub" | "disabled";

    if (artifactType === "illustrative_projected_outcome") {
      const hairlineGate = assertApprovedHairlineDesignForOutcome({
        projections: bundle.projections,
        plan,
        annotations: bundle.annotations,
        sourceImageId: body.sourceImageId,
        allowApprovedAnnotationFallback: true,
      });
      if (!hairlineGate.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: hairlineGate.message,
            code: hairlineGate.code,
          },
          { status: 400 }
        );
      }

      const cosmetic = resolveCosmeticOutcomeProvider();
      if (!cosmetic.available) {
        const failureCode =
          cosmetic.reason === "openai_key_missing"
            ? "openai_key_missing"
            : "imaging_provider_not_configured";
        await insertAuditEvent(
          admin,
          createAuditEvent({
            caseId,
            eventType: "projection_provider_failure",
            actorId: user.id,
            metadata: {
              code: failureCode,
              message: PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
              artifactType,
              audit: cosmetic.audit,
            },
          })
        );
        return NextResponse.json(
          {
            ok: false,
            error: PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
            code: failureCode,
            providerId: cosmetic.providerId,
            providerAudit: cosmetic.audit,
          },
          { status: 503 }
        );
      }

      providerId = cosmetic.providerId;
      modelVersion = cosmetic.modelVersion;

      // Never use local-illustrative for cosmetic projected outcomes.
      if (
        cosmetic.config.kind === "openai" ||
        cosmetic.providerId.toLowerCase().startsWith("openai")
      ) {
        const uploadById = new Map(
          (uploads ?? []).map((u) => [u.id as string, String(u.storage_path ?? "")])
        );
        const bound = createBoundOpenAiGptImageProvider({
          admin,
          resolveImageIdToPath: async (imageId) => uploadById.get(imageId) || null,
        });
        provider = bound.provider;
        providerId = bound.providerId;
        modelVersion = bound.modelVersion;
        providerKind = "openai";
      } else if (cosmetic.config.kind === "imagingos") {
        provider = cosmetic.provider;
        providerKind = "imagingos";
      } else {
        return NextResponse.json(
          {
            ok: false,
            error: PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
            code: "imaging_provider_not_configured",
            providerId: cosmetic.providerId,
          },
          { status: 503 }
        );
      }
    } else if (isOverlayRendererArtifact(artifactType)) {
      const overlay = resolveOverlayRendererProvider();
      const uploadById = new Map(
        (uploads ?? []).map((u) => [u.id as string, String(u.storage_path ?? "")])
      );
      provider = createBoundLocalIllustrativeProvider({
        admin,
        resolveImageIdToPath: async (imageId) => uploadById.get(imageId) || null,
      });
      providerId = overlay.providerId;
      modelVersion = overlay.modelVersion;
      providerKind = "local_illustrative";
    } else {
      return NextResponse.json({ ok: false, error: "Unsupported artifact type" }, { status: 400 });
    }

    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: "projection_requested",
        actorId: user.id,
        metadata: {
          mode: body.mode,
          artifactType,
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
      artifactType,
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
      timeoutMs: providerKind === "openai" ? 180_000 : undefined,
      activation: {
        clinicId: gate.data.caseRow.clinic_id ?? null,
        requestsForCase: bundle.projections.length,
        caseLevelEnabled: true,
        providerKind,
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
      const status = result.errors.some((e) => e.code === "imaging_provider_not_configured")
        ? 503
        : 400;
      return NextResponse.json(
        {
          ok: false,
          errors: result.errors,
          error: result.errors[0]?.message,
          degradable: result.degradable === true,
          providerId: result.providerId,
          projection: result.projection ?? null,
          planPreview: planResolved.preview,
        },
        { status }
      );
    }

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
            providerId,
            artifactType,
          },
        })
      );
      return NextResponse.json(
        {
          ok: false,
          errors: [{ code: assetGate.code, message: assetGate.message || STUB_GENERATION_NO_ASSET_MESSAGE }],
          degradable: true,
          providerId,
          projection: failedProjection,
        },
        { status: 400 }
      );
    }

    // OPENAI-IMAGE-PROVIDER-2B — containment / identity validation for cosmetic outcomes.
    let projectionToStore = result.projection;
    if (artifactType === "illustrative_projected_outcome" && providerKind === "openai") {
      const sourceBytes = await downloadCaseFilesObject(
        admin,
        sourceUpload?.storage_path ? String(sourceUpload.storage_path) : ""
      );
      const outputBytes = await downloadCaseFilesObject(
        admin,
        result.projection.storagePath ?? ""
      );
      if (sourceBytes && outputBytes) {
        const mask = await buildRecipientEditMask({
          sourceBytes,
          plan,
          mode: body.mode,
          annotations: bundle.annotations.filter(
            (a) => a.imageId === body.sourceImageId && a.approved && !a.deletedAt
          ),
        });
        const outcomeGate = await validateProjectedOutcomeAsset({
          sourceBytes,
          outputBytes,
          maskPng: mask.hardMaskPng,
          maskChecksum: mask.hardMaskChecksum,
          expectedMime: "image/jpeg",
        });
        const validationPayload = {
          ...(projectionToStore.inputSnapshot ?? {}),
          outcomeValidation: outcomeGate.measurements,
          hairlineGate,
          openAiProvider: providerId,
          openAiModel: modelVersion,
        };
        if (!outcomeGate.ok) {
          projectionToStore = {
            ...projectionToStore,
            status: "validation_failed",
            failureCode: outcomeGate.code,
            failureMessage: outcomeGate.message,
            patientSharingEnabled: false,
            inputSnapshot: validationPayload,
            planningAssumptions: [
              ...projectionToStore.planningAssumptions,
              `validation=${outcomeGate.code}`,
              `statusHint=${outcomeGate.statusHint}`,
            ],
          };
          try {
            await insertOrReuseProjection(admin, projectionToStore);
          } catch {
            // ignore
          }
          await insertAuditEvent(
            admin,
            createAuditEvent({
              caseId,
              eventType: "projection_output_validation_failed",
              actorId: user.id,
              metadata: {
                code: outcomeGate.code,
                message: outcomeGate.message,
                statusHint: outcomeGate.statusHint,
                providerId,
                measurements: outcomeGate.measurements,
              },
            })
          );
          return NextResponse.json(
            {
              ok: false,
              errors: [{ code: outcomeGate.code, message: outcomeGate.message }],
              degradable: true,
              providerId,
              projection: projectionToStore,
              validation: outcomeGate.measurements,
            },
            { status: 400 }
          );
        }
        projectionToStore = {
          ...projectionToStore,
          inputSnapshot: validationPayload,
          planningAssumptions: [
            ...projectionToStore.planningAssumptions,
            `maskChecksum=${mask.maskChecksum}`,
            `validation=pass`,
          ],
        };
      }
    }

    const stored = await insertOrReuseProjection(admin, projectionToStore);
    await insertAuditEvent(
      admin,
      createAuditEvent({
        caseId,
        eventType: "projection_generated",
        actorId: user.id,
        metadata: {
          projectionId: stored.projection.id,
          mode: body.mode,
          artifactType,
          providerId,
          graftPlanVersion: plan.version,
        },
      })
    );

    return NextResponse.json({
      ok: true,
      projection: stored.projection,
      providerId,
      artifactType,
      planPreview: planResolved.preview,
      insertKind: stored.kind,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Projection request failed" },
      { status: 500 }
    );
  }
}
