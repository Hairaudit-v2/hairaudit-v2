/**
 * Certificate display types for the HairAudit Certification Certificate (static v1).
 * Display-only; no persistence. Keys align with certification engine / award tiers.
 */

export type CertificateTier = "verified" | "silver" | "gold" | "platinum";

export type CertificateData = {
  clinicName: string;
  tier: CertificateTier;
  score?: number | null;
  caseCount?: number | null;
  issuedAt: string; // ISO date string
  certificateId: string;
  /** When true, show SAMPLE watermark (demo certificates). */
  isSample?: boolean;
};

/** Normalize backend tier (VERIFIED, SILVER, GOLD, PLATINUM) to CertificateTier. */
export function toCertificateTier(tier: string | null | undefined): CertificateTier {
  const t = (tier ?? "VERIFIED").toUpperCase();
  if (t === "PLATINUM") return "platinum";
  if (t === "GOLD") return "gold";
  if (t === "SILVER") return "silver";
  return "verified";
}
