import type { PatientIntentArticle } from "@/lib/seo/patient-intent-articles/types";
import { getPatientIntentArticle } from "@/lib/seo/patient-intent-articles";

/**
 * Theme groupings for the public patient guides hub (/hair-transplant-problems).
 * Every patient-intent article slug should appear exactly once across `slugs`.
 */
export type PatientIntentHubTheme = {
  id: string;
  title: string;
  description: string;
  slugs: readonly string[];
};

export const patientIntentHubThemes: PatientIntentHubTheme[] = [
  {
    id: "healing-timing",
    title: "Healing, timing, and what can look normal",
    description:
      "Recovery timelines, shock loss versus poor growth, when a result is mature enough to judge, and how wet hair, bright light, or photo angle changes what you see.",
    slugs: [
      "shock-loss-vs-graft-failure",
      "when-is-a-hair-transplant-final",
      "when-is-hair-transplant-growth-delay-normal-vs-concerning",
      "repair-vs-wait-after-poor-hair-transplant-growth",
      "is-my-hair-transplant-normal",
      "wet-hair-vs-dry-hair-after-transplant",
      "why-does-my-hair-transplant-look-worse-in-bright-light",
      "hair-transplant-graft-failure-what-photos-can-and-cannot-show",
    ],
  },
  {
    id: "appearance-design",
    title: "Hairline, crown, density, and naturalness",
    description:
      "How design and placement affect whether a transplant looks natural—across common patterns, specialised areas (temples, eyebrows), and different hair types.",
    slugs: [
      "unnatural-hairline-after-hair-transplant",
      "bad-crown-result-after-hair-transplant",
      "hair-transplant-density-too-low",
      "row-patterning-after-hair-transplant",
      "hair-direction-and-angle-after-transplant",
      "temple-work-and-frontal-framing",
      "what-makes-a-hair-transplant-look-natural",
      "female-hairline-transplant-concerns",
      "eyebrow-transplant-expectations",
      "afro-hair-transplant-density-planning",
      "beard-or-body-hair-transplant-questions",
    ],
  },
  {
    id: "donor-revision",
    title: "Donor area, graft counts, and planning another procedure",
    description:
      "Donor safety, overharvesting, long-term reserve, and what to weigh before a second surgery.",
    slugs: [
      "overharvested-donor-area",
      "normal-donor-healing-after-fue",
      "can-an-overharvested-donor-be-corrected",
      "donor-reserve-and-future-options",
      "donor-ageing-and-hair-to-graft-ratios",
      "how-many-grafts-is-too-many",
      "thinking-about-a-second-hair-transplant",
    ],
  },
  {
    id: "independent-review",
    title: "When to seek independent review, photos, and expectations",
    description:
      "Warning signs, realistic expectations, overseas repair context, and what photo-based independent assessment can clarify before you decide next steps.",
    slugs: [
      "when-should-you-seek-an-independent-hair-transplant-review",
      "bad-hair-transplant-signs",
      "how-to-think-about-realistic-hair-transplant-expectations",
      "why-hair-calibre-matters-more-than-patients-think",
      "hair-transplant-repair-after-overseas-surgery",
      "can-a-hair-transplant-be-audited-from-photos",
      "what-photos-are-needed-for-a-proper-hair-transplant-review",
    ],
  },
  {
    id: "hairaudit-process",
    title: "Documentation, HairAudit reports, second opinions, and disputes",
    description:
      "How to organise evidence, what an independent audit can and cannot do, how to read a HairAudit report, and how this differs from a clinic’s own assessment.",
    slugs: [
      "how-to-document-a-hair-transplant-problem-properly",
      "hair-transplant-second-opinion-vs-clinic-opinion",
      "how-to-prepare-for-a-hair-transplant-complaint-or-dispute",
      "what-an-independent-hair-transplant-audit-can-and-cannot-do",
      "how-to-read-a-hairaudit-report",
      "should-you-trust-a-clinic-assessment-of-its-own-work",
    ],
  },
];

export type PatientIntentHubThemeResolved = Omit<PatientIntentHubTheme, "slugs"> & {
  guides: PatientIntentArticle[];
};

export function listPatientIntentGuidesGroupedByTheme(): PatientIntentHubThemeResolved[] {
  return patientIntentHubThemes.map(({ slugs, ...rest }) => ({
    ...rest,
    guides: slugs
      .map((slug) => getPatientIntentArticle(slug))
      .filter((a): a is PatientIntentArticle => a != null),
  }));
}
