/**
 * Internal-only: show image evidence sufficiency on case view / auditor HTML report.
 * Rollback: set ENABLE_INTERNAL_IMAGE_EVIDENCE_QUALITY_PANEL=false
 * Default: enabled when unset (informational only; does not affect scores).
 */

export const ENABLE_INTERNAL_IMAGE_EVIDENCE_QUALITY_PANEL = "ENABLE_INTERNAL_IMAGE_EVIDENCE_QUALITY_PANEL";

export function isInternalImageEvidenceQualityPanelEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return String(env[ENABLE_INTERNAL_IMAGE_EVIDENCE_QUALITY_PANEL] ?? "true").toLowerCase() !== "false";
}
