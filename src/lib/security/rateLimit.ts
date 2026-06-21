/**
 * Best-effort in-memory rate limiter for abuse control on anonymous endpoints
 * (anonymous session creation, uploads). This is process-local: on serverless it
 * limits per warm instance, not globally. It is a first line of defence, not a
 * hard guarantee — swap for a shared store (e.g. Upstash Redis) if stronger
 * guarantees are needed.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfterMs: number };

/**
 * Fixed-window limiter. Allows `limit` events per `windowMs` per `key`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count };
}

/** Derive a stable client key from request headers (proxy-aware). */
export function clientKeyFromHeaders(headers: Headers, fallback = "unknown"): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || fallback;
}
