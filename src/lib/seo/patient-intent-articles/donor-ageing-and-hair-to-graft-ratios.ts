import type { PatientIntentArticle } from "./types";

export const donorAgeingAndHairToGraftRatiosArticle: PatientIntentArticle = {
  slug: "donor-ageing-and-hair-to-graft-ratios",
  pathname: "/donor-ageing-and-hair-to-graft-ratios",
  seoTitle: "Donor Ageing and Hair-to-Graft Ratios | HairAudit",
  metaDescription:
    "Why hairs per graft and donor changes over time affect how full a transplant can look—and how to interpret graft counts without overstating what photos can prove.",
  h1: "Donor ageing and hair-to-graft ratios",
  intro:
    "Two patients can receive the same graft count and still look very different. Part of that gap comes from hair-to-graft ratios (how many hairs each graft tends to carry) and from how donor hair density and calibre change over a lifetime. This page explains those ideas in patient language, with clear limits on what images or an independent audit can establish.",
  sections: [
    {
      id: "what-ratio-means",
      heading: "What “hair-to-graft ratio” usually means",
      blocks: [
        {
          type: "p",
          text: "In everyday patient conversations, people often hear a graft number quoted as if every graft equals the same amount of visible hair. In practice, grafts are follicular units that may contain one hair or several. More hairs per graft generally means more cosmetic coverage from the same graft count—other factors being equal.",
        },
      ],
    },
    {
      id: "why-density-looks-different",
      heading: "Why the same graft count can look fuller or thinner",
      blocks: [
        {
          type: "p",
          text: "Hair calibre, curl, colour contrast with skin, and styling all change how dense hair reads on camera and in person. Ratio is one piece of the puzzle, not the whole story.",
        },
      ],
    },
    {
      id: "donor-ageing",
      heading: "Donor changes over time",
      blocks: [
        {
          type: "p",
          text: "Donor hair, like hair elsewhere, can thin or miniaturise with age and with progressive pattern loss. That can affect how robust the donor looks years after surgery and how comfortable future harvesting discussions feel. It does not mean every patient faces the same trajectory—only that long-term planning should leave room for change.",
        },
      ],
    },
    {
      id: "graft-counts-context",
      heading: "How this connects to graft-count conversations",
      blocks: [
        {
          type: "p",
          text: "When you read or hear a large graft number, it helps to ask how that number sits next to donor appearance, recipient size, and future goals—not whether the integer sounds impressive on its own.",
        },
        {
          type: "p",
          text: "See [how many grafts is too many](/how-many-grafts-is-too-many) and [donor reserve and future options](/donor-reserve-and-future-options).",
        },
      ],
    },
    {
      id: "photos-limits",
      heading: "What photos and independent review can and cannot show",
      blocks: [
        {
          type: "p",
          text: "Photos can support discussion of visible density and donor pattern over time. They do not replace trichoscopy or clinical counts of hairs per graft. HairAudit describes what submitted evidence supports; it does not invent microscopic metrics from pictures alone.",
        },
        {
          type: "p",
          text: "[Can a hair transplant be audited from photos](/can-a-hair-transplant-be-audited-from-photos), [request a review](/request-review), [sample report](/sample-report).",
        },
      ],
    },
  ],
  faqs: [],
  ctaLead: "Want donor and density evidence described in plain language?",
  ctaSupporting: "Request an independent HairAudit review.",
  relatedSlugs: [
    "how-many-grafts-is-too-many",
    "donor-reserve-and-future-options",
    "overharvested-donor-area",
  ],
};
