import type { PatientIntentArticle } from "./types";

export const howManyGraftsIsTooManyArticle: PatientIntentArticle = {
  slug: "how-many-grafts-is-too-many",
  pathname: "/how-many-grafts-is-too-many",
  seoTitle: "How Many Grafts Is Too Many? | HairAudit",
  metaDescription:
    "How many grafts is too many in a hair transplant? Learn why the answer depends on donor quality, planning, and long-term strategy — not just numbers.",
  h1: "How Many Grafts Is Too Many?",
  intro:
    "Patients often focus on graft numbers because they are one of the few concrete figures discussed during transplant planning. But a high graft number is not automatically good, and a low graft number is not automatically poor. The real question is whether the graft count was appropriate for the patient's donor quality, recipient goals, and long-term strategy. This page explains why \"too many\" is not a simple universal number.",
  sections: [
    {
      id: "graft-count-misleading",
      heading: "Why graft count alone is misleading",
      blocks: [
        {
          type: "p",
          text: "A graft count without context tells only part of the story. Two patients can both receive 3,000 grafts and have completely different donor impacts and completely different cosmetic yields depending on:",
        },
        {
          type: "ul",
          items: [
            "donor density",
            "hair calibre",
            "hairs per graft",
            "extraction distribution",
            "recipient size",
            "long-term pattern of loss",
          ],
        },
      ],
    },
    {
      id: "donor-quality-matters",
      heading: "Why donor quality matters more than raw numbers",
      blocks: [
        {
          type: "p",
          text: "A stronger donor can sometimes tolerate more harvesting than a weaker one. The same number of grafts may be conservative in one patient and aggressive in another. That is why safe planning depends on donor characteristics, not only on marketing-style headline numbers.",
        },
      ],
    },
    {
      id: "when-graft-count-concern",
      heading: "When graft count becomes a concern",
      blocks: [
        {
          type: "p",
          text: "Patients may reasonably question graft count when:",
        },
        {
          type: "ul",
          items: [
            "the donor looks visibly depleted afterward",
            "the number claimed seems high relative to donor appearance",
            "multiple sessions have already been performed",
            "a large count was used but the visible result remains weak",
            "future options now seem more limited than expected",
          ],
        },
      ],
    },
    {
      id: "hairs-per-graft",
      heading: "Why hairs per graft matter too",
      blocks: [
        {
          type: "p",
          text: "Cosmetic impact depends not only on how many grafts were moved, but how many hairs those grafts contained. A patient with a lower hair-to-graft ratio may get less visible density from the same graft number. That is why raw numbers alone can mislead patients.",
        },
      ],
    },
    {
      id: "big-sessions-planning",
      heading: "Big sessions and long-term planning",
      blocks: [
        {
          type: "p",
          text: "Large sessions may sometimes be appropriate, but they should still be judged in the context of:",
        },
        {
          type: "ul",
          items: [
            "donor reserve",
            "age",
            "expected future loss",
            "whether crown work may still be needed",
            "whether native hair is stable",
          ],
        },
        {
          type: "p",
          text: "A large session that solves a short-term cosmetic concern but weakens long-term planning may not be a strategic success.",
        },
      ],
    },
    {
      id: "why-independent-review",
      heading: "Why independent review may help",
      blocks: [
        {
          type: "p",
          text: "Independent review can help patients think more clearly about whether the graft number appears consistent with donor preservation, visible donor outcome, and the overall logic of the case.",
        },
        {
          type: "p",
          text: "[Request a review](/request-review). [Overharvested Donor Area: What to Look For](/overharvested-donor-area). [Donor ageing and hair-to-graft ratios](/donor-ageing-and-hair-to-graft-ratios). [Donor Reserve and Future Options: Why Long-Term Planning Matters](/donor-reserve-and-future-options). [Sample report](/sample-report).",
        },
      ],
    },
  ],
  faqs: [],
  ctaLead: "Worried too many grafts may have been taken?",
  ctaSupporting: "Request an independent HairAudit review.",
  relatedSlugs: [
    "overharvested-donor-area",
    "donor-ageing-and-hair-to-graft-ratios",
    "donor-reserve-and-future-options",
  ],
};
