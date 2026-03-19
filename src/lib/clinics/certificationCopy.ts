/**
 * Single source of wording for clinic certification tiers.
 * Keys match backend: VERIFIED (Active), SILVER, GOLD, PLATINUM.
 * Use fullDescription with clinic name substituted for "Sample Clinic" where needed.
 */

export type CertificationTierCopy = {
  label: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
};

export const CERTIFICATION_COPY: Record<string, CertificationTierCopy> = {
  VERIFIED: {
    label: "Active",
    title: "Active Participant in Global Surgical Transparency",
    shortDescription:
      "This clinic is actively engaging in independent case review and quality benchmarking.",
    fullDescription:
      "Sample Clinic is an active participant in the HairAudit™ Global Quality Assurance Programme, contributing verified surgical cases to support greater transparency, accountability, and continuous improvement in hair restoration.",
  },
  SILVER: {
    label: "Silver Certified",
    title: "Verified High-Quality Surgical Performance",
    shortDescription:
      "This clinic has demonstrated consistently strong audited performance across multiple reviewed cases.",
    fullDescription:
      "Sample Clinic has achieved Silver Certification through consistently strong audit outcomes across submitted cases. This recognition reflects a high standard of surgical execution, reliable technique, and a clear commitment to measurable, verifiable results.",
  },
  GOLD: {
    label: "Gold Certified",
    title: "Exceptional Clinical Consistency and Outcomes",
    shortDescription:
      "This clinic is recognised for consistently high-quality outcomes and advanced surgical standards.",
    fullDescription:
      "Sample Clinic has earned Gold Certification by demonstrating exceptional consistency in surgical performance across multiple audited cases. This level reflects advanced technical precision, strong donor management, and high-quality implantation standards.",
  },
  PLATINUM: {
    label: "Platinum Certified",
    title: "Elite Global Standard in Hair Restoration",
    shortDescription:
      "This clinic is ranked among the highest-performing participating clinics within the HairAudit network.",
    fullDescription:
      "Sample Clinic has achieved Platinum Certification, HairAudit's highest level of recognition, awarded to clinics demonstrating elite, world-class outcomes across audited cases. These clinics represent the benchmark for excellence in modern hair restoration.",
  },
};

export const CERTIFICATION_TRUST_LINE =
  "Based on independently audited surgical data and verified case submissions.";

/** Label only, for badge display (Active, Silver Certified, etc.) */
export function getCertificationLabel(tier: string | null): string {
  const t = (tier ?? "VERIFIED").toUpperCase();
  return CERTIFICATION_COPY[t]?.label ?? CERTIFICATION_COPY.VERIFIED.label;
}

/** fullDescription with clinic name substituted for "Sample Clinic" */
export function getCertificationFullDescription(tier: string | null, clinicName: string): string {
  const t = (tier ?? "VERIFIED").toUpperCase();
  const copy = CERTIFICATION_COPY[t] ?? CERTIFICATION_COPY.VERIFIED;
  return copy.fullDescription.replace(/Sample Clinic/g, clinicName.trim() || "This clinic");
}

/** Labels for badge display; re-exported from CertificationBadge for backward compatibility */
export const CERTIFICATION_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CERTIFICATION_COPY).map(([k, v]) => [k, v.label])
) as Record<string, string>;
