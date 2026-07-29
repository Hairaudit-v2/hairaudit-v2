/**
 * HA-AUTH-HANDOFF-FIX — patient contact / account confirmation copy.
 * Pre-surgery must not imply a report already exists.
 */

import type { PatientReviewPathway } from "@/lib/patient/patientReviewPathway";

export type PatientContactCopy = {
  pageTitle: string;
  supportingText: string;
  progressLabel: string;
  primaryButton: string;
  primaryBusy: string;
  footerNote: string;
};

export type PatientReviewSubmitCopy = {
  pageTitle: string;
  supportingText: string;
  progressLabel: string;
  primaryButton: string;
  primaryBusy: string;
};

export function getPatientContactCopy(pathway: PatientReviewPathway | null | undefined): PatientContactCopy {
  if (pathway === "pre_surgery") {
    return {
      pageTitle: "Confirm Your Account",
      supportingText:
        "Your secure account keeps your photos, answers and Pre-Surgery Review Report together.",
      progressLabel: "Step 3 of 4 — Confirm your account",
      primaryButton: "Continue My Review",
      primaryBusy: "Confirming your account…",
      footerNote:
        "By continuing you agree to our Terms and Privacy Policy. We will email you when your independent Pre-Surgery Review Report is ready.",
    };
  }
  return {
    pageTitle: "Confirm Your Account",
    supportingText: "Your secure account keeps your photos, answers and review report together.",
    progressLabel: "Step 3 of 4 — Confirm your account",
    primaryButton: "Continue My Review",
    primaryBusy: "Confirming your account…",
    footerNote:
      "By continuing you agree to our Terms and Privacy Policy. We will email you when your independent review is ready.",
  };
}

export function getPatientReviewSubmitCopy(
  pathway: PatientReviewPathway | null | undefined
): PatientReviewSubmitCopy {
  if (pathway === "pre_surgery") {
    return {
      pageTitle: "Submit Your Pre-Surgery Review",
      supportingText: "We will email you when your independent Pre-Surgery Review Report is ready.",
      progressLabel: "Step 4 of 4 — Submit your review",
      primaryButton: "Submit Pre-Surgery Review",
      primaryBusy: "Submitting your review…",
    };
  }
  return {
    pageTitle: "Submit Your Review",
    supportingText: "We will email you when your independent review is ready.",
    progressLabel: "Step 4 of 4 — Submit your review",
    primaryButton: "Submit Review",
    primaryBusy: "Submitting your review…",
  };
}
