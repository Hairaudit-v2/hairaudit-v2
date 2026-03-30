import type { PatientIntentArticle } from "./types";

export const howToReadAHairauditReportArticle: PatientIntentArticle = {
  slug: "how-to-read-a-hairaudit-report",
  pathname: "/how-to-read-a-hairaudit-report",
  seoTitle: "How to Read a HairAudit Report | HairAudit",
  metaDescription:
    "Not sure how to read a HairAudit report? Learn what the key sections mean, how to interpret confidence and evidence limits, and what to focus on first.",
  h1: "How to Read a HairAudit Report",
  intro:
    "A HairAudit report is designed to help patients understand visible evidence more clearly, but not every reader knows what to focus on first. Some fixate only on the score. Others read a single line and ignore the confidence or evidence limits that give the real meaning. This page explains how to read the report more intelligently and what each section is there to do.",
  sections: [
    {
      id: "start-with-summary",
      heading: "Start with the overall summary, but do not stop there",
      blocks: [
        {
          type: "p",
          text: "The overall summary gives you a high-level orientation, but it is not the whole report. It helps frame the visible result, not replace the more detailed explanation underneath.",
        },
      ],
    },
    {
      id: "why-confidence-matters",
      heading: "Why confidence matters",
      blocks: [
        {
          type: "p",
          text: "Confidence is one of the most important parts of interpretation. A finding made with stronger evidence carries different weight than a finding made under more limited photo conditions. Patients should always read a conclusion together with the confidence or evidence-quality context around it.",
        },
      ],
    },
    {
      id: "domain-sections",
      heading: "What domain-by-domain sections are for",
      blocks: [
        {
          type: "p",
          text: "Sections on donor management, recipient design, density, direction, documentation, and naturalness help break the case into visible domains. A report is more useful when read as a pattern of findings rather than as one single verdict line.",
        },
      ],
    },
    {
      id: "evidence-limitations-not-excuses",
      heading: "Why evidence limitations are not excuses",
      blocks: [
        {
          type: "p",
          text: "When a report explains evidence limits, that is not the system avoiding a conclusion. It is the report being honest about what the photo set can and cannot support. That is a strength, not a weakness.",
        },
      ],
    },
    {
      id: "what-score-means",
      heading: "What the score does and does not mean",
      blocks: [
        {
          type: "p",
          text: "A score may help summarize overall visible quality patterns, but it should not be treated as the only thing that matters. Patients should also focus on:",
        },
        {
          type: "ul",
          items: [
            "what the report says the visible concern actually is",
            "what appears stronger or weaker in confidence",
            "what may still need more documentation",
            "how the findings relate to their real concern",
          ],
        },
      ],
    },
    {
      id: "what-to-focus-if-worried",
      heading: "What to focus on if you are worried",
      blocks: [
        {
          type: "p",
          text: "If you are worried, focus first on:",
        },
        {
          type: "ul",
          items: [
            "the summary",
            "confidence level",
            "donor observations",
            "density and design findings",
            "evidence limitations",
            "recommended follow-up or monitoring guidance",
          ],
        },
        {
          type: "p",
          text: "[Request an independent HairAudit review](/request-review). [sample HairAudit report](/sample-report). [What an Independent Hair Transplant Audit Can and Cannot Do](/what-an-independent-hair-transplant-audit-can-and-cannot-do). [FAQ](/faq).",
        },
      ],
    },
  ],
  faqs: [],
  ctaLead: "Want help understanding your own case more clearly?",
  ctaSupporting: "Request an independent HairAudit review.",
  relatedSlugs: [
    "what-an-independent-hair-transplant-audit-can-and-cannot-do",
    "can-a-hair-transplant-be-audited-from-photos",
    "when-should-you-seek-an-independent-hair-transplant-review",
  ],
};
