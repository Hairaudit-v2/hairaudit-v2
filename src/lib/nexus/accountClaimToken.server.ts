import { createHash, randomBytes } from "node:crypto";

import { getAccountClaimTokenSecret } from "@/lib/security/secrets";
import { timingSafeUtf8Equal } from "@/lib/security/timingSafeSecret";

const TOKEN_BYTES = 32;

/** Generate a high-entropy single-use claim token. Never log the return value. */
export function generateAccountClaimToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/** Hash a claim token for storage. Only the hash is persisted. */
export function hashAccountClaimToken(token: string): string {
  const normalized = token.trim();
  return createHash("sha256").update(`${getAccountClaimTokenSecret()}:${normalized}`).digest("hex");
}

/** Constant-time comparison of stored and computed token hashes. */
export function accountClaimTokenHashMatches(storedHash: string, token: string): boolean {
  const computed = hashAccountClaimToken(token);
  return timingSafeUtf8Equal(storedHash, computed);
}

export function isMalformedClaimToken(token: unknown): boolean {
  if (typeof token !== "string") return true;
  const trimmed = token.trim();
  if (trimmed.length < 32 || trimmed.length > 128) return true;
  return !/^[a-f0-9]+$/i.test(trimmed);
}

export function maskEmailForClaimPreview(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, Math.min(1, local.length));
  const maskedLocal = local.length <= 1 ? "*" : `${visible}${"*".repeat(Math.min(3, local.length - 1))}`;
  const domainParts = domain.split(".");
  const maskedDomain =
    domainParts.length >= 2
      ? `${domainParts[0].slice(0, 1)}***.${domainParts.slice(-1).join(".")}`
      : `${domain.slice(0, 1)}***`;
  return `${maskedLocal}@${maskedDomain}`;
}
