/**
 * Pure helpers for training case metrics: durations, throughput, hair ratio,
 * optional rates from raw counts, and a FIFO phase-timing estimate for mean TOB.
 */

export type TrainingCaseMetricsPrimaryInput = {
  grafts_attempted: number | null;
  grafts_extracted: number | null;
  grafts_implanted: number | null;
  total_hairs: number | null;
  extraction_start_time: string | null;
  extraction_end_time: string | null;
  implantation_start_time: string | null;
  implantation_end_time: string | null;
  transected_grafts_count: number | null;
  buried_grafts_count: number | null;
  popped_grafts_count: number | null;
};

export type TrainingCaseMetricsManualRates = {
  transection_rate: number | null;
  buried_graft_rate: number | null;
  popping_rate: number | null;
};

export type TrainingCaseMetricsDerived = {
  extraction_minutes: number | null;
  implantation_minutes: number | null;
  total_minutes: number | null;
  extraction_grafts_per_hour: number | null;
  implantation_grafts_per_hour: number | null;
  hair_to_graft_ratio: number | null;
  /** Minutes; same semantic as legacy `out_of_body_time_estimate` column */
  out_of_body_time_estimate: number | null;
  estimated_tob_seconds: number | null;
  transection_rate: number | null;
  buried_graft_rate: number | null;
  popping_rate: number | null;
};

const round = (n: number, dp: number) => {
  const p = 10 ** dp;
  return Math.round(n * p) / p;
};

/** Parse "HH:MM", "HH:MM:SS", or leading "T" fragments to minutes from midnight */
export function clockMinutesFromTimeString(raw: string | null | undefined): number | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim();
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] != null ? Number(m[3]) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(min) || !Number.isFinite(sec)) return null;
  if (h < 0 || h > 47 || min < 0 || min > 59 || sec < 0 || sec > 59) return null;
  return h * 60 + min + sec / 60;
}

/** Positive minutes between two same-calendar-day clock times; handles end after midnight */
export function diffClockMinutes(start: string | null | undefined, end: string | null | undefined): number | null {
  const a = clockMinutesFromTimeString(start);
  const b = clockMinutesFromTimeString(end);
  if (a == null || b == null) return null;
  let d = b - a;
  if (d <= 0) d += 24 * 60;
  return round(d, 2);
}

/**
 * FIFO + uniform phase-rate assumption: mean clock time implanted minus mean clock time extracted.
 * Returns non-negative seconds. Not graft-level true TOB.
 */
export function estimateFifoMeanTobSeconds(params: {
  extraction_start_time: string | null;
  extraction_end_time: string | null;
  implantation_start_time: string | null;
  implantation_end_time: string | null;
}): number | null {
  const extDurMin = diffClockMinutes(params.extraction_start_time, params.extraction_end_time);
  const impDurMin = diffClockMinutes(params.implantation_start_time, params.implantation_end_time);
  if (extDurMin == null || impDurMin == null || extDurMin <= 0 || impDurMin <= 0) return null;
  const ext0 = clockMinutesFromTimeString(params.extraction_start_time);
  const imp0 = clockMinutesFromTimeString(params.implantation_start_time);
  if (ext0 == null || imp0 == null) return null;
  const meanTobMin = imp0 - ext0 + impDurMin / 2 - extDurMin / 2;
  if (!Number.isFinite(meanTobMin)) return null;
  const sec = Math.max(0, meanTobMin * 60);
  return Math.round(sec);
}

function graftsPerHour(grafts: number | null, minutes: number | null): number | null {
  if (grafts == null || minutes == null || minutes <= 0 || !Number.isFinite(grafts) || grafts < 0) return null;
  const v = grafts / (minutes / 60);
  return Number.isFinite(v) ? round(v, 2) : null;
}

function hairToGraftRatio(totalHairs: number | null, graftsImplanted: number | null): number | null {
  if (totalHairs == null || graftsImplanted == null || graftsImplanted <= 0) return null;
  if (!Number.isFinite(totalHairs) || totalHairs < 0) return null;
  return round(totalHairs / graftsImplanted, 3);
}

function ratePercent(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  if (numerator < 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  const v = (numerator / denominator) * 100;
  return Number.isFinite(v) ? round(v, 3) : null;
}

export function deriveTrainingCaseMetrics(
  p: TrainingCaseMetricsPrimaryInput,
  manual: Partial<TrainingCaseMetricsManualRates> = {}
): TrainingCaseMetricsDerived {
  const extraction_minutes = diffClockMinutes(p.extraction_start_time, p.extraction_end_time);
  const implantation_minutes = diffClockMinutes(p.implantation_start_time, p.implantation_end_time);
  const total_minutes =
    extraction_minutes != null && implantation_minutes != null
      ? round(extraction_minutes + implantation_minutes, 2)
      : null;

  const extraction_grafts_per_hour = graftsPerHour(p.grafts_extracted, extraction_minutes);
  const implantation_grafts_per_hour = graftsPerHour(p.grafts_implanted, implantation_minutes);
  const hair_to_graft_ratio = hairToGraftRatio(p.total_hairs, p.grafts_implanted);

  const estimated_tob_seconds = estimateFifoMeanTobSeconds({
    extraction_start_time: p.extraction_start_time,
    extraction_end_time: p.extraction_end_time,
    implantation_start_time: p.implantation_start_time,
    implantation_end_time: p.implantation_end_time,
  });
  const out_of_body_time_estimate =
    estimated_tob_seconds != null ? round(estimated_tob_seconds / 60, 2) : null;

  const transectDenom = p.grafts_attempted != null && p.grafts_attempted > 0 ? p.grafts_attempted : p.grafts_extracted;
  const donorDenom = p.grafts_extracted != null && p.grafts_extracted > 0 ? p.grafts_extracted : null;

  const transection_rate =
    p.transected_grafts_count != null && transectDenom != null && transectDenom > 0
      ? ratePercent(p.transected_grafts_count, transectDenom)
      : manual.transection_rate != null
        ? round(Number(manual.transection_rate), 3)
        : null;

  const buried_graft_rate =
    p.buried_grafts_count != null && donorDenom != null
      ? ratePercent(p.buried_grafts_count, donorDenom)
      : manual.buried_graft_rate != null
        ? round(Number(manual.buried_graft_rate), 3)
        : null;

  const popping_rate =
    p.popped_grafts_count != null && donorDenom != null
      ? ratePercent(p.popped_grafts_count, donorDenom)
      : manual.popping_rate != null
        ? round(Number(manual.popping_rate), 3)
        : null;

  return {
    extraction_minutes,
    implantation_minutes,
    total_minutes,
    extraction_grafts_per_hour,
    implantation_grafts_per_hour,
    hair_to_graft_ratio,
    out_of_body_time_estimate,
    estimated_tob_seconds,
    transection_rate,
    buried_graft_rate,
    popping_rate,
  };
}
