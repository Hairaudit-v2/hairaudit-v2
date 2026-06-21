/**
 * HA-INTELLIGENCE-7 — read historical intelligence snapshots for professional
 * progression review. Service-role only; never used on patient surfaces.
 */

import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { HAIRAUDIT_INTELLIGENCE_SNAPSHOTS_TABLE } from "./persistHairAuditIntelligenceSnapshot.server";
import type { PatientIntelligenceObservation } from "@/lib/hairaudit-intelligence/patient/patientIntelligenceTranslation";

export type HairAuditIntelligenceSnapshotHistoryRow = {
  id: string;
  reportId: string | null;
  reportVersion: number | null;
  engineVersion: string;
  overallSeverity: string;
  overallConfidence: string;
  classifierSource: string | null;
  executionMode: string | null;
  engineMetadata: Record<string, unknown>;
  patientObservations: PatientIntelligenceObservation[];
  generatedAt: string;
  createdAt: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Load most-recent-first snapshot history for a case. Fail-safe: returns [] on
 * any error (e.g. table missing in older environments). Caller must have already
 * authorized professional (auditor/doctor) access.
 */
export async function loadHairAuditIntelligenceSnapshotsForCase(args: {
  caseId: string;
  limit?: number;
}): Promise<HairAuditIntelligenceSnapshotHistoryRow[]> {
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return [];

  try {
    const res = await admin
      .from(HAIRAUDIT_INTELLIGENCE_SNAPSHOTS_TABLE)
      .select(
        "id, report_id, report_version, engine_version, overall_severity, overall_confidence, classifier_source, execution_mode, engine_metadata, patient_observations, generated_at, created_at"
      )
      .eq("case_id", args.caseId)
      .order("generated_at", { ascending: false })
      .limit(args.limit ?? 20);

    if (res.error || !Array.isArray(res.data)) return [];

    return res.data.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        reportId: (row.report_id as string | null) ?? null,
        reportVersion:
          typeof row.report_version === "number" ? (row.report_version as number) : null,
        engineVersion: String(row.engine_version ?? ""),
        overallSeverity: String(row.overall_severity ?? ""),
        overallConfidence: String(row.overall_confidence ?? ""),
        classifierSource: (row.classifier_source as string | null) ?? null,
        executionMode: (row.execution_mode as string | null) ?? null,
        engineMetadata: isRecord(row.engine_metadata) ? row.engine_metadata : {},
        patientObservations: Array.isArray(row.patient_observations)
          ? (row.patient_observations as PatientIntelligenceObservation[])
          : [],
        generatedAt: String(row.generated_at ?? ""),
        createdAt: String(row.created_at ?? ""),
      };
    });
  } catch {
    return [];
  }
}
