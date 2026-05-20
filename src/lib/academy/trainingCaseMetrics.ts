/**
 * Shared training case metrics upsert with derived field recalculation.
 * Used by metrics API and faculty correction workflow.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveTrainingCaseMetrics } from "@/lib/academy/trainingCaseMetricsDerived";

export const TRAINING_CASE_METRICS_COLUMNS = [
  "grafts_attempted",
  "grafts_extracted",
  "grafts_implanted",
  "extraction_start_time",
  "extraction_end_time",
  "implantation_start_time",
  "implantation_end_time",
  "extraction_minutes",
  "implantation_minutes",
  "total_minutes",
  "extraction_grafts_per_hour",
  "implantation_grafts_per_hour",
  "transection_rate",
  "buried_graft_rate",
  "popping_rate",
  "transected_grafts_count",
  "buried_grafts_count",
  "popped_grafts_count",
  "out_of_body_time_estimate",
  "punch_size",
  "punch_type",
  "implantation_method",
  "total_hairs",
  "hair_to_graft_ratio",
  "observed_by_trainer",
] as const;

export type TrainingCaseMetricsColumn = (typeof TRAINING_CASE_METRICS_COLUMNS)[number];

const METRICS_V2_OPTIONAL_DB_COLUMNS = [
  "extraction_start_time",
  "extraction_end_time",
  "implantation_start_time",
  "implantation_end_time",
  "transected_grafts_count",
  "buried_grafts_count",
  "popped_grafts_count",
] as const;

function omitKeys(obj: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const o = { ...obj };
  for (const k of keys) delete o[k];
  return o;
}

function isUnknownTrainingMetricsColumnError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  const c = String(err.code ?? "");
  if (m.includes("could not find") && m.includes("column")) return true;
  if (m.includes("schema cache")) return true;
  if (/42703|42P01/.test(c)) return true;
  return false;
}

export function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function readMetricsPatch(
  raw: Record<string, unknown>
): Partial<Record<TrainingCaseMetricsColumn, number | string | boolean | null>> {
  const patch: Partial<Record<TrainingCaseMetricsColumn, number | string | boolean | null>> = {};
  for (const k of TRAINING_CASE_METRICS_COLUMNS) {
    if (raw[k] === undefined) continue;
    const v = raw[k];
    if (k === "observed_by_trainer") {
      patch[k] = Boolean(v);
      continue;
    }
    if (
      k === "punch_size" ||
      k === "punch_type" ||
      k === "implantation_method" ||
      k === "extraction_start_time" ||
      k === "extraction_end_time" ||
      k === "implantation_start_time" ||
      k === "implantation_end_time"
    ) {
      patch[k] = strOrNull(v);
      continue;
    }
    patch[k] = numOrNull(v);
  }
  return patch;
}

export function stripMetricsRow(r: Record<string, unknown> | null | undefined): Partial<Record<TrainingCaseMetricsColumn, unknown>> {
  if (!r) return {};
  const o: Partial<Record<TrainingCaseMetricsColumn, unknown>> = {};
  for (const k of TRAINING_CASE_METRICS_COLUMNS) {
    if (r[k] !== undefined) o[k] = r[k];
  }
  return o;
}

export function buildTrainingCaseMetricsRow(
  caseId: string,
  prev: Record<string, unknown>,
  patch: Partial<Record<TrainingCaseMetricsColumn, number | string | boolean | null>>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...prev, ...patch };

  const primary = {
    grafts_attempted: numOrNull(merged.grafts_attempted),
    grafts_extracted: numOrNull(merged.grafts_extracted),
    grafts_implanted: numOrNull(merged.grafts_implanted),
    total_hairs: numOrNull(merged.total_hairs),
    extraction_start_time: strOrNull(merged.extraction_start_time),
    extraction_end_time: strOrNull(merged.extraction_end_time),
    implantation_start_time: strOrNull(merged.implantation_start_time),
    implantation_end_time: strOrNull(merged.implantation_end_time),
    transected_grafts_count: numOrNull(merged.transected_grafts_count),
    buried_grafts_count: numOrNull(merged.buried_grafts_count),
    popped_grafts_count: numOrNull(merged.popped_grafts_count),
  };

  const derived = deriveTrainingCaseMetrics(primary, {
    transection_rate: numOrNull(merged.transection_rate),
    buried_graft_rate: numOrNull(merged.buried_graft_rate),
    popping_rate: numOrNull(merged.popping_rate),
  });

  const fallNum = (live: number | null, key: TrainingCaseMetricsColumn) =>
    live != null ? live : numOrNull(merged[key]) ?? null;

  const row: Record<string, unknown> = { training_case_id: caseId };
  for (const k of TRAINING_CASE_METRICS_COLUMNS) {
    row[k] = merged[k] !== undefined ? merged[k] : null;
  }

  row.extraction_minutes = fallNum(derived.extraction_minutes, "extraction_minutes");
  row.implantation_minutes = fallNum(derived.implantation_minutes, "implantation_minutes");
  row.total_minutes = fallNum(derived.total_minutes, "total_minutes");
  row.extraction_grafts_per_hour = fallNum(derived.extraction_grafts_per_hour, "extraction_grafts_per_hour");
  row.implantation_grafts_per_hour = fallNum(derived.implantation_grafts_per_hour, "implantation_grafts_per_hour");
  row.hair_to_graft_ratio = fallNum(derived.hair_to_graft_ratio, "hair_to_graft_ratio");
  row.out_of_body_time_estimate = fallNum(derived.out_of_body_time_estimate, "out_of_body_time_estimate");
  row.transection_rate = derived.transection_rate;
  row.buried_graft_rate = derived.buried_graft_rate;
  row.popping_rate = derived.popping_rate;
  row.observed_by_trainer = Boolean(merged.observed_by_trainer);

  return row;
}

export async function upsertTrainingCaseMetrics(
  supabase: SupabaseClient,
  caseId: string,
  patch: Partial<Record<TrainingCaseMetricsColumn, number | string | boolean | null>>
): Promise<{ data: Record<string, unknown> | null; error: { message: string; code?: string } | null }> {
  const { data: existing } = await supabase
    .from("training_case_metrics")
    .select("*")
    .eq("training_case_id", caseId)
    .maybeSingle();

  const prev = stripMetricsRow(existing as Record<string, unknown> | null);
  const row = buildTrainingCaseMetricsRow(caseId, prev, patch);

  let payload: Record<string, unknown> = row;
  let { data, error } = await supabase
    .from("training_case_metrics")
    .upsert(payload, { onConflict: "training_case_id" })
    .select("*")
    .maybeSingle();

  if (error && isUnknownTrainingMetricsColumnError(error)) {
    payload = omitKeys(row, METRICS_V2_OPTIONAL_DB_COLUMNS);
    ({ data, error } = await supabase
      .from("training_case_metrics")
      .upsert(payload, { onConflict: "training_case_id" })
      .select("*")
      .maybeSingle());
  }

  return { data: data as Record<string, unknown> | null, error };
}
