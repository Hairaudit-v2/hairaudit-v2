import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { whatAnIndependentHairTransplantAuditCanAndCannotDoArticle as article } from "@/lib/seo/patient-intent-articles/what-an-independent-hair-transplant-audit-can-and-cannot-do";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function WhatAnIndependentHairTransplantAuditCanAndCannotDoPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
