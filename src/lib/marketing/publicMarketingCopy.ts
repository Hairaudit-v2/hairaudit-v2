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
  startReview: "Start Review",
  chooseYourReview: "Choose Your Review",
  chooseYourReviewType: "Choose your review type",
  startPreSurgeryReview: "Start Pre-Surgery Review",
  startPostSurgeryAudit: "Start Post-Surgery Audit",
  viewSampleReport: "View Sample Report",
  createProfessionalProfile: "Create Professional Profile",
  createClinicProfile: "Create Clinic Profile",
} as const;

export const PUBLIC_AUDIT_FLOW_STEPS = [
  {
    title: "Start Free HairAudit",
    body: "Open your secure patient pathway and choose pre-surgery review or post-surgery independent analysis.",
  },
  {
    title: "Upload images",
    body: "Add donor, hairline, crown, and timeline photos through the secure patient upload flow.",
  },
  {
    title: "Independent Analysis",
    body: "HairAudit structures your evidence for independent analysis against consistent clinical review standards.",
  },
  {
    title: "Clinical Intelligence Report",
    body: "Your report explains what the evidence supports, where confidence is limited, and documented limits.",
  },
  {
    title: "Next-step guidance",
    body: "Practical guidance on what may be worth discussing with your clinician and when structured follow-up may help.",
  },
] as const;
