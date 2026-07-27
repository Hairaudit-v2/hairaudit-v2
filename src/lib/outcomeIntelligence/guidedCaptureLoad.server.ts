/**
 * FI-OUTCOME-INTELLIGENCE-1E — Shared server loader for guided capture DTOs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  gateUploadCaseStoragePath,
  resolveCaseFilesBucketForRoute,
} from "@/lib/hairaudit/uploadStorage";
import { createLongitudinalCapturePlanService } from "@/lib/outcomeIntelligence/longitudinalCaptureService";
import { createSupabaseLongitudinalCapturePlanRepository } from "@/lib/outcomeIntelligence/longitudinalCapturePersist.server";
import { createSupabaseProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotPersist.server";
import { InMemoryProjectionObservationRepository } from "@/lib/projection/projectionObservationRepository";
import { InMemoryProjectionComparisonRepository } from "@/lib/projection/projectionComparisonRepository";
import type { ProjectionObservationSnapshot } from "@/lib/projection/projectionObservationTypes";
import type { ProjectionComparisonSnapshot } from "@/lib/projection/projectionComparisonTypes";
import type { LongitudinalOutcomeObservation } from "@/lib/projection/types";
import type { ProjectionObservedComparison } from "@/lib/projection/types";
import type { ProjectionUploadInput } from "@/lib/projection/types";
import type { LongitudinalOutcomeStage } from "@/lib/projection/types";
import {
  buildGuidedCaptureLandingDto,
  buildGuidedLongitudinalCaptureDto,
  isLongitudinalOutcomeStage,
} from "@/lib/outcomeIntelligence/guidedCaptureBuilder";
import { isGuidedCaptureUiEnabled } from "@/lib/outcomeIntelligence/guidedCaptureConfig";
import type {
  GuidedCaptureLandingDto,
  GuidedLongitudinalCaptureDto,
} from "@/lib/outcomeIntelligence/guidedCaptureDto";

export type GuidedCaptureLoadError = {
  ok: false;
  status: number;
  message: string;
  code?: string;
};

export type GuidedCaptureLoadOk = {
  ok: true;
  guided: GuidedLongitudinalCaptureDto;
  landing: GuidedCaptureLandingDto;
};

async function hydrateObservationRepos(
  admin: SupabaseClient,
  projectionId: string,
  observationRepo: InMemoryProjectionObservationRepository,
  comparisonRepo: InMemoryProjectionComparisonRepository
): Promise<void> {
  try {
    const { data: obsRows } = await admin
      .from("hairaudit_projection_observations")
      .select("*")
      .eq("projection_snapshot_id", projectionId)
      .eq("observation_status", "active");

    for (const obsRow of obsRows ?? []) {
      const snap: ProjectionObservationSnapshot = {
        id: String(obsRow.id),
        projectionSnapshotId: String(obsRow.projection_snapshot_id),
        caseId: String(obsRow.case_id),
        patientId: String(obsRow.patient_id),
        stage: obsRow.stage,
        observedAt: String(obsRow.observed_at),
        observationStatus: obsRow.observation_status,
        observationSchemaVersion: String(obsRow.observation_schema_version),
        observationLineageVersion: String(obsRow.observation_lineage_version),
        observationChecksum: String(obsRow.observation_checksum),
        observationPayload:
          obsRow.observation_payload as LongitudinalOutcomeObservation,
        createdAt: String(obsRow.created_at),
        createdBy: obsRow.created_by ?? null,
        supersedesObservationId: obsRow.supersedes_observation_id ?? null,
        supersededByObservationId: obsRow.superseded_by_observation_id ?? null,
        supersessionReasonCode: obsRow.supersession_reason_code ?? null,
        sourceReportId: obsRow.source_report_id ?? null,
        sourceAuditId: obsRow.source_audit_id ?? null,
      };
      await observationRepo.insert(snap);
    }

    const { data: cmpRows } = await admin
      .from("hairaudit_projection_comparisons")
      .select("*")
      .eq("projection_snapshot_id", projectionId)
      .eq("comparison_status", "active");

    for (const cmpRow of cmpRows ?? []) {
      const snap: ProjectionComparisonSnapshot = {
        id: String(cmpRow.id),
        projectionSnapshotId: String(cmpRow.projection_snapshot_id),
        observationSnapshotId: String(cmpRow.observation_snapshot_id),
        caseId: String(cmpRow.case_id),
        patientId: String(cmpRow.patient_id),
        stage: cmpRow.stage,
        comparisonStatus: cmpRow.comparison_status,
        comparisonSchemaVersion: String(cmpRow.comparison_schema_version),
        projectionSchemaVersion: String(cmpRow.projection_schema_version),
        observationSchemaVersion: String(cmpRow.observation_schema_version),
        comparisonChecksum: String(cmpRow.comparison_checksum),
        comparisonPayload:
          cmpRow.comparison_payload as ProjectionObservedComparison,
        createdAt: String(cmpRow.created_at),
        createdBy: cmpRow.created_by ?? null,
        supersedesComparisonId: cmpRow.supersedes_comparison_id ?? null,
        supersededByComparisonId: cmpRow.superseded_by_comparison_id ?? null,
        supersessionReasonCode: cmpRow.supersession_reason_code ?? null,
      };
      await comparisonRepo.insert(snap);
    }
  } catch {
    // Optional tables
  }
}

export async function loadGuidedLongitudinalCapture(args: {
  admin: SupabaseClient;
  caseId: string;
  patientId: string;
  caseRow: { id: string; patient_id?: string | null; user_id?: string | null };
  stage: string;
  projectionSnapshotId?: string | null;
}): Promise<GuidedCaptureLoadOk | GuidedCaptureLoadError> {
  const stageRaw = String(args.stage ?? "").trim();
  if (!isLongitudinalOutcomeStage(stageRaw)) {
    return {
      ok: false,
      status: 400,
      message: "Invalid follow-up stage",
      code: "INVALID_STAGE",
    };
  }
  const stage = stageRaw as LongitudinalOutcomeStage;

  const projectionRepo = createSupabaseProjectionSnapshotRepository(args.admin);
  let projectionId = String(args.projectionSnapshotId ?? "").trim();
  if (!projectionId) {
    const active = await projectionRepo.findCurrentActive({ caseId: args.caseId });
    if (!active) {
      return {
        ok: false,
        status: 404,
        message: "No frozen projection found for this case",
        code: "PROJECTION_NOT_FOUND",
      };
    }
    projectionId = active.id;
  }

  const projection = await projectionRepo.findById(projectionId);
  if (!projection || projection.caseId !== args.caseId) {
    return {
      ok: false,
      status: 404,
      message: "Projection not found",
      code: "PROJECTION_NOT_FOUND",
    };
  }
  if (projection.patientId !== args.patientId) {
    return {
      ok: false,
      status: 403,
      message: "Access denied",
      code: "OWNERSHIP_MISMATCH",
    };
  }

  const { data: uploadRows, error: uploadError } = await args.admin
    .from("uploads")
    .select("id, type, created_at, captured_at, metadata, storage_path")
    .eq("case_id", args.caseId);

  if (uploadError) {
    return {
      ok: false,
      status: 500,
      message: "Could not load photos",
      code: "UPLOAD_LOAD_FAILED",
    };
  }

  const uploads: ProjectionUploadInput[] = (uploadRows ?? []).map((u) => ({
    id: String((u as { id?: string }).id ?? ""),
    type: (u as { type?: string | null }).type ?? null,
    created_at: (u as { created_at?: string | null }).created_at ?? null,
    captured_at: (u as { captured_at?: string | null }).captured_at ?? null,
    metadata:
      ((u as { metadata?: Record<string, unknown> | null }).metadata as
        | Record<string, unknown>
        | null) ?? null,
  }));

  const referenceUploads = (uploadRows ?? []).map((u) => ({
    id: String((u as { id?: string }).id ?? ""),
    type: (u as { type?: string | null }).type ?? null,
    storage_path: (u as { storage_path?: string | null }).storage_path ?? null,
    created_at: (u as { created_at?: string | null }).created_at ?? null,
  }));

  const captureRepo = createSupabaseLongitudinalCapturePlanRepository(args.admin);
  const observationRepo = new InMemoryProjectionObservationRepository();
  const comparisonRepo = new InMemoryProjectionComparisonRepository();
  await hydrateObservationRepos(
    args.admin,
    projectionId,
    observationRepo,
    comparisonRepo
  );

  const service = createLongitudinalCapturePlanService({
    capturePlanRepository: captureRepo,
    projectionRepository: projectionRepo,
    observationRepository: observationRepo,
    comparisonRepository: comparisonRepo,
    loadCaseOwnership: async () => args.caseRow,
  });

  const resolved = await service.resolveCapturePlan({
    projectionSnapshotId: projectionId,
    caseId: args.caseId,
    patientId: args.patientId,
    uploads,
    ensurePlan: true,
    caseRow: args.caseRow,
  });

  if (!resolved.ok) {
    const status =
      resolved.code === "OWNERSHIP_MISMATCH" || resolved.code === "CASE_MISMATCH"
        ? 403
        : resolved.code === "PROJECTION_NOT_FOUND"
          ? 404
          : 400;
    return { ok: false, status, message: resolved.reason, code: resolved.code };
  }

  const milestone = resolved.plan.milestones.find((m) => m.stage === stage);
  if (!milestone) {
    return {
      ok: false,
      status: 404,
      message: "Follow-up stage not found on capture plan",
      code: "STAGE_NOT_ON_PLAN",
    };
  }

  const bucketGate = resolveCaseFilesBucketForRoute();
  const resolveSignedUrl = async (storagePath: string): Promise<string | null> => {
    if (!bucketGate.ok) return null;
    const pathGate = gateUploadCaseStoragePath(args.caseId, storagePath);
    if (!pathGate.ok) return null;
    const { data } = await args.admin.storage
      .from(bucketGate.bucket)
      .createSignedUrl(pathGate.normalizedPath, 60 * 10);
    return data?.signedUrl ?? null;
  };

  const uiEnabled = isGuidedCaptureUiEnabled();
  const guided = await buildGuidedLongitudinalCaptureDto({
    plan: resolved.plan,
    milestone,
    uploads: referenceUploads,
    resolveSignedUrl,
    uiEnabled,
    allowEarlyUpload: false,
  });
  const landing = buildGuidedCaptureLandingDto({
    plan: resolved.plan,
    uiEnabled,
  });

  return { ok: true, guided, landing };
}

export async function loadGuidedCaptureLanding(args: {
  admin: SupabaseClient;
  caseId: string;
  patientId: string;
  caseRow: { id: string; patient_id?: string | null; user_id?: string | null };
  projectionSnapshotId?: string | null;
}): Promise<
  | { ok: true; landing: GuidedCaptureLandingDto }
  | GuidedCaptureLoadError
> {
  // Reuse stage loader with month_3 solely to resolve plan; prefer direct resolve.
  const projectionRepo = createSupabaseProjectionSnapshotRepository(args.admin);
  let projectionId = String(args.projectionSnapshotId ?? "").trim();
  if (!projectionId) {
    const active = await projectionRepo.findCurrentActive({ caseId: args.caseId });
    if (!active) {
      return {
        ok: false,
        status: 404,
        message: "No frozen projection found for this case",
        code: "PROJECTION_NOT_FOUND",
      };
    }
    projectionId = active.id;
  }

  const projection = await projectionRepo.findById(projectionId);
  if (!projection || projection.caseId !== args.caseId) {
    return {
      ok: false,
      status: 404,
      message: "Projection not found",
      code: "PROJECTION_NOT_FOUND",
    };
  }
  if (projection.patientId !== args.patientId) {
    return {
      ok: false,
      status: 403,
      message: "Access denied",
      code: "OWNERSHIP_MISMATCH",
    };
  }

  const { data: uploadRows, error: uploadError } = await args.admin
    .from("uploads")
    .select("id, type, created_at, captured_at, metadata")
    .eq("case_id", args.caseId);

  if (uploadError) {
    return {
      ok: false,
      status: 500,
      message: "Could not load photos",
      code: "UPLOAD_LOAD_FAILED",
    };
  }

  const uploads: ProjectionUploadInput[] = (uploadRows ?? []).map((u) => ({
    id: String((u as { id?: string }).id ?? ""),
    type: (u as { type?: string | null }).type ?? null,
    created_at: (u as { created_at?: string | null }).created_at ?? null,
    captured_at: (u as { captured_at?: string | null }).captured_at ?? null,
    metadata:
      ((u as { metadata?: Record<string, unknown> | null }).metadata as
        | Record<string, unknown>
        | null) ?? null,
  }));

  const captureRepo = createSupabaseLongitudinalCapturePlanRepository(args.admin);
  const observationRepo = new InMemoryProjectionObservationRepository();
  const comparisonRepo = new InMemoryProjectionComparisonRepository();
  await hydrateObservationRepos(
    args.admin,
    projectionId,
    observationRepo,
    comparisonRepo
  );

  const service = createLongitudinalCapturePlanService({
    capturePlanRepository: captureRepo,
    projectionRepository: projectionRepo,
    observationRepository: observationRepo,
    comparisonRepository: comparisonRepo,
    loadCaseOwnership: async () => args.caseRow,
  });

  const resolved = await service.resolveCapturePlan({
    projectionSnapshotId: projectionId,
    caseId: args.caseId,
    patientId: args.patientId,
    uploads,
    ensurePlan: true,
    caseRow: args.caseRow,
  });

  if (!resolved.ok) {
    const status =
      resolved.code === "OWNERSHIP_MISMATCH" || resolved.code === "CASE_MISMATCH"
        ? 403
        : resolved.code === "PROJECTION_NOT_FOUND"
          ? 404
          : 400;
    return { ok: false, status, message: resolved.reason, code: resolved.code };
  }

  return {
    ok: true,
    landing: buildGuidedCaptureLandingDto({
      plan: resolved.plan,
      uiEnabled: isGuidedCaptureUiEnabled(),
    }),
  };
}
