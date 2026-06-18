/**
 * HA-INTELLIGENCE-5/6 — mark upload metadata when an auditor manually changes classification or review state.
 */

export type AuditorClassifierCorrectionMarkers = {
  classifier_source: "auditor";
  corrected_at: string;
};

/** Auditor PATCH actions that change classification, visibility, category, or review state. */
export const AUDITOR_CLASSIFIER_CORRECTION_ACTIONS = [
  "reassign",
  "rename",
  "exclude",
  "restore",
] as const;

export type AuditorClassifierCorrectionAction =
  (typeof AUDITOR_CLASSIFIER_CORRECTION_ACTIONS)[number];

export function isAuditorClassifierCorrectionAction(
  action: string
): action is AuditorClassifierCorrectionAction {
  return (AUDITOR_CLASSIFIER_CORRECTION_ACTIONS as readonly string[]).includes(action);
}

/** True when upload metadata carries an auditor manual correction stamp. */
export function isAuditorClassifierProtected(metadata: Record<string, unknown>): boolean {
  const source = String(metadata.classifier_source ?? "")
    .trim()
    .toLowerCase();
  if (source === "auditor" || source === "auditor_correction") return true;
  const correctedAt = metadata.corrected_at;
  return typeof correctedAt === "string" && correctedAt.trim().length > 0;
}

/** Stamp classifier metadata proving an auditor overrode automated classification. */
export function markAuditorClassifierCorrection(
  metadata: Record<string, unknown>,
  correctedAt = new Date().toISOString()
): Record<string, unknown> {
  return {
    ...metadata,
    classifier_source: "auditor",
    corrected_at: correctedAt,
  };
}
