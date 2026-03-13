import type {
  AuditKpi,
  AuditOperationsAdapter,
  AuditPriorityBreakdown,
  AuditStatusBreakdown,
  AuditVolumePoint,
  DashboardRange,
  RecentOperationalAudits,
} from "./types";

const rangeDays: Record<DashboardRange, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function buildSeries(range: DashboardRange): AuditVolumePoint[] {
  const days = rangeDays[range];
  const points: AuditVolumePoint[] = [];
  let cumulative = 1200;

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const weekday = d.getDay();
    const base = weekday === 0 || weekday === 6 ? 6 : 10;
    const wave = Math.sin((days - i) / 3) * 2;
    const newAudits = Math.max(3, Math.round(base + wave));
    const completedAudits = Math.max(2, Math.round(newAudits - 1 + Math.cos((days - i) / 4)));
    cumulative += newAudits;
    points.push({
      label: days > 14 ? `${d.getMonth() + 1}/${d.getDate()}` : d.toLocaleDateString(undefined, { weekday: "short" }),
      newAudits,
      completedAudits,
      totalVolume: cumulative,
    });
  }

  return points;
}

function buildKpis(range: DashboardRange): AuditKpi {
  const multiplier = range === "today" ? 1 : range === "7d" ? 1.1 : range === "30d" ? 1.25 : 1.4;
  return {
    newAuditsToday: Math.round(14 * multiplier),
    totalOpenAudits: Math.round(126 * multiplier),
    completedToday: Math.round(11 * multiplier),
    manualReviewQueue: Math.round(24 * multiplier),
    overdueAudits: Math.round(17 * multiplier),
    averageTurnaroundHours: Number((36 / multiplier).toFixed(1)),
    lowConfidenceCases: Math.round(19 * multiplier),
  };
}

function buildStatusBreakdown(range: DashboardRange): AuditStatusBreakdown {
  const factor = range === "today" ? 1 : range === "7d" ? 1.2 : range === "30d" ? 1.45 : 1.7;
  return {
    submitted: Math.round(36 * factor),
    processing: Math.round(28 * factor),
    inReview: Math.round(22 * factor),
    complete: Math.round(64 * factor),
    auditFailed: Math.round(8 * factor),
  };
}

function buildPriorityBreakdown(range: DashboardRange): AuditPriorityBreakdown {
  const factor = range === "today" ? 1 : range === "7d" ? 1.15 : range === "30d" ? 1.3 : 1.55;
  return {
    overdue: Math.round(15 * factor),
    lowConfidence: Math.round(18 * factor),
    evidencePoor: Math.round(13 * factor),
    manualReview: Math.round(21 * factor),
  };
}

function makeRow(seed: number, reason?: string) {
  const now = Date.now();
  const created = new Date(now - seed * 1000 * 60 * 60 * 10);
  const updated = new Date(now - seed * 1000 * 60 * 40);
  return {
    id: `demo-${seed.toString().padStart(4, "0")}`,
    title: `Hair transplant review ${seed}`,
    auditType: (["patient", "doctor", "clinic"] as const)[seed % 3],
    status: ["submitted", "processing", "in_review", "audit_failed"][seed % 4],
    createdAt: created.toISOString(),
    updatedAt: updated.toISOString(),
    confidence: seed % 5 === 0 ? null : Number((0.45 + (seed % 5) * 0.1).toFixed(2)),
    evidenceScore: 48 + ((seed * 7) % 42),
    reason,
  };
}

function buildOperational(range: DashboardRange): RecentOperationalAudits {
  const offset = range === "today" ? 10 : range === "7d" ? 40 : range === "30d" ? 80 : 120;
  return {
    recentAudits: [1, 2, 3, 4, 5, 6].map((n) => makeRow(offset + n)),
    manualInputAudits: [7, 8, 9, 10, 11].map((n) => makeRow(offset + n, "Manual reviewer confirmation required")),
    stuckOrFailedAudits: [12, 13, 14, 15].map((n) => makeRow(offset + n, "No status movement in 72h or failed pipeline status")),
  };
}

export const demoAuditOperationsAdapter: AuditOperationsAdapter = {
  mode: "demo",
  async getAuditKpis(range: DashboardRange): Promise<AuditKpi> {
    return buildKpis(range);
  },
  async getAuditVolumeSeries(range: DashboardRange): Promise<AuditVolumePoint[]> {
    return buildSeries(range);
  },
  async getAuditStatusBreakdown(range: DashboardRange): Promise<AuditStatusBreakdown> {
    return buildStatusBreakdown(range);
  },
  async getAuditPriorityBreakdown(range: DashboardRange): Promise<AuditPriorityBreakdown> {
    return buildPriorityBreakdown(range);
  },
  async getRecentOperationalAudits(range: DashboardRange): Promise<RecentOperationalAudits> {
    return buildOperational(range);
  },
};
