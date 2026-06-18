import {
  getConcernBandDisplay,
  PATIENT_CLINICAL_SAFETY_DISCLAIMER,
  type PatientConcernBand,
} from "./patientConcernBands";
import {
  buildPatientSafeReportSummary,
  type PatientSafeSummaryObservation,
} from "./patientSafeSummary";

export type PdfReviewAuditMode = "patient" | "doctor" | "auditor" | "clinic";

/** Merge top-level and forensic_audit findings for PDF review mapping. */
export function normalizeSummaryForPdfReview(
  summary: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!summary || typeof summary !== "object") return {};
  const forensic = (summary.forensic_audit ?? summary.forensic) as Record<string, unknown> | null | undefined;
  return {
    ...summary,
    key_findings: Array.isArray(summary.key_findings)
      ? summary.key_findings
      : Array.isArray(forensic?.key_findings)
        ? forensic.key_findings
        : [],
    red_flags: Array.isArray(summary.red_flags)
      ? summary.red_flags
      : Array.isArray(forensic?.red_flags)
        ? forensic.red_flags
        : [],
  };
}

/**
 * Resolve risks/review lines for print routes (elite + legacy).
 * Patient mode never falls back to legacy summary.risks strings.
 */
export function resolvePdfReviewRisks(
  summary: Record<string, unknown> | null | undefined,
  auditMode: PdfReviewAuditMode
): string[] {
  const normalized = normalizeSummaryForPdfReview(summary);
  const legacyRisks = Array.isArray(normalized.risks) ? (normalized.risks as unknown[]).map(String) : [];
  const findingsRisks = buildPatientPdfReviewAreas(normalized, {
    patientSafe: auditMode === "patient",
  });
  if (findingsRisks.length > 0) return findingsRisks;
  if (auditMode === "patient") return [];
  return legacyRisks;
}

/**
 * Legacy inline HTML layout for highlights + review areas.
 * Patient: review (when present) before positives; omit review when empty.
 */
export function buildLegacyReportFindingsLayoutHtml(args: {
  auditMode: PdfReviewAuditMode;
  highlights: string[];
  risks: string[];
  esc: (s: string) => string;
}): string {
  const { auditMode, highlights, risks, esc } = args;
  const isPatientFacing = auditMode === "patient";

  const highlightsSection = `
        <div class="listCard">
          <div class="listTitle">${isPatientFacing ? "What looks reassuring" : "Highlights"}</div>
          ${
            highlights.length
              ? `<ul>${highlights.map((x) => `<li>${esc(String(x))}</li>`).join("")}</ul>`
              : `<div class="subtitle">${isPatientFacing ? "No strong indicators identified with high confidence." : "No highlights captured yet."}</div>`
          }
        </div>`;

  const reviewSection =
    risks.length > 0
      ? `
        <div class="listCard"${isPatientFacing ? ' style="margin-bottom:12px;border-color:#d97706;"' : ""}>
          <div class="listTitle">${isPatientFacing ? "Areas to discuss with your clinician" : "Risks / Watch-outs"}</div>
          ${
            isPatientFacing
              ? `<div class="subtitle" style="margin-bottom:8px;">Based on uploaded images only — not a medical diagnosis. Image quality may limit interpretation.</div>`
              : ""
          }
          <ul>${risks.map((x) => `<li>${esc(String(x))}</li>`).join("")}</ul>
          ${
            isPatientFacing
              ? `<div class="subtitle" style="margin-top:8px;">${esc(PATIENT_CLINICAL_SAFETY_DISCLAIMER)}</div>`
              : ""
          }
        </div>`
      : isPatientFacing
        ? ""
        : `
        <div class="listCard">
          <div class="listTitle">Risks / Watch-outs</div>
          <div class="subtitle">No risks flagged yet.</div>
        </div>`;

  if (isPatientFacing) {
    return `${highlightsSection}${reviewSection}`;
  }

  return `<div class="twoCol">${highlightsSection}${reviewSection}</div>`;
}

function formatPatientSafeReviewLine(item: PatientSafeSummaryObservation): string {
  const band = item.concernBand ?? "minor";
  const needsCaution =
    item.isRedFlag || band === "significant" || band === "urgent" || band === "needs_review";

  let line = item.text;
  if (needsCaution && !/^this may indicate/i.test(line)) {
    line = `This may indicate: ${line}`;
  }
  if (item.impact) {
    line += ` Why it matters: ${item.impact}`;
  }
  if (item.recommendedNextStep) {
    line += ` Suggested next step: ${item.recommendedNextStep}`;
  } else if (needsCaution) {
    line += " This should be reviewed by a qualified clinician.";
  }
  return line;
}

function formatClinicalReviewLine(item: PatientSafeSummaryObservation): string {
  const parts = [item.text];
  if (item.severity) parts.push(`(${item.severity})`);
  if (item.impact) parts.push(`— ${item.impact}`);
  if (item.recommendedNextStep) parts.push(`→ ${item.recommendedNextStep}`);
  return parts.join(" ");
}

/**
 * Build PDF "Areas Requiring Review" lines from report key_findings / red_flags.
 * Returns empty when no review-worthy items exist (section should be omitted).
 */
export function buildPatientPdfReviewAreas(
  summary: Record<string, unknown> | null | undefined,
  opts?: { patientSafe?: boolean }
): string[] {
  const patientSafe = opts?.patientSafe !== false;
  const report = buildPatientSafeReportSummary(summary);
  const items =
    report.concernItems.length > 0
      ? report.concernItems
      : report.attentionItems.filter((o) => o.isRedFlag);

  if (items.length === 0) return [];

  const formatter = patientSafe ? formatPatientSafeReviewLine : formatClinicalReviewLine;
  return items.map(formatter);
}

export function getPdfReviewSectionMeta(
  summary: Record<string, unknown> | null | undefined
): {
  lines: string[];
  overallBand: PatientConcernBand;
  bandLabel: string;
  disclaimer: string;
} {
  const report = buildPatientSafeReportSummary(summary);
  const lines = buildPatientPdfReviewAreas(summary, { patientSafe: true });
  const display = getConcernBandDisplay(report.overallConcernBand);
  return {
    lines,
    overallBand: report.overallConcernBand,
    bandLabel: display.label,
    disclaimer: report.clinicalDisclaimer,
  };
}
