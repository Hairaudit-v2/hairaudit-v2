export type PatientIssueContent = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  explanations: string[];
  summaryPoints: string[];
  seekReviewPoints: string[];
  faqs: Array<{
    question: string;
    answer: string;
  }>;
};

export const patientIssueLibrary: PatientIssueContent[] = [
  {
    slug: "hair-transplant-too-thin",
    title: "Hair Transplant Too Thin: What It Can Mean",
    description:
      "Patient guide to thin hair transplant results, possible causes, and when to request an independent review.",
    intro:
      "A thin result does not always mean surgery failed. In some cases, growth is still developing. In other cases, graft placement, graft survival, or planning issues can reduce final density.",
    explanations: [
      "Most patients need 9 to 12 months to see their final density. If you are early in recovery, thinning may still improve.",
      "If density is still low after the expected growth window, common causes include low graft survival, low graft count for the area, weak placement strategy, or existing native hair loss progression.",
      "A structured review helps separate normal recovery from quality concerns by looking at timeline photos, donor evidence, and recipient pattern.",
    ],
    summaryPoints: [
      "Thin appearance can be temporary in early months.",
      "Final thinness can happen from planning or graft survival issues.",
      "Photo timeline quality affects confidence in conclusions.",
      "Independent review can clarify whether concern is cosmetic, technical, or both.",
    ],
    seekReviewPoints: [
      "Density remains low at 10 to 12 months post-op.",
      "Visible scalp remains widespread in transplanted zones.",
      "Clinic feedback is unclear or inconsistent with your visual evidence.",
      "You need objective documentation before planning correction.",
    ],
    faqs: [
      {
        question: "How long should I wait before judging final density?",
        answer:
          "Most results mature over 9 to 12 months. Some patients continue improving slightly after this window.",
      },
      {
        question: "Can medication affect density outcomes?",
        answer:
          "Yes. Ongoing native hair loss can change appearance. This can occur even if transplanted grafts survive.",
      },
      {
        question: "Can HairAudit tell me if I need a second surgery?",
        answer:
          "HairAudit provides independent evidence review and documentation. Treatment decisions should be made with your clinician.",
      },
    ],
  },
  {
    slug: "hair-transplant-not-growing",
    title: "Hair Transplant Not Growing: Normal Delay or Concern?",
    description:
      "Patient education on delayed hair transplant growth, red flags, and when independent review is useful.",
    intro:
      "After surgery, shedding is expected. New growth often starts slowly. If very little growth appears by expected milestones, it may be worth a detailed review.",
    explanations: [
      "A common pattern is shedding in the first months, then gradual regrowth from around month 3 to month 4 onward.",
      "By month 6, many patients see clear progress, but full maturity usually takes longer. If growth stays very limited near month 9 or 12, concern increases.",
      "Poor graft survival, trauma to grafts, recipient scalp factors, and documentation gaps can all affect interpretation.",
    ],
    summaryPoints: [
      "Early shedding is normal and expected.",
      "Growth timelines vary, but total absence of progress needs attention.",
      "A full timeline with consistent lighting improves review quality.",
      "Independent assessment can help determine if delay is within range.",
    ],
    seekReviewPoints: [
      "Very limited growth by month 8 to 10.",
      "No meaningful cosmetic improvement by month 12.",
      "Patchy non-growth with visible transplanted zones.",
      "You want clear evidence before discussing options with a clinic.",
    ],
    faqs: [
      {
        question: "Is zero growth at month 4 a failure?",
        answer:
          "Not always. Some patients show slower starts. The full timeline and surgical context matter.",
      },
      {
        question: "Can shock loss look like failed growth?",
        answer:
          "Yes. Shock loss can temporarily reduce visible hair and delay perceived improvement.",
      },
      {
        question: "What evidence should I upload for review?",
        answer:
          "Pre-op, immediate post-op, donor views, and monthly progress photos with similar angles and lighting.",
      },
    ],
  },
  {
    slug: "hair-transplant-donor-overharvested",
    title: "Donor Area Overharvested: Signs and Next Steps",
    description:
      "Guide to possible donor overharvesting after hair transplant and when to request independent review.",
    intro:
      "The donor area should keep a balanced look after extraction. Overharvesting can create patchiness, visible thinning, or reduced future donor reserve.",
    explanations: [
      "Overharvesting usually appears as uneven density, moth-eaten appearance, or stronger scalp visibility in the donor zone.",
      "Not every thin donor appearance means severe damage. Hair length, lighting, and natural donor variation can change how it looks.",
      "Independent review compares donor photos across time to estimate whether extraction pattern appears conservative or excessive.",
    ],
    summaryPoints: [
      "Donor safety is critical for long-term planning.",
      "Patchy donor zones may indicate concentrated extraction.",
      "Lighting and haircut length can exaggerate donor concerns.",
      "A timeline review helps distinguish temporary appearance from structural loss.",
    ],
    seekReviewPoints: [
      "Persistent patchy donor area months after surgery.",
      "Reduced ability to wear short hair due to visible extraction pattern.",
      "Concern about limited donor reserve for future repair.",
      "Need objective records for clinic discussions.",
    ],
    faqs: [
      {
        question: "Can donor thinning improve over time?",
        answer:
          "Some appearance changes improve as hair grows longer, but true extraction-related loss may remain visible.",
      },
      {
        question: "Is overharvesting only an FUE issue?",
        answer:
          "It is more commonly discussed with FUE extraction patterns, but donor management matters in all surgical planning.",
      },
      {
        question: "Can HairAudit measure exact donor depletion?",
        answer:
          "HairAudit provides structured visual assessment and evidence-based documentation. Exact microscopic counts may require in-person clinical tools.",
      },
    ],
  },
  {
    slug: "bad-hair-transplant-hairline",
    title: "Bad Hair Transplant Hairline: How to Evaluate It",
    description:
      "Patient guide to unnatural hairline concerns after transplant and signs that suggest professional review.",
    intro:
      "An unnatural hairline can come from shape, direction, density, or graft type mismatch. The concern is both cosmetic and technical because hairline design strongly affects natural appearance.",
    explanations: [
      "Common concerns include overly straight lines, abrupt density changes, low placement, or incorrect angulation that does not match natural flow.",
      "A hairline may look harsh in early recovery. Final softness usually improves as growth matures and styling options increase.",
      "Reviewing close-up frontal photos and side profile angles helps identify whether irregularity is likely temporary or structural.",
    ],
    summaryPoints: [
      "Hairline design is one of the most visible quality markers.",
      "Early appearance can change during maturation.",
      "Direction and softness matter as much as line shape.",
      "Independent review can document design strengths and limitations clearly.",
    ],
    seekReviewPoints: [
      "Hairline still appears unnatural near final growth stage.",
      "Visible pluggy or abrupt transition appearance.",
      "Design does not match facial proportions or age profile.",
      "You need clear technical documentation before corrective planning.",
    ],
    faqs: [
      {
        question: "Can a harsh hairline soften naturally?",
        answer:
          "Sometimes yes, especially while growth matures. If it remains harsh late in recovery, concern is more significant.",
      },
      {
        question: "Does a low hairline always mean poor surgery?",
        answer:
          "Not always. Suitability depends on age, donor reserve, and long-term loss planning.",
      },
      {
        question: "Can this be corrected?",
        answer:
          "Some cases can be improved with corrective planning. HairAudit can provide objective evidence to support that discussion.",
      },
    ],
  },
  {
    slug: "hair-transplant-graft-failure",
    title: "Hair Transplant Graft Failure: Understanding the Signs",
    description:
      "Simple explanation of possible graft failure signs after hair transplant and when to seek independent case review.",
    intro:
      "Graft failure means transplanted follicles did not survive or did not produce expected growth. This can be partial or extensive and may involve multiple factors.",
    explanations: [
      "Possible factors include graft handling trauma, prolonged out-of-body time, dehydration, recipient site trauma, infection, or healing complications.",
      "Visual signs can overlap with delayed growth, so timing matters. A concern at month 4 is different from the same appearance at month 12.",
      "Independent review helps assess whether the pattern aligns with normal delay, partial failure, or broader quality concerns.",
    ],
    summaryPoints: [
      "Not all slow growth equals graft failure.",
      "Failure patterns are interpreted using timing and photo evidence.",
      "Both technical factors and healing factors can influence survival.",
      "Clear independent documentation helps with next-step decisions.",
    ],
    seekReviewPoints: [
      "Minimal growth in major transplanted zones near month 12.",
      "Large mismatch between graft count claim and visible result.",
      "Signs suggest broad non-survival rather than slow maturation.",
      "You need a neutral report before corrective consultation.",
    ],
    faqs: [
      {
        question: "Can graft failure be proven from photos alone?",
        answer:
          "Photos can strongly suggest patterns, but final interpretation depends on evidence quality and timeline completeness.",
      },
      {
        question: "Could poor growth still improve after month 12?",
        answer:
          "Small improvement may occur, but major change after month 12 is less common.",
      },
      {
        question: "What is the benefit of independent review?",
        answer:
          "It gives a structured, unbiased record of findings that you can use in clinical or corrective planning discussions.",
      },
    ],
  },
];
