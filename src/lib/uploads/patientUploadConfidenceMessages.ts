/**
 * Rewarding, patient-safe copy shown after a successful photo upload.
 * Never uses forbidden terminology (AI, forensic, etc.).
 */

const DEFAULT_MESSAGE = "Perfect — photo added successfully.";

const BY_CATEGORY: Record<string, string> = {
  patient_current_front: "Perfect — this gives us a clear view of your front hairline.",
  patient_current_top: "Perfect — this helps us see the top of your head clearly.",
  patient_current_donor_rear: "Perfect — this gives us a clear view of the back of your head.",
  patient_current_left: "Great — this side photo adds helpful context.",
  patient_current_right: "Great — this side photo adds helpful context.",
  patient_current_crown: "Great — this helps us see coverage on the top of your head.",
  any_preop: "Thank you — a before-surgery photo helps us compare how things have changed.",
  any_day0: "Thank you — a surgery-day photo helps us see where you started.",
  any_early_postop_day0_3: "Thank you — early healing photos help us see how things are settling.",
  preop_front: "Perfect — this gives us a clear view of your front hairline.",
  preop_top: "Perfect — this helps us see the top of your head clearly.",
  preop_donor_rear: "Perfect — this gives us a clear view of the back of your head.",
  preop_left: "Great — this left-side photo adds helpful context.",
  preop_right: "Great — this right-side photo adds helpful context.",
  preop_crown: "Great — this helps us see coverage on the top of your head.",
  day0_recipient: "Thank you — this surgery-day photo of the transplanted area is helpful.",
  day0_donor: "Thank you — this surgery-day photo of the back of your head is helpful.",
  preop_wet_top: "Thank you — wet-hair photos often help us see coverage more clearly.",
  preop_hairline_closeup: "Great — hairline detail helps us give clearer guidance.",
  preop_clinic_quote: "Thank you — clinic documents add useful context.",
  preop_styling_reference: "Thank you — this helps us understand how you usually wear your hair.",
  preop_family_pattern: "Thank you — family pattern context supports long-term outlook.",
  current_recipient_closeup: "Perfect — this close photo of the transplanted area is very helpful.",
  postop_wet_recipient: "Thank you — wet-hair photos often help us see coverage more clearly.",
  preop_donor_closeup: "Great — this close photo of the back adds helpful detail.",
  graft_count_board: "Thank you — clinic documents add useful context.",
  postop_day1_recipient: "Thank you — day-one photos help us see early healing.",
  postop_week1_recipient: "Thank you — one-week photos help us track early recovery.",
  postop_month3_front: "Thank you — three-month progress adds helpful context.",
  postop_month6_front: "Thank you — six-month photos help us see how your result is developing.",
};

export function getPatientUploadConfidenceMessage(category: string): string {
  return BY_CATEGORY[category] ?? DEFAULT_MESSAGE;
}
