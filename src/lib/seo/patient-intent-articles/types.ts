/**
 * Schema for long-form patient-intent SEO articles (education cluster).
 * Paragraph text may include markdown-style links: [label](/path).
 */
export type PatientIntentArticleBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] };

export type PatientIntentArticleSection = {
  /** Optional id for future deep links / TOC */
  id?: string;
  heading: string;
  blocks: PatientIntentArticleBlock[];
};

export type PatientIntentArticleFaq = {
  question: string;
  answer: string;
};

export type PatientIntentArticle = {
  slug: string;
  pathname: string;
  seoTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  sections: PatientIntentArticleSection[];
  /** Optional; FAQPage JSON-LD omitted when empty */
  faqs: PatientIntentArticleFaq[];
  /** Pack-specific CTA line (bold lead in markdown pack) */
  ctaLead?: string;
  /** Supporting sentence under the lead */
  ctaSupporting?: string;
  /** Intent/issue slugs; resolved via registry + patient issue library */
  relatedSlugs: string[];
};
