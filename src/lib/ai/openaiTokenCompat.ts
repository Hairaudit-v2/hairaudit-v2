export function usesMaxCompletionTokens(model: string): boolean {
  const m = String(model ?? "").trim().toLowerCase();
  // Rule: GPT‑5.x (incl. GPT‑5.2) requires max_completion_tokens.
  if (m.startsWith("gpt-5")) return true;
  // Also true for current "reasoning" model families which reject max_tokens.
  if (m.startsWith("o1")) return true;
  if (m.startsWith("o3")) return true;
  if (m.startsWith("o4")) return true;
  if (m.includes("reasoning")) return true;
  return false;
}

/**
 * OpenAI compat shim:
 * - Some models reject `max_tokens` and require `max_completion_tokens`.
 * - Others only accept `max_tokens`.
 *
 * Use this when calling `client.chat.completions.create(...)`.
 */
export function maxTokensParam(model: string, n: number): { max_tokens: number } | { max_completion_tokens: number } {
  const limit = Math.max(1, Math.floor(Number(n) || 1));
  return usesMaxCompletionTokens(model) ? { max_completion_tokens: limit } : { max_tokens: limit };
}

