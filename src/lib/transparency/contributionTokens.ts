import { createHash, randomBytes } from "node:crypto";
import { getContributionTokenSecret } from "@/lib/security/secrets";

export function generateContributionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashContributionToken(token: string): string {
  return createHash("sha256").update(`${getContributionTokenSecret()}:${token}`).digest("hex");
}
