/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Bounded audit timeline events (no PHI bodies).
 */

import { PRE_SURGERY_INTELLIGENCE_SCHEMA_VERSION } from "./versions";
import type { PreSurgeryAuditEvent, PreSurgeryAuditEventType } from "./types";

export function createAuditEvent(input: {
  caseId: string;
  eventType: PreSurgeryAuditEventType;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  now?: string;
  id?: string;
}): PreSurgeryAuditEvent {
  return {
    id: input.id ?? crypto.randomUUID(),
    caseId: input.caseId,
    eventType: input.eventType,
    actorId: input.actorId ?? null,
    metadata: input.metadata ?? {},
    createdAt: input.now ?? new Date().toISOString(),
    schemaVersion: PRE_SURGERY_INTELLIGENCE_SCHEMA_VERSION,
  };
}

export const AUDIT_EVENT_LABELS: Record<PreSurgeryAuditEventType, string> = {
  ai_analysis_created: "AI analysis created",
  image_role_corrected: "Image role corrected",
  observation_confirmed: "Observation confirmed",
  observation_corrected: "Observation corrected",
  annotation_added: "Annotation added",
  annotation_deleted: "Annotation deleted",
  graft_plan_edited: "Graft plan edited",
  graft_plan_approved: "Graft plan approved",
  projection_requested: "Projection requested",
  projection_generated: "Projection generated",
  projection_rejected: "Projection rejected",
  projection_approved: "Projection approved",
  report_released: "Report released",
};
