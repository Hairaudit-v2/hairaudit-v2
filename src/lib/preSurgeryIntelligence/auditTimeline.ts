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
  projection_validation_rejected: "Projection validation rejected",
  projection_preflight_rejected: "Projection preflight rejected",
  projection_activation_denied: "Projection activation denied",
  projection_provider_request_sent: "Projection provider request sent",
  projection_provider_accepted: "Projection provider accepted",
  projection_generated: "Projection generated",
  projection_timeout: "Projection timed out",
  projection_provider_failure: "Projection provider failure",
  projection_output_safety_failure: "Projection output safety failure",
  projection_output_validation_failed: "Projection output validation failed",
  projection_clinician_review_opened: "Projection clinician review opened",
  projection_rejected: "Projection rejected",
  projection_approved: "Projection approved",
  projection_regeneration_requested: "Projection regeneration requested",
  projection_patient_sharing_enabled: "Projection patient sharing enabled",
  projection_patient_sharing_revoked: "Projection patient sharing revoked",
  projection_patient_consent_recorded: "Projection patient consent recorded",
  projection_marked_stale: "Projection marked stale",
  projection_superseded: "Projection superseded",
  projection_shadow_review_recorded: "Projection shadow review recorded",
  report_released: "Report released",
};
