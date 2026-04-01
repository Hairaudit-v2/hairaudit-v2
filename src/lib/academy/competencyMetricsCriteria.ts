import type { TrainingCaseMetricsRow, TrainingCompetencyStepRow } from "./types";

function parsePunchMm(punchSize: string | null | undefined): number | null {
  if (punchSize == null || !String(punchSize).trim()) return null;
  const m = String(punchSize).match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** True if case metrics meet this step's numeric/hybrid criteria (informational; never auto-signs). */
export function metricsSuggestStepCriteria(step: TrainingCompetencyStepRow, metrics: TrainingCaseMetricsRow): boolean {
  const c = step.criteria_json;
  if (!c || typeof c !== "object") return false;

  const assessmentType = (c as { assessment_type?: string }).assessment_type;
  if (assessmentType === "qualitative_checklist") {
    return false;
  }

  const metricKey = c.metric_key as string | undefined;
  const min = c.min != null ? Number(c.min) : null;
  const max = c.max != null ? Number(c.max) : null;
  const punchMax = c.punch_mm_max != null ? Number(c.punch_mm_max) : null;

  const extHr = metrics.extraction_grafts_per_hour != null ? Number(metrics.extraction_grafts_per_hour) : null;
  const impHr = metrics.implantation_grafts_per_hour != null ? Number(metrics.implantation_grafts_per_hour) : null;
  const ratio = metrics.hair_to_graft_ratio != null ? Number(metrics.hair_to_graft_ratio) : null;
  const hairs = metrics.total_hairs != null ? Number(metrics.total_hairs) : null;
  const punchMm = parsePunchMm(metrics.punch_size);
  const tRate = metrics.transection_rate != null ? Number(metrics.transection_rate) : null;
  const oob = metrics.out_of_body_time_estimate != null ? Number(metrics.out_of_body_time_estimate) : null;

  if (metricKey === "extraction_grafts_per_hour" && extHr != null && min != null && extHr >= min) return true;
  if (metricKey === "implantation_grafts_per_hour" && impHr != null && min != null && impHr >= min) return true;
  if (metricKey === "hair_to_graft_ratio" && ratio != null && min != null) {
    const okMin = ratio >= min;
    const okMax = max == null || ratio <= max;
    if (okMin && okMax) return true;
  }
  if (metricKey === "total_hairs" && hairs != null && min != null && hairs >= min) return true;
  if (metricKey === "transection_rate" && tRate != null && max != null && tRate <= max) return true;
  if (metricKey === "out_of_body_time_estimate" && oob != null && max != null && oob <= max) return true;

  if (punchMax != null && punchMm != null) {
    if (punchMax >= 1) {
      if (punchMm <= punchMax + 0.05) return true;
    } else if (punchMm < 1) {
      return true;
    }
  }

  return false;
}
