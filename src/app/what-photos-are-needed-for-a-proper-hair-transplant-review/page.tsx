import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { whatPhotosAreNeededArticle as article } from "@/lib/seo/patient-intent-articles/what-photos-are-needed-for-a-proper-hair-transplant-review";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function WhatPhotosAreNeededForAProperHairTransplantReviewPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
