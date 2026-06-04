// HairAudit Mobile Surgery Upload Portal — Stage 5
// Best-effort append-only logging for evidence-review events. Never throws: a
// logging failure must not block a reviewer action or a resubmission.
import type { SupabaseClient } from "@supabase/supabase-js";

export type EvidenceEventType =
  | "evidence_review_status_changed"
  | "slot_review_updated"
  | "additional_evidence_uploaded"
  | "evidence_resubmitted"
  // Stage 6B: controlled audit-pipeline handoff (success or failure carried in metadata.result).
  | "audit_handoff";

export async function logEvidenceEvent(
  admin: SupabaseClient,
  params: {
    caseId: string;
    actorId: string | null;
    eventType: EvidenceEventType;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await admin.from("surgery_upload_evidence_events").insert({
      case_id: params.caseId,
      actor_id: params.actorId,
      event_type: params.eventType,
      metadata: params.metadata ?? null,
    });
  } catch {
    // Table may not exist in older environments; logging is non-critical.
  }
}
