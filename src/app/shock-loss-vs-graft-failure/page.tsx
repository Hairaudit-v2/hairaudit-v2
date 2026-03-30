import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { shockLossVsGraftFailureArticle as article } from "@/lib/seo/patient-intent-articles/shock-loss-vs-graft-failure";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function ShockLossVsGraftFailurePage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
