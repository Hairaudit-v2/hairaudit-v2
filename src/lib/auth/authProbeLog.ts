/**
 * HA-AUTH-PROFILE-401-FIX — temporary structured auth probes for Vercel logs.
 * Never log tokens, cookie values, OAuth codes, or personal data.
 */

export type AuthProbeFields = {
  pathname?: string | null;
  authUserPresent?: boolean;
  profilePresent?: boolean | null;
  resolvedRole?: string | null;
  requestedNextPath?: string | null;
  callbackExchangeSucceeded?: boolean | null;
  redirectDecision?: string | null;
  redirectReason?: string | null;
  /** Distinguishes expected anonymous GET /api/profiles from real auth faults. */
  probeKind?: "anonymous" | "authenticated" | "callback" | "post_callback" | "auth_fault";
};

export function logAuthProbe(event: string, fields: AuthProbeFields): void {
  console.info(`[auth-probe] ${event}`, {
    pathname: fields.pathname ?? null,
    authUserPresent: fields.authUserPresent ?? false,
    profilePresent: fields.profilePresent ?? null,
    resolvedRole: fields.resolvedRole ?? null,
    requestedNextPath: fields.requestedNextPath ?? null,
    callbackExchangeSucceeded: fields.callbackExchangeSucceeded ?? null,
    redirectDecision: fields.redirectDecision ?? null,
    redirectReason: fields.redirectReason ?? null,
    probeKind: fields.probeKind ?? null,
  });
}
