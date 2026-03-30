import type { PatientIntentArticle } from "./types";
import { afroHairTransplantDensityPlanningArticle } from "./afro-hair-transplant-density-planning";
import { badCrownResultAfterHairTransplantArticle } from "./bad-crown-result-after-hair-transplant";
import { badHairTransplantSignsArticle } from "./bad-hair-transplant-signs";
import { beardOrBodyHairTransplantQuestionsArticle } from "./beard-or-body-hair-transplant-questions";
import { canAHairTransplantBeAuditedFromPhotosArticle } from "./can-a-hair-transplant-be-audited-from-photos";
import { canAnOverharvestedDonorBeCorrectedArticle } from "./can-an-overharvested-donor-be-corrected";
import { donorAgeingAndHairToGraftRatiosArticle } from "./donor-ageing-and-hair-to-graft-ratios";
import { donorReserveAndFutureOptionsArticle } from "./donor-reserve-and-future-options";
import { eyebrowTransplantExpectationsArticle } from "./eyebrow-transplant-expectations";
import { femaleHairlineTransplantConcernsArticle } from "./female-hairline-transplant-concerns";
import { hairDirectionAndAngleAfterTransplantArticle } from "./hair-direction-and-angle-after-transplant";
import { hairTransplantDensityTooLowArticle } from "./hair-transplant-density-too-low";
import { hairTransplantRepairAfterOverseasSurgeryArticle } from "./hair-transplant-repair-after-overseas-surgery";
import { hairTransplantGraftFailureWhatPhotosCanAndCannotShowArticle } from "./hair-transplant-graft-failure-what-photos-can-and-cannot-show";
import { isMyHairTransplantNormalArticle } from "./is-my-hair-transplant-normal";
import { howManyGraftsIsTooManyArticle } from "./how-many-grafts-is-too-many";
import { howToDocumentAHairTransplantProblemProperlyArticle } from "./how-to-document-a-hair-transplant-problem-properly";
import { howToThinkAboutRealisticHairTransplantExpectationsArticle } from "./how-to-think-about-realistic-hair-transplant-expectations";
import { overharvestedDonorAreaArticle } from "./overharvested-donor-area";
import { rowPatterningAfterHairTransplantArticle } from "./row-patterning-after-hair-transplant";
import { shockLossVsGraftFailureArticle } from "./shock-loss-vs-graft-failure";
import { templeWorkAndFrontalFramingArticle } from "./temple-work-and-frontal-framing";
import { wetHairVsDryHairAfterTransplantArticle } from "./wet-hair-vs-dry-hair-after-transplant";
import { thinkingAboutASecondHairTransplantArticle } from "./thinking-about-a-second-hair-transplant";
import { unnaturalHairlineAfterHairTransplantArticle } from "./unnatural-hairline-after-hair-transplant";
import { whatMakesAHairTransplantLookNaturalArticle } from "./what-makes-a-hair-transplant-look-natural";
import { whatPhotosAreNeededArticle } from "./what-photos-are-needed-for-a-proper-hair-transplant-review";
import { whyDoesMyHairTransplantLookWorseInBrightLightArticle } from "./why-does-my-hair-transplant-look-worse-in-bright-light";
import { whyHairCalibreMattersMoreThanPatientsThinkArticle } from "./why-hair-calibre-matters-more-than-patients-think";
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
  badCrownResultAfterHairTransplantArticle,
  thinkingAboutASecondHairTransplantArticle,
  howManyGraftsIsTooManyArticle,
  donorAgeingAndHairToGraftRatiosArticle,
  donorReserveAndFutureOptionsArticle,
  canAnOverharvestedDonorBeCorrectedArticle,
  isMyHairTransplantNormalArticle,
  whyDoesMyHairTransplantLookWorseInBrightLightArticle,
  wetHairVsDryHairAfterTransplantArticle,
  whyHairCalibreMattersMoreThanPatientsThinkArticle,
  howToThinkAboutRealisticHairTransplantExpectationsArticle,
  femaleHairlineTransplantConcernsArticle,
  eyebrowTransplantExpectationsArticle,
  afroHairTransplantDensityPlanningArticle,
  hairTransplantRepairAfterOverseasSurgeryArticle,
  beardOrBodyHairTransplantQuestionsArticle,
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
