import type { AccountClaimInvalidReason, AccountClaimValidationResult } from "@/lib/nexus/accountClaimTypes";

export const CLAIM_TOKEN_SESSION_KEY = "hairaudit:account_claim_token";
export const DOCTOR_DASHBOARD_PATH = "/dashboard/doctor";

export type ClaimValidationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "valid"; validation: Extract<AccountClaimValidationResult, { valid: true }> }
  | { status: "invalid"; reason: AccountClaimInvalidReason | "unknown" | "network" };

export type ClaimSignupViewMode = "normal" | "claim";

export function normalizeClaimToken(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function getClaimTokenFromSearchParams(params: URLSearchParams): string | null {
  return normalizeClaimToken(params.get("claimToken"));
}

export function persistClaimToken(token: string): void {
  try {
    sessionStorage.setItem(CLAIM_TOKEN_SESSION_KEY, token);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPersistedClaimToken(): string | null {
  try {
    return normalizeClaimToken(sessionStorage.getItem(CLAIM_TOKEN_SESSION_KEY));
  } catch {
    return null;
  }
}

export function clearPersistedClaimToken(): void {
  try {
    sessionStorage.removeItem(CLAIM_TOKEN_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function resolveActiveClaimToken(
  queryToken: string | null | undefined,
  persistedToken?: string | null
): string | null {
  return normalizeClaimToken(queryToken) ?? normalizeClaimToken(persistedToken) ?? readPersistedClaimToken();
}

export function buildAuthHrefWithClaimToken(baseHref: string, claimToken: string | null): string {
  if (!claimToken) return baseHref;
  const url = new URL(baseHref, "http://local");
  url.searchParams.set("claimToken", claimToken);
  return `${url.pathname}${url.search}`;
}

export function resolveClaimSignupViewMode(
  claimToken: string | null,
  validation: ClaimValidationState
): ClaimSignupViewMode {
  if (!claimToken) return "normal";
  if (validation.status === "valid") return "claim";
  if (validation.status === "loading" || validation.status === "idle") return "claim";
  return "claim";
}

export function shouldShowClaimSignupForm(
  claimToken: string | null,
  validation: ClaimValidationState
): boolean {
  if (!claimToken) return true;
  return validation.status === "valid";
}

export function claimInvalidReasonMessageKey(
  reason: AccountClaimInvalidReason | "unknown" | "network"
): string {
  switch (reason) {
    case "expired":
      return "auth.claim.invalidExpired";
    case "already_claimed":
      return "auth.claim.invalidAlreadyClaimed";
    case "revoked":
      return "auth.claim.invalidRevoked";
    case "not_found":
    case "malformed":
      return "auth.claim.invalidNotFound";
    case "network":
      return "auth.claim.validationNetworkError";
    default:
      return "auth.claim.invalidGeneric";
  }
}

const CLAIM_ERROR_MESSAGE_KEYS: Record<string, string> = {
  "This invite has expired.": "auth.claim.errorExpired",
  "This invite has already been used.": "auth.claim.errorAlreadyUsed",
  "This invite has been revoked.": "auth.claim.errorRevoked",
  "Invalid or unknown claim token.": "auth.claim.errorInvalidToken",
  "Invalid claim token.": "auth.claim.errorInvalidToken",
  "This professional profile is already linked to another account.": "auth.claim.errorProfileLinked",
  "Your account is already linked to a different doctor profile.": "auth.claim.errorUserLinkedOther",
  "Your account is registered as a patient. Network professional access requires a separate doctor account.":
    "auth.claim.errorPatientConflict",
  "Clinic accounts cannot claim network doctor profiles.": "auth.claim.errorClinicConflict",
  "Authentication required.": "auth.claim.errorAuthRequired",
  "Claim token is required.": "auth.claim.errorMissingToken",
};

export function claimErrorMessageKey(error: string): string {
  return CLAIM_ERROR_MESSAGE_KEYS[error] ?? "auth.claim.errorGeneric";
}

export async function fetchClaimTokenValidation(
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<ClaimValidationState> {
  try {
    const res = await fetchImpl(
      `/api/nexus/account-claim/validate?token=${encodeURIComponent(token)}`,
      { method: "GET", credentials: "same-origin" }
    );
    const body = (await res.json().catch(() => null)) as AccountClaimValidationResult | null;
    if (!body || typeof body !== "object") {
      return { status: "invalid", reason: "unknown" };
    }
    if (body.valid) {
      return { status: "valid", validation: body };
    }
    return { status: "invalid", reason: body.reason ?? "unknown" };
  } catch {
    return { status: "invalid", reason: "network" };
  }
}
