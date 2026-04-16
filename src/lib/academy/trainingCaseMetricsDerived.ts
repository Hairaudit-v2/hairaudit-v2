/** Shared derivation for academy training_case_metrics (UI + API). */

export type PhaseTimestamps = {
  extraction_start_time: string | null;
  extraction_end_time: string | null;
  implantation_start_time: string | null;
  implantation_end_time: string | null;
};

export type DerivedFromTimestamps = {
  extraction_minutes: number | null;
  implantation_minutes: number | null;
  total_minutes: number | null;
  extraction_grafts_per_hour: number | null;
  implantation_grafts_per_hour: number | null;
  /** Average graft out-of-body (seconds), FIFO + uniform-rate linear phases. */
  estimated_tob_seconds: number | null;
  /** Same value persisted as out_of_body_time_estimate (minutes, 2 dp). */
  estimated_tob_minutes: number | null;
};

function parseIsoMs(s: string | null | undefined): number | null {
  if (s == null || !String(s).trim()) return null;
  const t = Date.parse(String(s));
  return Number.isFinite(t) ? t : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** True when all four timestamps parse and each end is on/after its start. */
export function hasCompletePhaseTimestamps(p: PhaseTimestamps): boolean {
  const es = parseIsoMs(p.extraction_start_time);
  const ee = parseIsoMs(p.extraction_end_time);
  const is = parseIsoMs(p.implantation_start_time);
  const ie = parseIsoMs(p.implantation_end_time);
  if (es == null || ee == null || is == null || ie == null) return false;
  if (ee < es || ie < is) return false;
  return true;
}

/**
 * FIFO + uniform extraction / uniform implantation: average OOB per graft (seconds).
 * Not graft-level clock data — label as estimated in UI.
 */
export function fifoAverageTobSeconds(p: PhaseTimestamps): number | null {
  if (!hasCompletePhaseTimestamps(p)) return null;
  const te0 = parseIsoMs(p.extraction_start_time)!;
  const te1 = parseIsoMs(p.extraction_end_time)!;
  const ti0 = parseIsoMs(p.implantation_start_time)!;
  const ti1 = parseIsoMs(p.implantation_end_time)!;
  const teDurSec = (te1 - te0) / 1000;
  const tiDurSec = (ti1 - ti0) / 1000;
  const avgSec = (ti0 - te0) / 1000 + 0.5 * (tiDurSec - teDurSec);
  if (!Number.isFinite(avgSec)) return null;
  return Math.max(0, avgSec);
}

export function deriveTimingAndThroughput(
  p: PhaseTimestamps,
  graftsExtracted: number | null,
  graftsImplanted: number | null,
): DerivedFromTimestamps {
  const empty: DerivedFromTimestamps = {
    extraction_minutes: null,
    implantation_minutes: null,
    total_minutes: null,
    extraction_grafts_per_hour: null,
    implantation_grafts_per_hour: null,
    estimated_tob_seconds: null,
    estimated_tob_minutes: null,
  };
  if (!hasCompletePhaseTimestamps(p)) return empty;

  const te0 = parseIsoMs(p.extraction_start_time)!;
  const te1 = parseIsoMs(p.extraction_end_time)!;
  const ti0 = parseIsoMs(p.implantation_start_time)!;
  const ti1 = parseIsoMs(p.implantation_end_time)!;

  const extraction_minutes = round2((te1 - te0) / 60000);
  const implantation_minutes = round2((ti1 - ti0) / 60000);
  const total_minutes = round2(extraction_minutes + implantation_minutes);

  const ge = graftsExtracted != null && Number.isFinite(Number(graftsExtracted)) ? Number(graftsExtracted) : null;
  const gi = graftsImplanted != null && Number.isFinite(Number(graftsImplanted)) ? Number(graftsImplanted) : null;

  const extraction_grafts_per_hour =
    ge != null && ge > 0 && extraction_minutes > 0 ? round2(ge / (extraction_minutes / 60)) : null;
  const implantation_grafts_per_hour =
    gi != null && gi > 0 && implantation_minutes > 0 ? round2(gi / (implantation_minutes / 60)) : null;

  const tobSec = fifoAverageTobSeconds(p);
  const estimated_tob_seconds = tobSec != null ? round2(tobSec) : null;
  const estimated_tob_minutes = tobSec != null ? round2(tobSec / 60) : null;

  return {
    extraction_minutes,
    implantation_minutes,
    total_minutes,
    extraction_grafts_per_hour,
    implantation_grafts_per_hour,
    estimated_tob_seconds,
    estimated_tob_minutes,
  };
}

/** Academy denominator: hairs per implanted graft when both known. */
export function hairToGraftRatio(totalHairs: number | null, graftsImplanted: number | null): number | null {
  const th = totalHairs != null && Number.isFinite(Number(totalHairs)) ? Number(totalHairs) : null;
  const gi = graftsImplanted != null && Number.isFinite(Number(graftsImplanted)) ? Number(graftsImplanted) : null;
  if (th == null || gi == null || gi <= 0) return null;
  return round3(th / gi);
}

export function rateFromCount(count: number | null, denominator: number | null): number | null {
  if (count == null || denominator == null || denominator <= 0) return null;
  const c = Number(count);
  if (!Number.isFinite(c) || c < 0) return null;
  return round3((c / denominator) * 100);
}
