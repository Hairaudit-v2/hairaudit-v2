import { getPatientIntentArticle } from "@/lib/seo/patient-intent-articles";
import { patientIssueLibrary } from "@/lib/patientEducationIssues";

export type ResolvedPatientGuideLink = {
  pathname: string;
  h1: string;
  metaDescription: string;
};

/** Resolve a patient-intent article slug or issue slug to link metadata for related-guide lists. */
export function resolvePatientGuideLink(slug: string): ResolvedPatientGuideLink | null {
  const article = getPatientIntentArticle(slug);
  if (article) {
    return {
      pathname: article.pathname,
      h1: article.h1,
      metaDescription: article.metaDescription,
    };
  }
  const issue = patientIssueLibrary.find((item) => item.slug === slug);
  if (issue) {
    return {
      pathname: `/${issue.slug}`,
      h1: issue.title,
      metaDescription: issue.description,
    };
  }
  return null;
}
