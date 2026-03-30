import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { eyebrowTransplantExpectationsArticle as article } from "@/lib/seo/patient-intent-articles/eyebrow-transplant-expectations";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function EyebrowTransplantExpectationsPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
