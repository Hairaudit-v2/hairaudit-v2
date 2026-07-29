/**
 * HA-AUTH-HANDOFF-FIX — hashed single-use intake case handoff tokens.
 * Plaintext tokens are returned once to the client; only hashes are persisted.
 */

import { createHash, randomBytes } from "node:crypto";
import { getAccountClaimTokenSecret } from "@/lib/security/secrets";
import { timingSafeUtf8Equal } from "@/lib/security/timingSafeSecret";
import { maskEmailForClaimPreview } from "@/lib/nexus/accountClaimToken.server";

const TOKEN_BYTES = 32;

export function generateIntakeHandoffToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashIntakeHandoffToken(token: string): string {
  const normalized = token.trim();
  return createHash("sha256").update(`${getAccountClaimTokenSecret()}:intake:${normalized}`).digest("hex");
}

export function intakeHandoffTokenHashMatches(storedHash: string, token: string): boolean {
  return timingSafeUtf8Equal(storedHash, hashIntakeHandoffToken(token));
}

export function isMalformedIntakeHandoffToken(token: unknown): boolean {
  if (typeof token !== "string") return true;
  const trimmed = token.trim();
  if (trimmed.length < 32 || trimmed.length > 128) return true;
  return !/^[a-f0-9]+$/i.test(trimmed);
}

export function normalizeAuthEmail(email: string | null | undefined): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeAuthEmail(a);
  const right = normalizeAuthEmail(b);
  return left.length > 0 && left === right;
}

export function maskPatientEmail(email: string): string {
  return maskEmailForClaimPreview(email);
}

export { maskEmailForClaimPreview };
