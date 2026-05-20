/**
 * Training case AI review drafts (faculty-only coaching assistant).
 * Requires OPENAI_API_KEY. Set ENABLE_TRAINING_CASE_AI_REVIEW=false to disable explicitly.
 */

export const ENABLE_TRAINING_CASE_AI_REVIEW = "ENABLE_TRAINING_CASE_AI_REVIEW";

export function isTrainingCaseAiReviewFeatureEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const flag = String(env[ENABLE_TRAINING_CASE_AI_REVIEW] ?? "").toLowerCase();
  if (flag === "false") return false;
  return Boolean(env.OPENAI_API_KEY?.trim());
}
