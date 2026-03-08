import { createHash, randomBytes } from "node:crypto";

function tokenSecret() {
  return process.env.CONTRIBUTION_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "hairaudit-contribution-token";
}

export function generateContributionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashContributionToken(token: string): string {
  return createHash("sha256").update(`${tokenSecret()}:${token}`).digest("hex");
}
