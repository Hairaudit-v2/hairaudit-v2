import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { hairTransplantGraftFailureWhatPhotosCanAndCannotShowArticle as article } from "@/lib/seo/patient-intent-articles/hair-transplant-graft-failure-what-photos-can-and-cannot-show";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function HairTransplantGraftFailureWhatPhotosCanAndCannotShowPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
