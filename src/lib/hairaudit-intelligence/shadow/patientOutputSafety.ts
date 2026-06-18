/**
 * HA-INTELLIGENCE-2 — helpers proving patient render paths do not surface advisory intelligence.
 */

import { buildReportViewModel } from "@/lib/pdf/reportBuilder";
import type { AuditReportContent } from "@/lib/pdf/reportBuilder";
import { buildPatientSafeReportSummary } from "@/lib/reports/patientSafeSummary";

const FORBIDDEN_PATIENT_LEAK_TERMS = [
  "clinicianNotes",
  "hairAuditIntelligence",
  "Forensic AI",
  "AuditOS",
  "Precision Score",
  "Surgical Intelligence",
  "Intelligence Engine",
  "GPT",
  "Platinum Tier",
  "Gold Tier",
] as const;

/** Collect text that patient-safe summary and patient PDF view models would expose. */
export function collectPatientVisibleReportText(summary: Record<string, unknown>): string {
  const safe = buildPatientSafeReportSummary(summary);
  const forensic = summary.forensic_audit as Record<string, unknown> | undefined;
  const content: AuditReportContent = {
    caseId: "patient-output-safety",
    version: 1,
    generatedAt: new Date().toISOString(),
    auditMode: "patient",
    score: Number(summary.score ?? forensic?.overall_score ?? 0),
    findings: Array.isArray(summary.findings) ? summary.findings : [],
    model: String(forensic?.model ?? summary.model ?? ""),
    uploadCount: 0,
    forensic: forensic
      ? {
          summary: typeof forensic.summary === "string" ? forensic.summary : undefined,
          key_findings: Array.isArray(forensic.key_findings) ? forensic.key_findings : undefined,
          red_flags: Array.isArray(forensic.red_flags) ? forensic.red_flags : undefined,
          non_medical_disclaimer:
            typeof forensic.non_medical_disclaimer === "string" ? forensic.non_medical_disclaimer : undefined,
        }
      : undefined,
  };
  const vm = buildReportViewModel({ auditMode: "patient", content });
  return JSON.stringify({ safe, vm });
}

export function assertPatientOutputDoesNotLeakIntelligence(summary: Record<string, unknown>): void {
  const text = collectPatientVisibleReportText(summary);
  for (const term of FORBIDDEN_PATIENT_LEAK_TERMS) {
    if (text.includes(term)) {
      throw new Error(`Patient output leaked forbidden term: ${term}`);
    }
  }
}

export { FORBIDDEN_PATIENT_LEAK_TERMS };
