import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { whatMakesAHairTransplantLookNaturalArticle as article } from "@/lib/seo/patient-intent-articles/what-makes-a-hair-transplant-look-natural";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function WhatMakesAHairTransplantLookNaturalPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
