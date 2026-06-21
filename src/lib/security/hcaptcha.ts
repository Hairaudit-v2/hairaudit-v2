/**
 * Server-side hCaptcha verification for friction-free anonymous entry points.
 *
 * Behaviour is intentionally fail-open in environments where hCaptcha is not
 * configured (local dev / preview without secrets): if `HCAPTCHA_SECRET` is
 * unset we skip verification so the anonymous audit flow still works. When the
 * secret IS set, a missing/invalid token is rejected.
 *
 * Enable in production by setting:
 *   - HCAPTCHA_SECRET (server)
 *   - NEXT_PUBLIC_HCAPTCHA_SITEKEY (client widget)
 */

const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";

export type HcaptchaResult = { ok: true; skipped?: boolean } | { ok: false; reason: string };

export function isHcaptchaConfigured(): boolean {
  return Boolean(process.env.HCAPTCHA_SECRET?.trim());
}

export async function verifyHcaptchaToken(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<HcaptchaResult> {
  const secret = process.env.HCAPTCHA_SECRET?.trim();
  if (!secret) {
    // Not configured — do not block the flow.
    return { ok: true, skipped: true };
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return { ok: false, reason: "missing_token" };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token.trim());
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean };
    if (json?.success === true) return { ok: true };
    return { ok: false, reason: "verification_failed" };
  } catch {
    // Network failure verifying the token: fail closed only when configured.
    return { ok: false, reason: "verify_error" };
  }
}
