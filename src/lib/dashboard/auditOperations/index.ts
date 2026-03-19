import { liveAuditOperationsAdapter } from "./liveAdapter";
import type {
  AuditKpi,
  AuditPriorityBreakdown,
  AuditStatusBreakdown,
  AuditVolumePoint,
  DashboardRange,
  RecentOperationalAudits,
} from "./types";

export async function getAuditKpis(range: DashboardRange): Promise<AuditKpi> {
  return liveAuditOperationsAdapter.getAuditKpis(range);
}

export async function getAuditVolumeSeries(range: DashboardRange): Promise<AuditVolumePoint[]> {
  return liveAuditOperationsAdapter.getAuditVolumeSeries(range);
}

export async function getAuditStatusBreakdown(range: DashboardRange): Promise<AuditStatusBreakdown> {
  return liveAuditOperationsAdapter.getAuditStatusBreakdown(range);
}

export async function getAuditPriorityBreakdown(range: DashboardRange): Promise<AuditPriorityBreakdown> {
  return liveAuditOperationsAdapter.getAuditPriorityBreakdown(range);
}

export async function getRecentOperationalAudits(range: DashboardRange): Promise<RecentOperationalAudits> {
  return liveAuditOperationsAdapter.getRecentOperationalAudits(range);
}

export type { DashboardRange };
