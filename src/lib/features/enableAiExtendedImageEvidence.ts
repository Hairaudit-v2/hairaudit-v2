/**
 * Stage 4: structured patient image evidence groups for AI audit prompts only.
 * Server-side / Inngest safe — no NEXT_PUBLIC prefix.
 * Rollback: unset or set ENABLE_AI_EXTENDED_IMAGE_EVIDENCE=false.
 */

export const ENABLE_AI_EXTENDED_IMAGE_EVIDENCE = "ENABLE_AI_EXTENDED_IMAGE_EVIDENCE";

export function isAiExtendedImageEvidenceEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return String(env[ENABLE_AI_EXTENDED_IMAGE_EVIDENCE] ?? "").toLowerCase() === "true";
}
