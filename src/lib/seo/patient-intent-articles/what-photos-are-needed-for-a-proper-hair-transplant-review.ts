import type { PatientIntentArticle } from "./types";

/**
 * Supports internal links from Batch 1 pack; body consolidates photo guidance
 * repeated across those pages (donor set, timeline, quality, upload list).
 */
export const whatPhotosAreNeededArticle: PatientIntentArticle = {
  slug: "what-photos-are-needed-for-a-proper-hair-transplant-review",
  pathname: "/what-photos-are-needed-for-a-proper-hair-transplant-review",
  seoTitle: "What Photos Are Needed for a Proper Hair Transplant Review? | HairAudit",
  metaDescription:
    "Checklist of donor, recipient, and timeline photos that help an independent HairAudit review—plus lighting, angles, and what weak evidence looks like.",
  h1: "What Photos Are Needed for a Proper Hair Transplant Review?",
  intro:
    "Independent review depends on what you can show. A structured photo set—donor and recipient, multiple dates, and consistent angles—usually supports much clearer conclusions than a single snapshot. This page pulls together the photo guidance referenced across our patient guides so you know what to gather before you submit.",
  sections: [
    {
      id: "why-timeline",
      heading: "Why timelines matter more than one photo",
      blocks: [
        {
          type: "p",
          text: "Comparing stages over time usually gives a clearer picture than judging from one isolated moment. Early donor appearance can be misleading; the same is true for recipient density while shedding and regrowth are still unfolding.",
        },
        {
          type: "p",
          text: "If you are unsure whether it is too early to judge growth, read [when is a hair transplant result final](/when-is-a-hair-transplant-final). For shedding versus poor survival, see [shock loss vs graft failure](/shock-loss-vs-graft-failure).",
        },
      ],
    },
    {
      id: "donor-photos",
      heading: "Donor area: views that help most",
      blocks: [
        {
          type: "p",
          text: "To assess donor concerns properly, the most helpful photo set usually includes:",
        },
        {
          type: "ul",
          items: [
            "rear donor photos in even lighting",
            "left and right donor views",
            "photos at more than one hair length if available",
            "close-up donor images where thinning is most visible",
            "time-based follow-up images rather than one isolated photo",
          ],
        },
        {
          type: "p",
          text: "For what those patterns may mean, see [overharvested donor area: what to look for](/overharvested-donor-area).",
        },
      ],
    },
    {
      id: "recipient-timeline",
      heading: "Recipient area: a useful follow-up sequence",
      blocks: [
        {
          type: "p",
          text: "When the question is whether growth looks on track or unusually weak, a practical timeline often includes:",
        },
        {
          type: "ul",
          items: [
            "pre-operative photos",
            "day 0 recipient photos",
            "early healing photos",
            "3-month follow-up",
            "6-month follow-up",
            "12-month follow-up where available",
          ],
        },
      ],
    },
    {
      id: "quality",
      heading: "Lighting, angle, and quality",
      blocks: [
        {
          type: "p",
          text: "Not all photos are equally useful. Lighting, distance, angle, hair length, dryness or wetness, and image sharpness all affect what can be interpreted. Poor-quality photos can create false reassurance or false concern.",
        },
        {
          type: "p",
          text: "Consistent lighting matters. Harsh shadows, wet hair, or inconsistent angles can make donor or recipient density look worse or better than it really is. Consistent angles and timeline-based documentation are especially valuable.",
        },
      ],
    },
    {
      id: "strongest-set",
      heading: "The strongest combined set for review",
      blocks: [
        {
          type: "p",
          text: "The strongest review usually comes from evidence that includes:",
        },
        {
          type: "ul",
          items: [
            "pre-operative views",
            "donor rear and side views",
            "day 0 recipient photos",
            "follow-up photos at meaningful intervals",
            "close-up or macro images where available",
          ],
        },
        {
          type: "p",
          text: "Patients usually get the strongest review when they also submit clear donor photos, clear recipient photos, timeline images, any day 0 evidence, and operative details if available. The more complete the evidence, the more confidently interpretation can be explained—always within the limits described in [can a hair transplant be audited from photos](/can-a-hair-transplant-be-audited-from-photos).",
        },
      ],
    },
  ],
  faqs: [],
  ctaLead: "Ready to submit your photo set?",
  ctaSupporting:
    "Request an independent HairAudit review, or preview how findings are written in a sample report first.",
  relatedSlugs: [
    "can-a-hair-transplant-be-audited-from-photos",
    "overharvested-donor-area",
    "shock-loss-vs-graft-failure",
  ],
};
