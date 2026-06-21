/**
 * HA-INTELLIGENCE-7 — persist historical intelligence snapshots (service role only).
 *
 * Additive, idempotent, PII-free. Callers must wrap in try/catch; persistence
 * failures must never break audit/report jobs. Not authoritative and never read
 * on patient surfaces.
 */

import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import type { HairAuditIntelligenceBundle } from "@/lib/hairaudit-intelligence/types";
import {
  translateIntelligenceForPatient,
  type PatientIntelligenceObservation,
} from "@/lib/hairaudit-intelligence/patient/patientIntelligenceTranslation";

export const HAIRAUDIT_INTELLIGENCE_SNAPSHOTS_TABLE = "hairaudit_intelligence_snapshots" as const;

type EngineMetadataEntry = {
  engineId: string;
  classification: string;
  severity: string;
  confidence: string;
  fields: Record<string, unknown>;
  clinicianNotes: string;
  suggestedNextStep: string;
  limitations: string[];
};

export type HairAuditIntelligenceSnapshotRow = {
  case_id: string;
  report_id: string | null;
  report_version: number | null;
  engine_version: string;
  overall_severity: string;
  overall_confidence: string;
  classifier_source: string | null;
  execution_mode: string | null;
  engine_metadata: { engines: EngineMetadataEntry[] };
  patient_observations: PatientIntelligenceObservation[];
  source_event_name: string | null;
  generated_at: string;
  updated_at: string;
};

function engineEntry(output: {
  engineId: string;
  classification: string;
  severity: string;
  confidence: string;
  fields: Record<string, unknown>;
  clinicianNotes: string;
  suggestedNextStep: string;
  limitations: string[];
}): EngineMetadataEntry {
  return {
    engineId: output.engineId,
    classification: output.classification,
    severity: output.severity,
    confidence: output.confidence,
    fields: output.fields,
    clinicianNotes: output.clinicianNotes,
    suggestedNextStep: output.suggestedNextStep,
    limitations: output.limitations,
  };
}

/**
 * Pure builder (exported for tests): turn a bundle into a persistable, PII-free row.
 * Image storage paths are intentionally excluded — only canonical categories and
 * advisory bands are retained. Patient observations are stored as already-translated
 * calm text (never raw fields).
 */
export function buildHairAuditIntelligenceSnapshotRow(args: {
  caseId: string;
  reportId: string | null;
  reportVersion: number | null;
  bundle: HairAuditIntelligenceBundle;
  sourceEventName?: string | null;
  now?: string;
}): HairAuditIntelligenceSnapshotRow {
  const { bundle } = args;
  const now = args.now ?? new Date().toISOString();
  const patient = translateIntelligenceForPatient(bundle);

  return {
    case_id: args.caseId,
    report_id: args.reportId,
    report_version: args.reportVersion,
    engine_version: bundle.engineVersion,
    overall_severity: bundle.overallSeverity,
    overall_confidence: bundle.overallConfidence,
    classifier_source: bundle.classifierSource ?? null,
    execution_mode: bundle.hairLossClassification?.executionMode ?? null,
    engine_metadata: {
      engines: [
        engineEntry(bundle.hairLossClassification),
        engineEntry(bundle.donorIntelligence),
        engineEntry(bundle.repairSurgery),
        engineEntry(bundle.proceduralIntelligence),
      ],
    },
    patient_observations: patient.observations,
    source_event_name: args.sourceEventName ?? null,
    generated_at: bundle.generatedAt ?? now,
    updated_at: now,
  };
}

export type PersistHairAuditIntelligenceSnapshotResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

/**
 * Upsert by (case_id, report_id, report_version, engine_version). Manual snapshots
 * (no report id) are always inserted.
 */
export async function persistHairAuditIntelligenceSnapshot(args: {
  caseId: string;
  reportId: string | null;
  reportVersion: number | null;
  bundle: HairAuditIntelligenceBundle;
  sourceEventName?: string | null;
}): Promise<PersistHairAuditIntelligenceSnapshotResult> {
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return { ok: false, error: "service_role_unavailable" };

  const row = buildHairAuditIntelligenceSnapshotRow(args);

  try {
    if (row.report_id == null || row.report_version == null) {
      const ins = await admin
        .from(HAIRAUDIT_INTELLIGENCE_SNAPSHOTS_TABLE)
        .insert(row)
        .select("id")
        .maybeSingle();
      if (ins.error) return { ok: false, error: ins.error.message };
      return { ok: true, id: ins.data?.id };
    }

    const existing = await admin
      .from(HAIRAUDIT_INTELLIGENCE_SNAPSHOTS_TABLE)
      .select("id")
      .eq("case_id", row.case_id)
      .eq("report_id", row.report_id)
      .eq("report_version", row.report_version)
      .eq("engine_version", row.engine_version)
      .maybeSingle();
    if (existing.error) return { ok: false, error: existing.error.message };

    if (existing.data?.id) {
      const up = await admin
        .from(HAIRAUDIT_INTELLIGENCE_SNAPSHOTS_TABLE)
        .update({
          overall_severity: row.overall_severity,
          overall_confidence: row.overall_confidence,
          classifier_source: row.classifier_source,
          execution_mode: row.execution_mode,
          engine_metadata: row.engine_metadata,
          patient_observations: row.patient_observations,
          source_event_name: row.source_event_name,
          generated_at: row.generated_at,
          updated_at: row.updated_at,
        })
        .eq("id", existing.data.id);
      if (up.error) return { ok: false, error: up.error.message };
      return { ok: true, id: existing.data.id };
    }

    const ins = await admin
      .from(HAIRAUDIT_INTELLIGENCE_SNAPSHOTS_TABLE)
      .insert(row)
      .select("id")
      .maybeSingle();
    if (ins.error) return { ok: false, error: ins.error.message };
    return { ok: true, id: ins.data?.id };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}
