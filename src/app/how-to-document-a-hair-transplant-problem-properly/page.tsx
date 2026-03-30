import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { howToDocumentAHairTransplantProblemProperlyArticle as article } from "@/lib/seo/patient-intent-articles/how-to-document-a-hair-transplant-problem-properly";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function HowToDocumentAHairTransplantProblemProperlyPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
