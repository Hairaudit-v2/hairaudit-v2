import type { PatientIntentArticle } from "./types";
import { badHairTransplantSignsArticle } from "./bad-hair-transplant-signs";
import { canAHairTransplantBeAuditedFromPhotosArticle } from "./can-a-hair-transplant-be-audited-from-photos";
import { hairDirectionAndAngleAfterTransplantArticle } from "./hair-direction-and-angle-after-transplant";
import { hairTransplantDensityTooLowArticle } from "./hair-transplant-density-too-low";
import { hairTransplantGraftFailureWhatPhotosCanAndCannotShowArticle } from "./hair-transplant-graft-failure-what-photos-can-and-cannot-show";
import { howToDocumentAHairTransplantProblemProperlyArticle } from "./how-to-document-a-hair-transplant-problem-properly";
import { overharvestedDonorAreaArticle } from "./overharvested-donor-area";
import { rowPatterningAfterHairTransplantArticle } from "./row-patterning-after-hair-transplant";
import { shockLossVsGraftFailureArticle } from "./shock-loss-vs-graft-failure";
import { templeWorkAndFrontalFramingArticle } from "./temple-work-and-frontal-framing";
import { unnaturalHairlineAfterHairTransplantArticle } from "./unnatural-hairline-after-hair-transplant";
import { whatMakesAHairTransplantLookNaturalArticle } from "./what-makes-a-hair-transplant-look-natural";
import { whatPhotosAreNeededArticle } from "./what-photos-are-needed-for-a-proper-hair-transplant-review";
import { whenIsAHairTransplantFinalArticle } from "./when-is-a-hair-transplant-final";
import { whenShouldYouSeekAnIndependentHairTransplantReviewArticle } from "./when-should-you-seek-an-independent-hair-transplant-review";

const patientIntentArticlesList: PatientIntentArticle[] = [
  overharvestedDonorAreaArticle,
  shockLossVsGraftFailureArticle,
  whenIsAHairTransplantFinalArticle,
  canAHairTransplantBeAuditedFromPhotosArticle,
  badHairTransplantSignsArticle,
  whatPhotosAreNeededArticle,
  howToDocumentAHairTransplantProblemProperlyArticle,
  whenShouldYouSeekAnIndependentHairTransplantReviewArticle,
  hairTransplantDensityTooLowArticle,
  hairTransplantGraftFailureWhatPhotosCanAndCannotShowArticle,
  unnaturalHairlineAfterHairTransplantArticle,
  whatMakesAHairTransplantLookNaturalArticle,
  rowPatterningAfterHairTransplantArticle,
  hairDirectionAndAngleAfterTransplantArticle,
  templeWorkAndFrontalFramingArticle,
];

export const patientIntentArticlesBySlug: Record<string, PatientIntentArticle> =
  Object.fromEntries(patientIntentArticlesList.map((a) => [a.slug, a]));

export const patientIntentArticlePathnames = patientIntentArticlesList.map((a) => a.pathname);

export function getPatientIntentArticle(slug: string): PatientIntentArticle | undefined {
  return patientIntentArticlesBySlug[slug];
}

export function listPatientIntentArticles(): PatientIntentArticle[] {
  return [...patientIntentArticlesList];
}

export type { PatientIntentArticle, PatientIntentArticleSection, PatientIntentArticleBlock } from "./types";
