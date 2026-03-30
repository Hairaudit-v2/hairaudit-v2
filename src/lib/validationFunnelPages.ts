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
