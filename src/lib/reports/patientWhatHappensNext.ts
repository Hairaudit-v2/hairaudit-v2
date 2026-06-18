import type { PatientConcernBand } from "./patientConcernBands";

export type PatientWhatHappensNext = {
  sectionTitle: string;
  intro: string;
  steps: string[];
  reassurance: string;
};

export function buildPatientWhatHappensNext(band: PatientConcernBand): PatientWhatHappensNext {
  const base = {
    sectionTitle: "What happens next",
    intro:
      "This review is meant to support an informed conversation with your treating team. It does not replace medical advice or an in-person examination.",
  };

  switch (band) {
    case "none":
      return {
        ...base,
        steps: [
          "Keep your routine follow-up appointments with your clinic.",
          "Continue interval photos in consistent lighting if you are tracking progress.",
          "Save or download this summary for your records and share it if your clinician asks.",
        ],
        reassurance:
          "No urgent action is suggested from this review. Reach out to your clinic if anything changes or feels unusual for you.",
      };
    case "minor":
      return {
        ...base,
        steps: [
          "Mention the minor observations at your next scheduled check-in.",
          "Watch the noted areas with matched-angle photos over the next few weeks.",
          "Contact your clinic sooner if something looks different from your usual healing pattern.",
        ],
        reassurance:
          "Minor findings are often normal variation. Your clinician can help you decide whether anything needs closer attention.",
      };
    case "needs_review":
      return {
        ...base,
        steps: [
          "Book a review with your treating clinician when convenient.",
          "Bring this summary and your recent photos to that appointment.",
          "Write down your questions beforehand so you can discuss each flagged area clearly.",
        ],
        reassurance:
          "A closer look does not mean something is wrong. It helps your team explain what they see and what follow-up may be appropriate.",
      };
    case "significant":
      return {
        ...base,
        steps: [
          "Contact your treating clinic to discuss the flagged areas soon.",
          "Share this summary and your clearest recent photos before or during that conversation.",
          "Ask which findings may affect healing, density, or donor appearance over time.",
        ],
        reassurance:
          "Prompt follow-up helps clarify whether changes are expected healing or something that needs a treatment plan.",
      };
    case "urgent":
      return {
        ...base,
        steps: [
          "Contact your treating doctor or clinic promptly to review the flagged findings.",
          "Seek urgent in-person care if you have pain, spreading redness, discharge, fever, or sudden visible change.",
          "Keep this summary available so your clinician can see what was observed from your uploaded images.",
        ],
        reassurance:
          "If you cannot reach your clinic and symptoms feel severe or worsening, use local urgent care or emergency services as appropriate.",
      };
    default:
      return {
        ...base,
        steps: [
          "Discuss this summary with your treating clinician at your next visit.",
          "Continue follow-up photos if you are monitoring progress over time.",
        ],
        reassurance: "Your clinic remains your primary source of medical guidance.",
      };
  }
}
