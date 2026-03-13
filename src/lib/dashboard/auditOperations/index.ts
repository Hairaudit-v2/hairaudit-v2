import { demoAuditOperationsAdapter } from "./demoAdapter";
import { liveAuditOperationsAdapter } from "./liveAdapter";
import type {
  AuditKpi,
  AuditPriorityBreakdown,
  AuditStatusBreakdown,
  AuditVolumePoint,
  DashboardRange,
  RecentOperationalAudits,
} from "./types";

function getAdapter() {
  return process.env.AUDITOR_DASHBOARD_DATA_MODE === "live" ? liveAuditOperationsAdapter : demoAuditOperationsAdapter;
}

export function getAuditDashboardMode(): "demo" | "live" {
  return getAdapter().mode;
}

export async function getAuditKpis(range: DashboardRange): Promise<AuditKpi> {
  return getAdapter().getAuditKpis(range);
}

export async function getAuditVolumeSeries(range: DashboardRange): Promise<AuditVolumePoint[]> {
  return getAdapter().getAuditVolumeSeries(range);
}

export async function getAuditStatusBreakdown(range: DashboardRange): Promise<AuditStatusBreakdown> {
  return getAdapter().getAuditStatusBreakdown(range);
}

export async function getAuditPriorityBreakdown(range: DashboardRange): Promise<AuditPriorityBreakdown> {
  return getAdapter().getAuditPriorityBreakdown(range);
}

export async function getRecentOperationalAudits(range: DashboardRange): Promise<RecentOperationalAudits> {
  return getAdapter().getRecentOperationalAudits(range);
}

export type { DashboardRange };
