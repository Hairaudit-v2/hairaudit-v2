import type { SupabaseClient } from "@supabase/supabase-js";

export type ClinicalHistoryAuditEventType =
  | "clinical_history_created"
  | "clinical_history_updated"
  | "clinical_history_used_for_regeneration";

const CLINICAL_HISTORY_FIELD_KEYS = [
  "prior_surgery_count",
  "prior_procedure_type",
  "prior_surgery_date",
  "prior_clinic_name",
  "prior_surgeon_name",
  "prior_graft_count",
  "estimated_hair_count",
  "average_hairs_per_graft",
  "donor_grafts_removed",
  "recipient_zones",
  "donor_depletion_level",
  "visible_scarring_level",
  "medication_history",
  "supporting_document_notes",
  "clinician_summary",
] as const;

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function collectClinicalHistoryChangedFields(
  prev: Record<string, unknown> | null,
  next: Record<string, unknown>
): string[] {
  const changed: string[] = [];
  for (const field of CLINICAL_HISTORY_FIELD_KEYS) {
    const oldVal = prev?.[field] ?? null;
    const newVal = next[field] ?? null;
    if (!jsonEqual(oldVal, newVal)) changed.push(field);
  }
  return changed;
}

/**
 * Best-effort append to cases.processing_log — mirrors auditor rerun tracking style.
 * Logs field names only, not full values (PII-safe).
 */
export async function logClinicalHistoryEvent(
  admin: SupabaseClient,
  params: {
    caseId: string;
    actorId: string;
    eventType: ClinicalHistoryAuditEventType;
    changedFields?: string[];
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const { data: c } = await admin
      .from("cases")
      .select("processing_log")
      .eq("id", params.caseId)
      .maybeSingle();

    const existingLog = Array.isArray((c as { processing_log?: unknown[] } | null)?.processing_log)
      ? ((c as { processing_log: unknown[] }).processing_log as unknown[])
      : [];

    const now = new Date().toISOString();
    await admin
      .from("cases")
      .update({
        processing_log: [
          ...existingLog,
          {
            at: now,
            event: params.eventType,
            case_id: params.caseId,
            by: params.actorId,
            changed_fields: params.changedFields ?? [],
            ...params.metadata,
          },
        ],
      })
      .eq("id", params.caseId);
  } catch {
    // Non-critical — do not block save/regenerate.
  }
}
