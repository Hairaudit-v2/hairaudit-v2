export type DashboardRange = "today" | "7d" | "30d" | "90d";

export type AuditKpi = {
  newAuditsToday: number;
  totalOpenAudits: number;
  completedToday: number;
  manualReviewQueue: number;
  overdueAudits: number;
  averageTurnaroundHours: number;
  lowConfidenceCases: number;
};

export type AuditVolumePoint = {
  label: string;
  newAudits: number;
  completedAudits: number;
  totalVolume: number;
};

export type AuditStatusBreakdown = {
  submitted: number;
  processing: number;
  inReview: number;
  complete: number;
  auditFailed: number;
};

export type AuditPriorityBreakdown = {
  overdue: number;
  lowConfidence: number;
  evidencePoor: number;
  manualReview: number;
};

export type OperationalAuditRow = {
  id: string;
  title: string;
  auditType: "patient" | "doctor" | "clinic" | "internal";
  status: string;
  createdAt: string;
  updatedAt: string;
  confidence: number | null;
  evidenceScore: number | null;
  reason?: string;
};

export type RecentOperationalAudits = {
  recentAudits: OperationalAuditRow[];
  manualInputAudits: OperationalAuditRow[];
  stuckOrFailedAudits: OperationalAuditRow[];
};

export type AuditOperationsAdapter = {
  mode: "demo" | "live";
  getAuditKpis(range: DashboardRange): Promise<AuditKpi>;
  getAuditVolumeSeries(range: DashboardRange): Promise<AuditVolumePoint[]>;
  getAuditStatusBreakdown(range: DashboardRange): Promise<AuditStatusBreakdown>;
  getAuditPriorityBreakdown(range: DashboardRange): Promise<AuditPriorityBreakdown>;
  getRecentOperationalAudits(range: DashboardRange): Promise<RecentOperationalAudits>;
};
