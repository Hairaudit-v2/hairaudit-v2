import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCaseFilesBucketNameForReadOnlyUse } from "@/lib/hairaudit/uploadStorage";
import { normalizeAcademyPhotoCategoryInput, trainingPhotoType } from "@/lib/academy/photoCategories";
import { readMetricsPatch, upsertTrainingCaseMetrics } from "@/lib/academy/trainingCaseMetrics";
import { recordFieldCorrections, recordTrainingCaseCorrection } from "./audit";
import { SENSITIVE_CASE_FIELDS, SENSITIVE_METRICS_FIELDS } from "./constants";
import {
  archiveCaseSchema,
  caseDetailsCorrectionSchema,
  metricsCorrectionSchema,
  restoreCaseSchema,
  softDeleteCaseSchema,
  uploadCategoryCorrectionSchema,
  uploadDeleteCorrectionSchema,
  validateMetricsNumbers,
} from "./validation";

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const TRAINING_CASE_DERIVED_KEYS = [
  "extraction_minutes",
  "implantation_minutes",
  "total_minutes",
  "extraction_grafts_per_hour",
  "implantation_grafts_per_hour",
  "hair_to_graft_ratio",
  "out_of_body_time_estimate",
  "transection_rate",
  "buried_graft_rate",
  "popping_rate",
];

function collectChanges(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  keys: string[]
): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
  const out: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
  for (const field of keys) {
    if (next[field] === undefined) continue;
    const oldValue = prev[field] ?? null;
    const newValue = next[field] ?? null;
    if (!jsonEqual(oldValue, newValue)) out.push({ field, oldValue, newValue });
  }
  return out;
}

export async function updateTrainingCaseDetails(
  supabase: SupabaseClient,
  caseId: string,
  userId: string,
  body: unknown
) {
  const parsed = caseDetailsCorrectionSchema.safeParse(body);
  if (!parsed.success) return { ok: false as const, status: 400, error: parsed.error.message };

  const { data: prev, error: fetchErr } = await supabase.from("training_cases").select("*").eq("id", caseId).maybeSingle();
  if (fetchErr) return { ok: false as const, status: 500, error: fetchErr.message };
  if (!prev) return { ok: false as const, status: 404, error: "Not found" };

  const { reason, ...fields } = parsed.data;
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) return { ok: false as const, status: 400, error: "No fields to update" };

  const sensitiveTouched = Object.keys(patch).some((k) => SENSITIVE_CASE_FIELDS.has(k));
  if (sensitiveTouched && !reason) {
    return { ok: false as const, status: 400, error: "Correction reason required" };
  }

  if (patch.status === "archived" || patch.status === "voided") {
    patch.archived_at = new Date().toISOString();
    patch.archived_by = userId;
    patch.archive_reason = reason;
  }

  const { data, error } = await supabase.from("training_cases").update(patch).eq("id", caseId).select("*").maybeSingle();
  if (error) return { ok: false as const, status: 500, error: error.message };
  if (!data) return { ok: false as const, status: 404, error: "Not found" };

  const changes = collectChanges(prev as Record<string, unknown>, patch, Object.keys(patch));
  if (changes.length) {
    const audit = await recordFieldCorrections(supabase, {
      caseId,
      userId,
      correctionType: "case_details_update",
      reason,
      changes,
    });
    if (!audit.ok) return { ok: false as const, status: 500, error: audit.error };
  }

  return { ok: true as const, case: data };
}

export async function updateTrainingCaseMetrics(
  supabase: SupabaseClient,
  caseId: string,
  userId: string,
  body: unknown,
  opts?: { acknowledgeHairWarning?: boolean }
) {
  const parsed = metricsCorrectionSchema.safeParse(body);
  if (!parsed.success) return { ok: false as const, status: 400, error: parsed.error.message };

  const metricsErr = validateMetricsNumbers(parsed.data.metrics);
  if (metricsErr?.includes("confirm this is intentional") && !opts?.acknowledgeHairWarning) {
    return { ok: false as const, status: 409, error: metricsErr, code: "hair_below_grafts" as const };
  }
  if (metricsErr && !metricsErr.includes("confirm this is intentional")) {
    return { ok: false as const, status: 400, error: metricsErr };
  }

  const { data: prev } = await supabase.from("training_case_metrics").select("*").eq("training_case_id", caseId).maybeSingle();
  const patch = readMetricsPatch(parsed.data.metrics);
  if (Object.keys(patch).length === 0) return { ok: false as const, status: 400, error: "No metrics to update" };

  const { data, error } = await upsertTrainingCaseMetrics(supabase, caseId, patch);
  if (error) return { ok: false as const, status: 500, error: error.message };

  const prevRow = (prev ?? {}) as Record<string, unknown>;
  const nextRow = (data ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(patch), ...TRAINING_CASE_DERIVED_KEYS])];
  const changes = collectChanges(prevRow, nextRow, keys).filter((c) => {
    if (SENSITIVE_METRICS_FIELDS.has(c.field)) return true;
    return TRAINING_CASE_DERIVED_KEYS.includes(c.field);
  });

  if (changes.length) {
    const audit = await recordFieldCorrections(supabase, {
      caseId,
      userId,
      correctionType: "metrics_update",
      reason: parsed.data.reason,
      changes,
    });
    if (!audit.ok) return { ok: false as const, status: 500, error: audit.error };
  }

  return { ok: true as const, metrics: data };
}

export async function updateTrainingCaseUploadCategory(
  supabase: SupabaseClient,
  uploadId: string,
  userId: string,
  body: unknown
) {
  const parsed = uploadCategoryCorrectionSchema.safeParse(body);
  if (!parsed.success) return { ok: false as const, status: 400, error: parsed.error.message };

  const category = normalizeAcademyPhotoCategoryInput(parsed.data.category);
  if (!category) return { ok: false as const, status: 400, error: "Invalid photo category" };

  const { data: row, error: fetchErr } = await supabase
    .from("training_case_uploads")
    .select("*")
    .eq("id", uploadId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr) return { ok: false as const, status: 500, error: fetchErr.message };
  if (!row) return { ok: false as const, status: 404, error: "Upload not found" };

  const newType = trainingPhotoType(category);
  const metadata = { ...(row.metadata_json as Record<string, unknown>), ...(parsed.data.caption != null ? { caption: parsed.data.caption } : {}) };

  const { data, error } = await supabase
    .from("training_case_uploads")
    .update({ type: newType, metadata_json: metadata })
    .eq("id", uploadId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false as const, status: 500, error: error.message };

  const audit = await recordTrainingCaseCorrection(supabase, {
    training_case_id: row.training_case_id,
    changed_by: userId,
    correction_type: "upload_category_update",
    field_name: "type",
    old_value: { type: row.type, metadata_json: row.metadata_json },
    new_value: { type: newType, metadata_json: metadata },
    reason: parsed.data.reason,
  });
  if (!audit.ok) return { ok: false as const, status: 500, error: audit.error };

  return { ok: true as const, upload: data };
}

export async function deleteTrainingCaseUpload(
  supabase: SupabaseClient,
  uploadId: string,
  userId: string,
  body: unknown
) {
  const parsed = uploadDeleteCorrectionSchema.safeParse(body);
  if (!parsed.success) return { ok: false as const, status: 400, error: parsed.error.message };

  const admin = createSupabaseAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("training_case_uploads")
    .select("id, training_case_id, storage_path, type, deleted_at")
    .eq("id", uploadId)
    .maybeSingle();

  if (fetchErr) return { ok: false as const, status: 500, error: fetchErr.message };
  if (!row || row.deleted_at) return { ok: false as const, status: 404, error: "Upload not found" };

  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("training_case_uploads")
    .update({ deleted_at: now, deleted_by: userId })
    .eq("id", uploadId);

  if (updErr) return { ok: false as const, status: 500, error: updErr.message };

  const bucket = getCaseFilesBucketNameForReadOnlyUse();
  const { error: stErr } = await admin.storage.from(bucket).remove([row.storage_path]);
  if (stErr) {
    console.warn("[training_case_corrections] storage remove failed (soft-deleted in DB)", stErr.message);
  }

  const audit = await recordTrainingCaseCorrection(supabase, {
    training_case_id: row.training_case_id,
    changed_by: userId,
    correction_type: "upload_delete",
    field_name: "upload_id",
    old_value: { id: row.id, type: row.type, storage_path: row.storage_path },
    new_value: { deleted_at: now },
    reason: parsed.data.reason,
  });
  if (!audit.ok) return { ok: false as const, status: 500, error: audit.error };

  return { ok: true as const, caseId: row.training_case_id };
}

export async function archiveTrainingCase(
  supabase: SupabaseClient,
  caseId: string,
  userId: string,
  body: unknown
) {
  const parsed = archiveCaseSchema.safeParse(body);
  if (!parsed.success) return { ok: false as const, status: 400, error: parsed.error.message };

  const status = parsed.data.mode;
  const now = new Date().toISOString();
  const { data: prev } = await supabase.from("training_cases").select("status, archived_at").eq("id", caseId).maybeSingle();

  const { data, error } = await supabase
    .from("training_cases")
    .update({
      status,
      archived_at: now,
      archived_by: userId,
      archive_reason: parsed.data.reason,
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
    })
    .eq("id", caseId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false as const, status: 500, error: error.message };
  if (!data) return { ok: false as const, status: 404, error: "Not found" };

  const audit = await recordTrainingCaseCorrection(supabase, {
    training_case_id: caseId,
    changed_by: userId,
    correction_type: status === "voided" ? "case_voided" : "case_archived",
    field_name: "status",
    old_value: { status: prev?.status, archived_at: prev?.archived_at },
    new_value: { status, archived_at: now, archive_reason: parsed.data.reason },
    reason: parsed.data.reason,
  });
  if (!audit.ok) return { ok: false as const, status: 500, error: audit.error };

  return { ok: true as const, case: data };
}

export async function restoreTrainingCase(
  supabase: SupabaseClient,
  caseId: string,
  userId: string,
  body: unknown
) {
  const parsed = restoreCaseSchema.safeParse(body);
  if (!parsed.success) return { ok: false as const, status: 400, error: parsed.error.message };

  const { data: prev } = await supabase
    .from("training_cases")
    .select("status, archived_at, deleted_at")
    .eq("id", caseId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("training_cases")
    .update({
      status: "draft",
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
    })
    .eq("id", caseId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false as const, status: 500, error: error.message };
  if (!data) return { ok: false as const, status: 404, error: "Not found" };

  const audit = await recordTrainingCaseCorrection(supabase, {
    training_case_id: caseId,
    changed_by: userId,
    correction_type: "case_restored",
    field_name: "status",
    old_value: prev,
    new_value: { status: "draft", archived_at: null, deleted_at: null },
    reason: parsed.data.reason,
  });
  if (!audit.ok) return { ok: false as const, status: 500, error: audit.error };

  return { ok: true as const, case: data };
}

export async function softDeleteTrainingCase(
  supabase: SupabaseClient,
  caseId: string,
  userId: string,
  body: unknown
) {
  const parsed = softDeleteCaseSchema.safeParse(body);
  if (!parsed.success) return { ok: false as const, status: 400, error: parsed.error.message };

  const now = new Date().toISOString();
  const { data: prev } = await supabase.from("training_cases").select("deleted_at, status").eq("id", caseId).maybeSingle();

  const { data, error } = await supabase
    .from("training_cases")
    .update({
      deleted_at: now,
      deleted_by: userId,
      delete_reason: parsed.data.reason,
    })
    .eq("id", caseId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false as const, status: 500, error: error.message };
  if (!data) return { ok: false as const, status: 404, error: "Not found" };

  const audit = await recordTrainingCaseCorrection(supabase, {
    training_case_id: caseId,
    changed_by: userId,
    correction_type: "case_deleted",
    field_name: "deleted_at",
    old_value: { deleted_at: prev?.deleted_at, status: prev?.status },
    new_value: { deleted_at: now, delete_reason: parsed.data.reason },
    reason: parsed.data.reason,
  });
  if (!audit.ok) return { ok: false as const, status: 500, error: audit.error };

  return { ok: true as const, case: data };
}

export async function hardDeleteTrainingCase(supabase: SupabaseClient, caseId: string, userId: string, reason: string) {
  const [{ count: reviewCount }, { count: assessmentCount }] = await Promise.all([
    supabase.from("training_case_reviews").select("id", { count: "exact", head: true }).eq("training_case_id", caseId),
    supabase.from("training_case_assessments").select("id", { count: "exact", head: true }).eq("training_case_id", caseId),
  ]);

  if ((reviewCount ?? 0) > 0 || (assessmentCount ?? 0) > 0) {
    return {
      ok: false as const,
      status: 409,
      error: "Case has linked reviews or assessments. Use archive/void or soft delete instead.",
    };
  }

  await recordTrainingCaseCorrection(supabase, {
    training_case_id: caseId,
    changed_by: userId,
    correction_type: "case_deleted",
    field_name: "hard_delete",
    old_value: { case_id: caseId },
    new_value: null,
    reason,
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("training_cases").delete().eq("id", caseId);
  if (error) return { ok: false as const, status: 500, error: error.message };

  return { ok: true as const };
}
