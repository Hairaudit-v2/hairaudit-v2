import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { templeWorkAndFrontalFramingArticle as article } from "@/lib/seo/patient-intent-articles/temple-work-and-frontal-framing";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function TempleWorkAndFrontalFramingPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
