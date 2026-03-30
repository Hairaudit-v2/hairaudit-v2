export type PatientMonitorPeriod = {
  label: string;
  bullets: string[];
};

export type PatientWhatToMonitorOverTime = {
  sectionTitle: string;
  intro: string;
  periods: PatientMonitorPeriod[];
};

export function buildPatientWhatToMonitorOverTime(): PatientWhatToMonitorOverTime {
  return {
    sectionTitle: "What to Monitor Over Time",
    intro:
      "These intervals are a practical guide for photos and self-checks. Everyone heals differently; bring questions or visible changes to your qualified clinician.",
    periods: [
      {
        label: "0–3 months",
        bullets: [
          "Healing, redness, and crusting patterns (compare similar lighting and angles).",
          "Expected shedding of transplanted hairs (shock loss) versus anything that feels unusual for you.",
          "Donor comfort and visible donor surface changes in standardized photos.",
        ],
      },
      {
        label: "3–6 months",
        bullets: [
          "Early growth and texture changes; small differences between zones are common early on.",
          "Hairline and temple transitions as hairs begin to emerge.",
          "Continue matched-angle photos every few weeks so trends are easier to see.",
        ],
      },
      {
        label: "6–12 months",
        bullets: [
          "Maturing density and directional flow; compare month-to-month rather than day-to-day.",
          "How transplanted areas blend with surrounding native hair in normal lighting.",
          "Donor uniformity if you plan shorter styles or may need future work.",
        ],
      },
      {
        label: "12+ months",
        bullets: [
          "Long-term stability of the result and any gradual thinning of native hair nearby.",
          "Whether density still looks balanced as hair caliber fully matures.",
          "Donor reserve and scalp coverage if you are thinking about another procedure someday.",
        ],
      },
    ],
  };
}
