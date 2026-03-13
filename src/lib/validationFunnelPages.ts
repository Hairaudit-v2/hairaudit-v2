export type ValidationPageContent = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  excellentSignals: string[];
  highQualityExamples: string[];
  faq: Array<{
    question: string;
    answer: string;
  }>;
  suggestedScore: number;
};

export const validationFunnelPages: ValidationPageContent[] = [
  {
    slug: "is-my-hair-transplant-normal",
    title: "Is My Hair Transplant Normal?",
    description:
      "Understand what normal healing and strong transplant quality look like with clear patient-friendly guidance.",
    intro:
      "Many patients ask this even when they are not worried. A structured review can confirm whether your timeline and appearance are consistent with strong surgical quality.",
    excellentSignals: [
      "Growth follows expected timing across months.",
      "Hairline direction and softness look natural at normal viewing distance.",
      "Donor area remains balanced without obvious patchiness.",
      "Recipient density improves with even visual distribution.",
    ],
    highQualityExamples: [
      "Month 1 to 3 shedding followed by clear month 4 to 6 regrowth trend.",
      "Frontal line that blends with surrounding hair instead of looking sharp or pluggy.",
      "Donor area that remains suitable for normal haircut choices.",
    ],
    faq: [
      {
        question: "Can a normal result still look uneven early on?",
        answer:
          "Yes. Early months can look uneven. Final appearance usually needs 9 to 12 months for proper evaluation.",
      },
      {
        question: "Why get reviewed if my result looks good?",
        answer:
          "Independent validation gives structured documentation and confidence for your records and future planning.",
      },
    ],
    suggestedScore: 84,
  },
  {
    slug: "great-hair-transplants",
    title: "Great Hair Transplants: What Makes Them Great?",
    description:
      "Learn the quality signals seen in great hair transplant outcomes and how HairAudit scores them.",
    intro:
      "Great outcomes are not only about density. They combine planning, donor protection, natural design, and stable long-term strategy.",
    excellentSignals: [
      "Age-appropriate hairline shape with natural micro-irregularity.",
      "Good graft distribution that matches facial framing goals.",
      "Donor extraction pattern that preserves future options.",
      "Consistent documentation that supports high-confidence review.",
    ],
    highQualityExamples: [
      "Natural look in daylight and indoor lighting without harsh line visibility.",
      "Front-to-mid scalp transition that avoids abrupt density blocks.",
      "Post-op timeline photos that show steady, believable maturation.",
    ],
    faq: [
      {
        question: "Is very high density always better?",
        answer:
          "Not always. Balanced design and natural flow often matter more than maximum density alone.",
      },
      {
        question: "Can a great result still need long-term maintenance?",
        answer:
          "Yes. Native hair loss can continue over time, so long-term strategy remains important.",
      },
    ],
    suggestedScore: 90,
  },
  {
    slug: "best-hair-transplant-results",
    title: "Best Hair Transplant Results: Evidence-Based Quality Markers",
    description:
      "Explore evidence-based markers often seen in the best hair transplant results and how they are scored.",
    intro:
      "The best results usually look natural, protect donor resources, and remain stable with realistic long-term planning.",
    excellentSignals: [
      "Natural framing from frontal view, profile view, and close-up angles.",
      "Recipient growth pattern that aligns with expected graft placement logic.",
      "Minimal donor visibility under common haircut lengths.",
      "High confidence from complete pre-op and post-op evidence.",
    ],
    highQualityExamples: [
      "Case timeline with consistent monthly photos under similar lighting.",
      "Strong cosmetic improvement without obvious donor compromise.",
      "Report findings where quality and confidence are both high.",
    ],
    faq: [
      {
        question: "Can social media photos alone prove best quality?",
        answer:
          "No. Social images can help, but structured evidence and timeline consistency provide stronger validation.",
      },
      {
        question: "What does HairAudit add beyond visual opinion?",
        answer:
          "HairAudit uses a scoring framework with evidence notes and confidence context, not just subjective impressions.",
      },
    ],
    suggestedScore: 93,
  },
];
