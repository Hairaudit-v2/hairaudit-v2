import {
  clearPersistedClaimToken,
  resolveActiveClaimToken,
  resolveClaimDashboardPath,
} from "@/lib/nexus/claimTokenClient";

export { DOCTOR_DASHBOARD_PATH, CLINIC_DASHBOARD_PATH, resolveClaimDashboardPath } from "@/lib/nexus/claimTokenClient";

export type ClaimAfterAuthResult =
  | { ok: true; redirectPath: string }
  | { ok: false; error: string; redirectPath?: string };

export async function claimAccountAfterAuth(
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<ClaimAfterAuthResult> {
  const normalized = token.trim();
  if (!normalized) {
    return { ok: false, error: "Claim token is required." };
  }

  try {
    const res = await fetchImpl("/api/nexus/account-claim/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token: normalized }),
    });
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; error?: string; subjectType?: "doctor" | "clinic" }
      | null;
    if (res.ok && body?.ok) {
      clearPersistedClaimToken();
      const subjectType = body.subjectType === "clinic" ? "clinic" : "doctor";
      return { ok: true, redirectPath: resolveClaimDashboardPath(subjectType) };
    }
    const error =
      typeof body?.error === "string" && body.error.trim()
        ? body.error.trim()
        : "We could not activate your account. Please contact support.";
    return { ok: false, error };
  } catch {
    return {
      ok: false,
      error: "We could not activate your account. Please try again.",
    };
  }
}

export async function completeAuthWithOptionalClaim(input: {
  queryToken?: string | null;
  persistedToken?: string | null;
  defaultRedirect: string;
  fetchImpl?: typeof fetch;
}): Promise<ClaimAfterAuthResult> {
  const token = resolveActiveClaimToken(input.queryToken, input.persistedToken);
  if (!token) {
    return { ok: true, redirectPath: input.defaultRedirect };
  }
  return claimAccountAfterAuth(token, input.fetchImpl);
}
