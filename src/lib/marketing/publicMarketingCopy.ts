/**
 * HA-LIGHTHOUSE-1 — canonical public marketing language for HairAudit surfaces.
 * Patient-facing CTAs and trust copy should reference these constants or matching i18n keys.
 */

export const PUBLIC_TRUST_PLATFORM_MESSAGE =
  "HairAudit is an independent patient protection platform built to improve transparency, accountability, and long-term outcomes in hair restoration medicine.";

export const PUBLIC_INDEPENDENCE_MESSAGE = "HairAudit does not sell surgery.";

export const PUBLIC_ECOSYSTEM_FOOTER = "Powered by the Follicle Intelligence Network.";

export const PUBLIC_CTAS = {
  startFreeHairAudit: "Start Free HairAudit",
  startPreSurgeryReview: "Start Pre-Surgery Review",
  startPostSurgeryAudit: "Start Post-Surgery Audit",
  viewSampleReport: "View Sample Report",
  createProfessionalProfile: "Create Professional Profile",
  createClinicProfile: "Create Clinic Profile",
} as const;

export const PUBLIC_AUDIT_FLOW_STEPS = [
  {
    title: "Upload images",
    body: "Add donor, hairline, crown, and timeline photos through the secure patient upload flow.",
  },
  {
    title: "Intelligence review",
    body: "HairAudit structures your evidence for independent analysis against consistent clinical review standards.",
  },
  {
    title: "Clinical verification",
    body: "Findings are verified where needed so your report reflects evidence strength and documented limits.",
  },
  {
    title: "Receive your Clinical Intelligence Report",
    body: "Your report explains what the evidence supports, where confidence is limited, and what may be worth discussing with your clinician.",
  },
] as const;
