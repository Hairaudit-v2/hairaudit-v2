/**
 * FI-OUTCOME-INTELLIGENCE-1E — Patient-safe copy and DTO guards.
 */

import type { GuidedLongitudinalCaptureDto } from "./guidedCaptureDto";

export const FORBIDDEN_GUIDED_CAPTURE_LANGUAGE: readonly RegExp[] = [
  /\bon[- ]track\b/i,
  /\bgrowth\s*%/i,
  /\b\d+\s*%\s*growth\b/i,
  /\bgraft\s+survival\b/i,
  /\byour result should\b/i,
  /\bprojected\s+outcome\b/i,
  /\bcalibrated\b/i,
  /\bimage registered\b/i,
  /\bexact match\b/i,
  /\bAI\b/,
  /\bAuditOS\b/i,
  /\bForensic\b/i,
  /\bPrecision Score\b/i,
  /\bnon[- ]compliant\b/i,
  /\bmissed deadline\b/i,
];

export function scanGuidedCaptureCopyForForbiddenLanguage(
  text: string
): string[] {
  const hits: string[] = [];
  for (const re of FORBIDDEN_GUIDED_CAPTURE_LANGUAGE) {
    if (re.test(text)) hits.push(re.source);
  }
  return hits;
}

export function assertGuidedCaptureCopySafe(
  text: string
): { ok: true } | { ok: false; violations: string[] } {
  const violations = scanGuidedCaptureCopyForForbiddenLanguage(text);
  return violations.length ? { ok: false, violations } : { ok: true };
}

/**
 * Ensure patient DTO does not leak internal IDs, storage paths, or taxonomy keys
 * in patient-visible fields. uploadCategory may use existing postop_month* keys
 * for the upload API (server-selected).
 */
export function assertPatientGuidedCaptureDtoSafe(
  dto: GuidedLongitudinalCaptureDto
): { ok: true } | { ok: false; violations: string[] } {
  const violations: string[] = [];

  if (
    /projectionSnapshotId|"caseId"|"patientId"|service_role/i.test(
      JSON.stringify({
        title: dto.title,
        subtitle: dto.subtitle,
        statusMessage: dto.statusMessage,
        nextAction: dto.nextAction,
      })
    )
  ) {
    violations.push("internal_identity_leak");
  }

  for (const view of dto.views) {
    if (/followup_|patient_photo:/i.test(view.label)) {
      violations.push(`label_taxonomy:${view.label}`);
    }
    for (const line of view.instructions) {
      if (/followup_|postop_month|patient_photo:/i.test(line)) {
        violations.push(`instruction_taxonomy:${line}`);
      }
      const copyHits = scanGuidedCaptureCopyForForbiddenLanguage(line);
      violations.push(...copyHits.map((h) => `forbidden_instruction:${h}`));
    }
    if (
      view.referenceImage.label &&
      /followup_|postop_month|patient_photo:|cases\//i.test(view.referenceImage.label)
    ) {
      violations.push(`reference_label:${view.referenceImage.label}`);
    }
    if (view.referenceImage.url && /\/storage\/v1\/object\/public\//i.test(view.referenceImage.url)) {
      violations.push("public_storage_url");
    }
    if (
      view.currentImage.url &&
      !view.currentImage.url.startsWith("http") &&
      /cases\//i.test(view.currentImage.url)
    ) {
      violations.push("raw_current_path");
    }
  }

  for (const text of [
    dto.title,
    dto.subtitle,
    dto.statusMessage,
    dto.representativeCaptureNote,
    dto.recommendedNote,
    dto.referenceMatchNote,
    dto.earlyUploadNote ?? "",
    ...dto.photographyGuidance,
  ]) {
    const copyHits = scanGuidedCaptureCopyForForbiddenLanguage(text);
    violations.push(...copyHits.map((h) => `forbidden:${h}`));
  }

  return violations.length ? { ok: false, violations } : { ok: true };
}
