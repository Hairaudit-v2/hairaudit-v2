/**
 * Rewarding, patient-safe copy shown after a successful photo upload.
 * Never uses forbidden terminology (AI, forensic, etc.).
 */

const DEFAULT_MESSAGE =
  "Excellent — this photo gives us a clearer view for your independent review.";

const BY_CATEGORY: Record<string, string> = {
  patient_current_front:
    "Excellent — this gives us a clear view of your frontal hairline.",
  patient_current_top:
    "Excellent — this helps us see the top and crown area clearly.",
  patient_current_donor_rear:
    "Excellent — this gives us a clear view of the back of your head.",
  patient_current_left:
    "Great — this side angle adds helpful context to your review.",
  patient_current_right:
    "Great — this side angle adds helpful context to your review.",
  patient_current_crown:
    "Great — this crown view helps us understand coverage in that area.",
  any_preop:
    "Thank you — before-surgery photos help us compare your progress over time.",
  any_day0:
    "Thank you — surgery-day photos help document your starting point.",
  any_early_postop_day0_3:
    "Thank you — early healing photos help us follow how things are settling.",
  preop_front:
    "Excellent — this gives us a clear view of your frontal hairline.",
  preop_top:
    "Excellent — this helps us see the top and crown area clearly.",
  preop_donor_rear:
    "Excellent — this gives us a clear view of the back of your head.",
  preop_left: "Great — this left-side view adds helpful context.",
  preop_right: "Great — this right-side view adds helpful context.",
  preop_crown: "Great — this crown view helps us understand coverage.",
  day0_recipient: "Thank you — this documents your recipient area on surgery day.",
  day0_donor: "Thank you — this documents your donor area on surgery day.",
};

export function getPatientUploadConfidenceMessage(category: string): string {
  return BY_CATEGORY[category] ?? DEFAULT_MESSAGE;
}
