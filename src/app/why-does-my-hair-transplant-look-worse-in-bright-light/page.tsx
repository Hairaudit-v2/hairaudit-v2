import PatientIntentArticlePage from "@/components/patient-education/PatientIntentArticlePage";
import { createPageMetadata } from "@/lib/seo/pageMetadata";
import { whyDoesMyHairTransplantLookWorseInBrightLightArticle as article } from "@/lib/seo/patient-intent-articles/why-does-my-hair-transplant-look-worse-in-bright-light";

export const metadata = createPageMetadata({
  title: article.seoTitle,
  description: article.metaDescription,
  pathname: article.pathname,
});

export default function WhyDoesMyHairTransplantLookWorseInBrightLightPage() {
  return <PatientIntentArticlePage articleSlug={article.slug} />;
}
