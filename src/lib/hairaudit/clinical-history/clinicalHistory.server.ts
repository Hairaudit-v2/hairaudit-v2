import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  collectClinicalHistoryChangedFields,
  logClinicalHistoryEvent,
} from "./clinicalHistoryAudit";
import {
  type CaseClinicalHistoryRow,
  type ClinicalHistorySnapshot,
  MEDICATION_HISTORY_KEYS,
} from "./clinicalHistoryTypes";
import { normalizeClinicalHistoryPayload } from "./clinicalHistoryValidation";
import {
  buildClinicalHistorySnapshot,
  hasMeaningfulClinicalHistory,
} from "./clinicalHistoryUtils";

export { buildClinicalHistorySnapshot, hasMeaningfulClinicalHistory } from "./clinicalHistoryUtils";

export async function loadCaseClinicalHistory(
  caseId: string,
  client?: SupabaseClient
): Promise<CaseClinicalHistoryRow | null> {
  const db = client ?? createSupabaseAdminClient();
  const { data, error } = await db
    .from("hairaudit_case_clinical_history")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();

  if (error) {
    if (String(error.message).includes("does not exist")) return null;
    throw new Error(`loadCaseClinicalHistory failed: ${error.message}`);
  }
  return (data as CaseClinicalHistoryRow | null) ?? null;
}

export async function upsertCaseClinicalHistory(
  caseId: string,
  body: unknown,
  actorId: string,
  client?: SupabaseClient
): Promise<
  | { ok: true; row: CaseClinicalHistoryRow; snapshot: ClinicalHistorySnapshot; created: boolean }
  | { ok: false; error: string; status: number }
> {
  const parsed = normalizeClinicalHistoryPayload(body);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  const db = client ?? createSupabaseAdminClient();
  const existing = await loadCaseClinicalHistory(caseId, db);
  const now = new Date().toISOString();

  const patch = {
    ...parsed.dbRow,
    case_id: caseId,
    updated_by: actorId,
    updated_at: now,
  };

  if (existing) {
    const { data, error } = await db
      .from("hairaudit_case_clinical_history")
      .update(patch)
      .eq("case_id", caseId)
      .select("*")
      .single();

    if (error) return { ok: false, error: error.message, status: 500 };
    const row = data as CaseClinicalHistoryRow;
    const changedFields = collectClinicalHistoryChangedFields(
      existing as unknown as Record<string, unknown>,
      parsed.dbRow
    );
    if (changedFields.length) {
      await logClinicalHistoryEvent(db, {
        caseId,
        actorId,
        eventType: "clinical_history_updated",
        changedFields,
      });
    }
    return { ok: true, row, snapshot: buildClinicalHistorySnapshot(row), created: false };
  }

  const insertRow = {
    ...patch,
    created_by: actorId,
    created_at: now,
  };
  const { data, error } = await db
    .from("hairaudit_case_clinical_history")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message, status: 500 };
  const row = data as CaseClinicalHistoryRow;
  await logClinicalHistoryEvent(db, {
    caseId,
    actorId,
    eventType: "clinical_history_created",
    changedFields: Object.keys(parsed.dbRow),
  });
  return { ok: true, row, snapshot: buildClinicalHistorySnapshot(row), created: true };
}

/** Deterministic prompt block for AI audit context. */
export function formatClinicalHistoryForPrompt(snapshot: ClinicalHistorySnapshot | null): string {
  if (!snapshot || !hasMeaningfulClinicalHistory(snapshot)) {
    return "(none — no operator-entered structured clinical history for this case)";
  }

  const lines: string[] = [
    "SOURCE: clinician/operator-entered structured data (NOT patient self-diagnosis).",
    "PRIORITY: Treat as high-priority factual context when present. Do NOT invent missing numbers.",
    "INTERNAL: clinician_summary is operator-internal — use for reasoning but do NOT quote verbatim in patient-facing narrative.",
  ];

  const field = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    lines.push(`- ${label}: ${value}`);
  };

  field("Prior surgery count", snapshot.priorSurgeryCount);
  field("Prior procedure type", snapshot.priorProcedureType);
  field("Prior surgery date", snapshot.priorSurgeryDate);
  field("Prior clinic", snapshot.priorClinicName);
  field("Prior surgeon", snapshot.priorSurgeonName);
  field("Prior graft count", snapshot.priorGraftCount);
  field("Estimated hair count", snapshot.estimatedHairCount);
  field("Average hairs per graft", snapshot.averageHairsPerGraft);
  field("Donor grafts removed", snapshot.donorGraftsRemoved);
  if (snapshot.recipientZones.length) {
    lines.push(`- Recipient zones: ${snapshot.recipientZones.join(", ")}`);
  }
  field("Donor depletion level", snapshot.donorDepletionLevel);
  field("Visible scarring level", snapshot.visibleScarringLevel);

  const activeMeds = MEDICATION_HISTORY_KEYS.filter((k) => {
    const v = snapshot.medicationHistory?.[k];
    return v === true || (k === "other" && typeof v === "string" && v.trim());
  });
  if (activeMeds.length) {
    lines.push(`- Medication history flags: ${activeMeds.join(", ")}`);
    if (typeof snapshot.medicationHistory?.other === "string") {
      lines.push(`- Medication other note: ${snapshot.medicationHistory.other}`);
    }
  }

  field("Supporting document notes", snapshot.supportingDocumentNotes);
  if (snapshot.clinicianSummary) {
    lines.push(`- Clinician summary (internal): ${snapshot.clinicianSummary}`);
  }

  if (snapshot.priorGraftCount != null || snapshot.averageHairsPerGraft != null) {
    lines.push(
      "- DONOR MANAGEMENT: When prior graft count and/or hairs/graft ratio are provided, incorporate them explicitly in donor-management reasoning."
    );
  }

  return lines.join("\n");
}

