/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Operational metrics for projection generation.
 */

export type ProjectionMetricSample = {
  at: string;
  providerId: string;
  ok: boolean;
  latencyMs: number;
  errorCode?: string | null;
  timedOut?: boolean;
  rejected?: boolean;
  regenerated?: boolean;
  approved?: boolean;
  patientShared?: boolean;
  approvalTurnaroundMs?: number | null;
};

export type ProjectionMetricsSummary = {
  sampleCount: number;
  successRate: number;
  medianLatencyMs: number | null;
  p95LatencyMs: number | null;
  timeoutRate: number;
  providerErrorCategories: Record<string, number>;
  rejectionRate: number;
  regenerationRate: number;
  medianApprovalTurnaroundMs: number | null;
  patientSharingRate: number;
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
}

export function summariseProjectionMetrics(samples: ProjectionMetricSample[]): ProjectionMetricsSummary {
  const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
  const approvalTimes = samples
    .map((s) => s.approvalTurnaroundMs)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  const errors: Record<string, number> = {};
  for (const s of samples) {
    if (s.errorCode) errors[s.errorCode] = (errors[s.errorCode] ?? 0) + 1;
  }
  const n = samples.length || 1;
  return {
    sampleCount: samples.length,
    successRate: samples.filter((s) => s.ok).length / n,
    medianLatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    timeoutRate: samples.filter((s) => s.timedOut).length / n,
    providerErrorCategories: errors,
    rejectionRate: samples.filter((s) => s.rejected).length / n,
    regenerationRate: samples.filter((s) => s.regenerated).length / n,
    medianApprovalTurnaroundMs: percentile(approvalTimes, 50),
    patientSharingRate: samples.filter((s) => s.patientShared).length / n,
  };
}
