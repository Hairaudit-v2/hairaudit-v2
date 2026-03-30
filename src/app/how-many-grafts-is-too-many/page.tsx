import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { howManyGraftsIsTooManyArticle as article } from "@/lib/seo/patient-intent-articles/how-many-grafts-is-too-many";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function HowManyGraftsIsTooManyPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
