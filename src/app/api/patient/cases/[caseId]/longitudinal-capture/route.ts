/**
 * GET /api/patient/cases/[caseId]/longitudinal-capture
 *
 * FI-OUTCOME-INTELLIGENCE-1C — Patient-safe prospective capture plan DTO.
 * Identity is server-resolved. Does not send reminders or touch cohort tables.
 */

import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server-auth";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireCaseAccess,
  requirePatientCaseAccess,
  requireUser,
} from "@/lib/auth/permissions";
import { toPatientSafeApiResponse } from "@/lib/patient/patientTrustStatusTranslator";
import { createSupabaseProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotPersist.server";
import { InMemoryProjectionObservationRepository } from "@/lib/projection/projectionObservationRepository";
import { InMemoryProjectionComparisonRepository } from "@/lib/projection/projectionComparisonRepository";
import type { ProjectionObservationSnapshot } from "@/lib/projection/projectionObservationTypes";
import type { ProjectionComparisonSnapshot } from "@/lib/projection/projectionComparisonTypes";
import type { LongitudinalOutcomeObservation } from "@/lib/projection/types";
import type { ProjectionObservedComparison } from "@/lib/projection/types";
import { createLongitudinalCapturePlanService } from "@/lib/outcomeIntelligence/longitudinalCaptureService";
import { createSupabaseLongitudinalCapturePlanRepository } from "@/lib/outcomeIntelligence/longitudinalCapturePersist.server";
import type { ProjectionUploadInput } from "@/lib/projection/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const { caseId } = await context.params;
    const trimmedCaseId = String(caseId ?? "").trim();
    if (!trimmedCaseId) {
      return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
    }

    const supabase = await createSupabaseAuthServerClient();
    const userGate = await requireUser(supabase);
    if (!userGate.ok) return userGate.response;

    const accessGate = await requireCaseAccess({
      userId: userGate.data.user.id,
      caseId: trimmedCaseId,
      supabaseAuth: supabase,
    });
    if (!accessGate.ok) return accessGate.response;

    const patientGate = requirePatientCaseAccess(
      userGate.data.user.id,
      accessGate.data.case
    );
    if (!patientGate.ok) return patientGate.response;

    const admin = tryCreateSupabaseAdminClient();
    const db = admin ?? supabase;

    const url = new URL(req.url);
    const projectionSnapshotIdParam = String(
      url.searchParams.get("projectionSnapshotId") ?? ""
    ).trim();

    const caseRow = accessGate.data.case as {
      id: string;
      patient_id?: string | null;
      user_id?: string | null;
    };
    const patientId = String(
      caseRow.patient_id ?? caseRow.user_id ?? userGate.data.user.id
    );

    if (!admin) {
      return NextResponse.json(
        toPatientSafeApiResponse("Service temporarily unavailable", "status"),
        { status: 503 }
      );
    }

    const projectionRepo = createSupabaseProjectionSnapshotRepository(admin);
    let projectionId = projectionSnapshotIdParam;
    if (!projectionId) {
      const active = await projectionRepo.findCurrentActive({
        caseId: trimmedCaseId,
      });
      if (!active) {
        return NextResponse.json(
          toPatientSafeApiResponse(
            "No frozen projection found for this case",
            "status"
          ),
          { status: 404 }
        );
      }
      projectionId = active.id;
    }

    const projection = await projectionRepo.findById(projectionId);
    if (!projection || projection.caseId !== trimmedCaseId) {
      return NextResponse.json(
        toPatientSafeApiResponse("Projection not found", "status"),
        { status: 404 }
      );
    }
    if (projection.patientId !== patientId) {
      return NextResponse.json(
        toPatientSafeApiResponse("Access denied", "status"),
        { status: 403 }
      );
    }

    const { data: uploadRows, error: uploadError } = await db
      .from("uploads")
      .select("id, type, created_at, captured_at, metadata")
      .eq("case_id", trimmedCaseId);

    if (uploadError) {
      const safe = toPatientSafeApiResponse(uploadError.message, "status");
      return NextResponse.json(safe, { status: 500 });
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

    const captureRepo = createSupabaseLongitudinalCapturePlanRepository(admin);
    const observationRepo = new InMemoryProjectionObservationRepository();
    const comparisonRepo = new InMemoryProjectionComparisonRepository();

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
      // Observation/comparison tables may be unavailable; evidence status still works.
    }

    const service = createLongitudinalCapturePlanService({
      capturePlanRepository: captureRepo,
      projectionRepository: projectionRepo,
      observationRepository: observationRepo,
      comparisonRepository: comparisonRepo,
      loadCaseOwnership: async () => caseRow,
    });

    const resolved = await service.resolveCapturePlan({
      projectionSnapshotId: projectionId,
      caseId: trimmedCaseId,
      patientId,
      uploads,
      ensurePlan: true,
      caseRow,
    });

    if (!resolved.ok) {
      const status =
        resolved.code === "OWNERSHIP_MISMATCH" || resolved.code === "CASE_MISMATCH"
          ? 403
          : resolved.code === "PROJECTION_NOT_FOUND"
            ? 404
            : 400;
      return NextResponse.json(
        toPatientSafeApiResponse(resolved.reason, "status"),
        { status }
      );
    }

    const dto = await service.toPatientDto(resolved.plan);
    return NextResponse.json(dto);
  } catch (error) {
    const safe = toPatientSafeApiResponse(
      String((error as Error)?.message ?? "Server error"),
      "status"
    );
    return NextResponse.json(safe, { status: 500 });
  }
}
