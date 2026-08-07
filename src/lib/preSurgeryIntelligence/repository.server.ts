/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Supabase persistence helpers (service-role).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClinicalImageAnnotation,
  ClinicalImageReview,
  ClinicalImageReviewCorrection,
  ClinicalObservation,
  PreSurgeryAuditEvent,
  PreSurgeryGraftPlan,
  PreSurgeryIllustrativeProjection,
} from "./types";
import type { PreSurgeryProjectionCorrection } from "./projectionCorrections";
import type { ProjectionLearningSignal } from "./projectionLearningSignals";

export async function upsertImageReview(
  admin: SupabaseClient,
  review: ClinicalImageReview
): Promise<void> {
  const { error } = await admin.from("hairaudit_pre_surgery_image_reviews").upsert(
    {
      id: review.id,
      case_id: review.caseId,
      image_id: review.imageId,
      schema_version: review.schemaVersion,
      payload: review,
      updated_at: review.updatedAt,
      created_at: review.createdAt,
    },
    { onConflict: "case_id,image_id" }
  );
  if (error) throw new Error(error.message);
}

export async function insertImageCorrections(
  admin: SupabaseClient,
  corrections: ClinicalImageReviewCorrection[]
): Promise<void> {
  if (corrections.length === 0) return;
  const { error } = await admin.from("hairaudit_pre_surgery_image_corrections").insert(
    corrections.map((c) => ({
      id: c.id,
      case_id: c.caseId,
      image_id: c.imageId,
      review_id: c.reviewId,
      field: c.field,
      previous_value: c.previousValue,
      next_value: c.nextValue,
      original_ai_value: c.originalAiValue,
      reviewed_by: c.reviewedBy,
      reviewed_at: c.reviewedAt,
      reason: c.reason,
      model_or_ruleset_version: c.modelOrRulesetVersion,
    }))
  );
  if (error) throw new Error(error.message);
}

export async function insertAnnotation(
  admin: SupabaseClient,
  annotation: ClinicalImageAnnotation
): Promise<void> {
  const { error } = await admin.from("hairaudit_pre_surgery_annotations").insert({
    id: annotation.id,
    case_id: annotation.caseId,
    image_id: annotation.imageId,
    schema_version: annotation.schemaVersion,
    payload: annotation,
    supersedes_annotation_id: annotation.supersedesAnnotationId ?? null,
    deleted_at: annotation.deletedAt ?? null,
    created_by: annotation.createdBy,
    created_at: annotation.createdAt,
  });
  if (error) throw new Error(error.message);
}

export async function softDeleteAnnotationRow(
  admin: SupabaseClient,
  annotation: ClinicalImageAnnotation
): Promise<void> {
  const { error } = await admin
    .from("hairaudit_pre_surgery_annotations")
    .update({ deleted_at: annotation.deletedAt, payload: annotation })
    .eq("id", annotation.id);
  if (error) throw new Error(error.message);
}

export async function restoreAnnotationRow(
  admin: SupabaseClient,
  annotation: ClinicalImageAnnotation
): Promise<void> {
  const { error } = await admin
    .from("hairaudit_pre_surgery_annotations")
    .update({ deleted_at: null, payload: annotation })
    .eq("id", annotation.id);
  if (error) throw new Error(error.message);
}

export async function updateProjectionRow(
  admin: SupabaseClient,
  projection: PreSurgeryIllustrativeProjection
): Promise<void> {
  const { error } = await admin
    .from("hairaudit_pre_surgery_projections")
    .update({
      status: projection.status,
      payload: projection,
      approved_by: projection.approvedBy,
      approved_at: projection.approvedAt,
      rejected_by: projection.rejectedBy,
      rejected_at: projection.rejectedAt,
      rejection_reason: projection.rejectionReason,
      output_checksum: projection.outputChecksum,
      storage_path: projection.storagePath,
      provider_id: projection.providerId ?? null,
      provider_request_id: projection.providerRequestId ?? null,
      provider_response_id: projection.providerResponseId ?? null,
      idempotency_key: projection.idempotencyKey ?? null,
      projection_version: projection.projectionVersion ?? 1,
      patient_sharing_enabled: projection.patientSharingEnabled === true,
      regenerates_from_projection_id: projection.regeneratesFromProjectionId ?? null,
      stale_at: projection.staleAt ?? null,
      stale_reasons: projection.staleReasons ?? null,
      shadow_mode: projection.shadowMode === true,
      quality_cohort_category: projection.qualityCohortCategory ?? null,
      patient_consent_id: projection.patientConsentId ?? null,
    })
    .eq("id", projection.id);
  if (error) throw new Error(error.message);
}

export async function upsertObservation(
  admin: SupabaseClient,
  observation: ClinicalObservation
): Promise<void> {
  const { error } = await admin.from("hairaudit_pre_surgery_observations").upsert(
    {
      id: observation.id,
      case_id: observation.caseId,
      domain: observation.domain,
      schema_version: observation.schemaVersion,
      payload: observation,
      status: observation.status,
      updated_at: observation.updatedAt,
      created_at: observation.createdAt,
    },
    { onConflict: "case_id,domain" }
  );
  if (error) throw new Error(error.message);
}

export async function insertGraftPlan(
  admin: SupabaseClient,
  plan: PreSurgeryGraftPlan
): Promise<void> {
  const { error } = await admin.from("hairaudit_pre_surgery_graft_plans").insert({
    id: plan.id,
    case_id: plan.caseId,
    version: plan.version,
    schema_version: plan.schemaVersion,
    status: plan.status,
    checksum: plan.checksum,
    payload: plan,
    previous_plan_id: plan.previousPlanId ?? null,
    ai_seed_plan_id: plan.aiSeedPlanId ?? null,
    created_by: plan.createdBy,
    created_at: plan.createdAt,
    approved_by: plan.approvedBy ?? null,
    approved_at: plan.approvedAt ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function markGraftPlanSuperseded(
  admin: SupabaseClient,
  planId: string
): Promise<void> {
  const { data, error } = await admin
    .from("hairaudit_pre_surgery_graft_plans")
    .select("payload")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.payload) return;
  const payload = { ...(data.payload as PreSurgeryGraftPlan), status: "superseded" as const };
  const { error: upErr } = await admin
    .from("hairaudit_pre_surgery_graft_plans")
    .update({ status: "superseded", payload })
    .eq("id", planId);
  if (upErr) throw new Error(upErr.message);
}

export async function insertProjection(
  admin: SupabaseClient,
  projection: PreSurgeryIllustrativeProjection
): Promise<void> {
  const { error } = await admin.from("hairaudit_pre_surgery_projections").insert({
    id: projection.id,
    case_id: projection.caseId,
    graft_plan_id: projection.graftPlanId,
    graft_plan_version: projection.graftPlanVersion,
    source_image_id: projection.sourceImageId,
    mode: projection.mode,
    status: projection.status,
    engine_version: projection.engineVersion,
    input_checksum: projection.inputChecksum,
    output_checksum: projection.outputChecksum,
    storage_path: projection.storagePath,
    payload: projection,
    requested_by: projection.requestedBy,
    requested_at: projection.requestedAt,
    generated_at: projection.generatedAt,
    approved_by: projection.approvedBy,
    approved_at: projection.approvedAt,
    rejected_by: projection.rejectedBy,
    rejected_at: projection.rejectedAt,
    rejection_reason: projection.rejectionReason,
    provider_id: projection.providerId ?? null,
    provider_request_id: projection.providerRequestId ?? null,
    provider_response_id: projection.providerResponseId ?? null,
    idempotency_key: projection.idempotencyKey ?? null,
    projection_version: projection.projectionVersion ?? 1,
    patient_sharing_enabled: projection.patientSharingEnabled === true,
    regenerates_from_projection_id: projection.regeneratesFromProjectionId ?? null,
    stale_at: projection.staleAt ?? null,
    stale_reasons: projection.staleReasons ?? null,
    shadow_mode: projection.shadowMode === true,
    quality_cohort_category: projection.qualityCohortCategory ?? null,
    patient_consent_id: projection.patientConsentId ?? null,
  });
  if (error) throw new Error(error.message);
}

function isProjectionIdempotencyConflict(message: string): boolean {
  return (
    /idx_ha_pre_surgery_projections_idempotency/i.test(message) ||
    (/duplicate key value violates unique constraint/i.test(message) &&
      /idempotency/i.test(message))
  );
}

export async function findProjectionByIdempotencyKey(
  admin: SupabaseClient,
  caseId: string,
  idempotencyKey: string
): Promise<PreSurgeryIllustrativeProjection | null> {
  const { data, error } = await admin
    .from("hairaudit_pre_surgery_projections")
    .select("payload")
    .eq("case_id", caseId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.payload as PreSurgeryIllustrativeProjection | undefined) ?? null;
}

export type InsertOrReuseProjectionResult =
  | { kind: "inserted"; projection: PreSurgeryIllustrativeProjection }
  | { kind: "reused"; projection: PreSurgeryIllustrativeProjection }
  | { kind: "replaced"; projection: PreSurgeryIllustrativeProjection };

/**
 * Insert a projection snapshot. On idempotency conflict:
 * - reuse clinician_review / approved / generated rows (identical retry)
 * - release the key on failed / validation_failed / rejected / expired rows and insert the new attempt
 */
export async function insertOrReuseProjection(
  admin: SupabaseClient,
  projection: PreSurgeryIllustrativeProjection
): Promise<InsertOrReuseProjectionResult> {
  try {
    await insertProjection(admin, projection);
    return { kind: "inserted", projection };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!isProjectionIdempotencyConflict(message)) throw e;
  }

  const key = projection.idempotencyKey?.trim() ?? "";
  if (!key) {
    throw new Error("Idempotency conflict without idempotency_key");
  }

  const existing = await findProjectionByIdempotencyKey(admin, projection.caseId, key);
  if (!existing) {
    throw new Error("Idempotency conflict but existing projection not found");
  }

  const reusable =
    existing.status === "clinician_review" ||
    existing.status === "approved" ||
    existing.status === "generated" ||
    existing.status === "queued" ||
    existing.status === "generating";
  if (reusable) {
    return { kind: "reused", projection: existing };
  }

  const releasedKey = `${key}:released:${existing.id}`;
  const releasedPayload: PreSurgeryIllustrativeProjection = {
    ...existing,
    idempotencyKey: releasedKey,
  };
  const { error: releaseErr } = await admin
    .from("hairaudit_pre_surgery_projections")
    .update({
      idempotency_key: releasedKey,
      payload: releasedPayload,
    })
    .eq("id", existing.id);
  if (releaseErr) throw new Error(releaseErr.message);

  await insertProjection(admin, projection);
  return { kind: "replaced", projection };
}

export async function insertAuditEvent(
  admin: SupabaseClient,
  event: PreSurgeryAuditEvent
): Promise<void> {
  const { error } = await admin.from("hairaudit_pre_surgery_audit_events").insert({
    id: event.id,
    case_id: event.caseId,
    event_type: event.eventType,
    actor_id: event.actorId,
    metadata: event.metadata,
    schema_version: event.schemaVersion,
    created_at: event.createdAt,
  });
  if (error) throw new Error(error.message);
}

export async function insertProjectionCorrection(
  admin: SupabaseClient,
  correction: PreSurgeryProjectionCorrection,
  learningSignal?: ProjectionLearningSignal | null
): Promise<void> {
  const { error } = await admin.from("hairaudit_pre_surgery_projection_corrections").insert({
    id: correction.id,
    case_id: correction.caseId,
    projection_snapshot_id: correction.projectionSnapshotId,
    projection_version: correction.projectionVersion,
    schema_version: correction.schemaVersion,
    status: correction.status,
    correction_codes: correction.correctionCodes,
    clinical_note: correction.clinicalNote,
    zone_refs: correction.zoneRefs,
    geometry_type: correction.geometryType,
    coordinates: correction.coordinates,
    suggested_mode: correction.suggestedMode,
    supersedes_correction_id: correction.supersedesCorrectionId,
    learning_signal_id: learningSignal?.id ?? correction.learningSignalId,
    learning_signal: learningSignal ?? null,
    payload: correction,
    created_by: correction.createdBy,
    created_at: correction.createdAt,
    updated_by: correction.updatedBy,
    updated_at: correction.updatedAt,
  });
  if (error) throw new Error(error.message);
}

export async function updateProjectionCorrectionStatus(
  admin: SupabaseClient,
  correction: PreSurgeryProjectionCorrection
): Promise<void> {
  const { error } = await admin
    .from("hairaudit_pre_surgery_projection_corrections")
    .update({
      status: correction.status,
      updated_by: correction.updatedBy,
      updated_at: correction.updatedAt,
      payload: correction,
    })
    .eq("id", correction.id)
    .eq("case_id", correction.caseId);
  if (error) throw new Error(error.message);
}

export async function listProjectionCorrections(
  admin: SupabaseClient,
  caseId: string,
  projectionSnapshotId?: string
): Promise<PreSurgeryProjectionCorrection[]> {
  let q = admin
    .from("hairaudit_pre_surgery_projection_corrections")
    .select("payload")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  if (projectionSnapshotId) {
    q = q.eq("projection_snapshot_id", projectionSnapshotId);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.payload as PreSurgeryProjectionCorrection).filter(Boolean);
}

export async function loadWorkspaceBundle(
  admin: SupabaseClient,
  caseId: string,
  opts?: { includeDeletedAnnotations?: boolean }
): Promise<{
  imageReviews: ClinicalImageReview[];
  annotations: ClinicalImageAnnotation[];
  observations: ClinicalObservation[];
  graftPlans: PreSurgeryGraftPlan[];
  projections: PreSurgeryIllustrativeProjection[];
  auditEvents: PreSurgeryAuditEvent[];
}> {
  let annotationsQuery = admin
    .from("hairaudit_pre_surgery_annotations")
    .select("payload")
    .eq("case_id", caseId);
  // 2B: include soft-deleted annotations so history remains reviewable when requested.
  if (!opts?.includeDeletedAnnotations) {
    annotationsQuery = annotationsQuery.is("deleted_at", null);
  }

  const [reviews, annotations, observations, plans, projections, events] = await Promise.all([
    admin.from("hairaudit_pre_surgery_image_reviews").select("payload").eq("case_id", caseId),
    annotationsQuery,
    admin.from("hairaudit_pre_surgery_observations").select("payload").eq("case_id", caseId),
    admin
      .from("hairaudit_pre_surgery_graft_plans")
      .select("payload")
      .eq("case_id", caseId)
      .order("version", { ascending: true }),
    admin
      .from("hairaudit_pre_surgery_projections")
      .select("status, patient_sharing_enabled, payload")
      .eq("case_id", caseId)
      .order("requested_at", { ascending: false }),
    admin
      .from("hairaudit_pre_surgery_audit_events")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const mapPayload = <T>(rows: { payload?: unknown }[] | null): T[] =>
    (rows ?? []).map((r) => r.payload as T).filter(Boolean);

  const mapProjections = (
    rows:
      | {
          status?: string | null;
          patient_sharing_enabled?: boolean | null;
          payload?: unknown;
        }[]
      | null
  ): PreSurgeryIllustrativeProjection[] =>
    (rows ?? [])
      .map((r) => {
        const payload = r.payload as PreSurgeryIllustrativeProjection | null | undefined;
        if (!payload) return null;
        // Column status / sharing are authoritative when they diverge from embedded payload
        // (e.g. supersede wrote column first or payload lagged).
        return {
          ...payload,
          status: (r.status as PreSurgeryIllustrativeProjection["status"]) ?? payload.status,
          patientSharingEnabled:
            typeof r.patient_sharing_enabled === "boolean"
              ? r.patient_sharing_enabled
              : payload.patientSharingEnabled === true,
        };
      })
      .filter(Boolean) as PreSurgeryIllustrativeProjection[];

  return {
    imageReviews: mapPayload(reviews.data),
    annotations: mapPayload(annotations.data),
    observations: mapPayload(observations.data),
    graftPlans: mapPayload(plans.data),
    projections: mapProjections(projections.data),
    auditEvents: (events.data ?? []).map((e) => ({
      id: e.id,
      caseId: e.case_id,
      eventType: e.event_type,
      actorId: e.actor_id,
      metadata: e.metadata ?? {},
      createdAt: e.created_at,
      schemaVersion: e.schema_version,
    })),
  };
}
