/**
 * HA-PATHWAY-FIX — pathway-specific patient questionnaires.
 *
 * Questionnaire selection is determined exclusively by
 * `cases.patient_review_pathway`. Missing/invalid pathways fail closed
 * (never silently default to post_surgery).
 */

import {
  PATIENT_AUDIT_SECTIONS,
  type PatientAuditAnswers,
  type PatientFormQuestion,
} from "@/lib/patientAuditForm";
import {
  isPatientReviewPathway,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";

export type PatientIntakeSection = {
  id: string;
  title: string;
  description?: string;
  advanced?: boolean;
  questions: PatientFormQuestion[];
};

export const INVALID_PATIENT_REVIEW_PATHWAY_QUESTIONNAIRE_ERROR =
  "This case is missing a valid review pathway. Please start a new review from your dashboard.";

/** Prospective planning questionnaire for pre_surgery cases. */
export const PATIENT_PRE_SURGERY_SECTIONS: readonly PatientIntakeSection[] = [
  {
    id: "goals_planning",
    title: "Your Hair Restoration Goals",
    description:
      "Tell us about your hair-loss history and what you hope a transplant could achieve.",
    questions: [
      {
        id: "hair_loss_history",
        prompt: "How long have you been noticing hair loss?",
        type: "select",
        options: [
          { value: "under_1_year", label: "Less than 1 year" },
          { value: "1_3_years", label: "1–3 years" },
          { value: "3_5_years", label: "3–5 years" },
          { value: "5_plus_years", label: "5+ years" },
          { value: "not_sure", label: "Not sure" },
        ],
        required: true,
      },
      {
        id: "hair_loss_pattern_self",
        prompt: "Where is hair loss most noticeable for you?",
        type: "checkbox",
        options: [
          { value: "hairline", label: "Hairline / temples" },
          { value: "mid_scalp", label: "Mid-scalp" },
          { value: "crown", label: "Crown" },
          { value: "diffuse", label: "Diffuse thinning" },
          { value: "other", label: "Other" },
        ],
        required: true,
      },
      {
        id: "current_treatments",
        prompt: "Current treatments or medications for hair loss (if any)",
        type: "textarea",
        placeholder: "e.g. finasteride, minoxidil, none, or not sure",
        required: true,
        help: "Include anything you currently use, or write “none”.",
      },
      {
        id: "health_context",
        prompt: "Any health context that may affect planning? (optional)",
        type: "textarea",
        placeholder: "e.g. scalp conditions, medications, or relevant medical history",
        required: false,
      },
      {
        id: "transplant_goals",
        prompt: "What are your main transplant goals?",
        type: "textarea",
        placeholder: "e.g. restore hairline, add density, improve crown coverage",
        required: true,
      },
      {
        id: "priority_areas",
        prompt: "Which areas are your highest priority?",
        type: "checkbox",
        options: [
          { value: "hairline", label: "Hairline" },
          { value: "temples", label: "Temples" },
          { value: "mid_scalp", label: "Mid-scalp" },
          { value: "crown", label: "Crown" },
          { value: "overall_density", label: "Overall density" },
        ],
        required: true,
      },
      {
        id: "expectations",
        prompt: "What result would feel successful to you?",
        type: "textarea",
        placeholder: "Describe the look or coverage you hope for",
        required: true,
      },
    ],
  },
  {
    id: "proposed_clinic_plan",
    title: "Proposed Clinic Plan (optional)",
    description:
      "If a clinic has already shared a plan or quote, you can add those details here. Everything in this section is optional.",
    questions: [
      {
        id: "clinic_name",
        prompt: "Clinic name (optional)",
        type: "text",
        placeholder: "ABC Hair Clinic",
        required: false,
      },
      {
        id: "surgeon_name",
        prompt: "Surgeon name (optional)",
        type: "text",
        placeholder: "Dr. Smith",
        required: false,
      },
      {
        id: "clinic_country",
        prompt: "Clinic country (optional)",
        type: "select",
        options: [
          { value: "turkey", label: "Turkey" },
          { value: "spain", label: "Spain" },
          { value: "india", label: "India" },
          { value: "thailand", label: "Thailand" },
          { value: "mexico", label: "Mexico" },
          { value: "brazil", label: "Brazil" },
          { value: "argentina", label: "Argentina" },
          { value: "colombia", label: "Colombia" },
          { value: "australia", label: "Australia" },
          { value: "uk", label: "United Kingdom" },
          { value: "usa", label: "United States" },
          { value: "canada", label: "Canada" },
          { value: "uae", label: "UAE" },
          { value: "belgium", label: "Belgium" },
          { value: "germany", label: "Germany" },
          { value: "poland", label: "Poland" },
          { value: "greece", label: "Greece" },
          { value: "other", label: "Other" },
        ],
        required: false,
      },
      {
        id: "clinic_country_other",
        prompt: "Clinic country (if Other)",
        type: "text",
        placeholder: "e.g. Portugal",
        required: false,
        dependsOn: { questionId: "clinic_country", value: "other" },
      },
      {
        id: "clinic_city",
        prompt: "Clinic city (optional)",
        type: "text",
        placeholder: "Istanbul",
        required: false,
      },
      {
        id: "proposed_procedure_date",
        prompt: "Proposed procedure date (optional)",
        type: "date",
        required: false,
        help: "Only if a date has been proposed — not required to continue.",
      },
      {
        id: "proposed_technique",
        prompt: "Proposed technique (optional)",
        type: "select",
        options: [
          { value: "fue", label: "FUE" },
          { value: "fut", label: "FUT" },
          { value: "dhi", label: "DHI" },
          { value: "robotic", label: "Robotic" },
          { value: "not_sure", label: "Not sure" },
          { value: "other", label: "Other" },
        ],
        required: false,
        help: "Choose what was proposed; leave blank if none yet.",
      },
      {
        id: "proposed_technique_other",
        prompt: "Proposed technique (if Other)",
        type: "text",
        placeholder: "e.g. Combined",
        required: false,
        dependsOn: { questionId: "proposed_technique", value: "other" },
      },
      {
        id: "graft_estimate",
        prompt: "Graft estimate (optional)",
        type: "number",
        min: 0,
        max: 20000,
        placeholder: "e.g. 3500",
        required: false,
      },
      {
        id: "clinic_quote",
        prompt: "Quoted amount (optional)",
        type: "text",
        placeholder: "e.g. 4500 EUR",
        required: false,
      },
      {
        id: "proposed_clinic_plan_notes",
        prompt: "Anything else from the clinic plan? (optional)",
        type: "textarea",
        placeholder: "Packages, staging, medical therapy recommendations, etc.",
        required: false,
      },
    ],
  },
];

/** Full post-surgery audit sections (existing form). */
export const PATIENT_POST_SURGERY_SECTIONS: readonly PatientIntakeSection[] =
  PATIENT_AUDIT_SECTIONS;

export const PATHWAY_QUESTIONNAIRE_SECTION_IDS: Record<
  PatientReviewPathway,
  readonly string[]
> = {
  pre_surgery: PATIENT_PRE_SURGERY_SECTIONS.map((s) => s.id),
  post_surgery: [
    "clinic_procedure",
    "transparency",
    "cost",
    "surgical_experience",
    "recovery",
    "results",
    "donor_healing_concern",
  ],
};

export const PATHWAY_QUESTIONNAIRE_MINIMAL_SECTION_IDS: Record<
  PatientReviewPathway,
  readonly string[]
> = {
  pre_surgery: ["goals_planning"],
  post_surgery: ["clinic_procedure"],
};

/**
 * Friction-free required fields per pathway.
 * Pre-surgery must NOT require a procedure date.
 */
export const PATHWAY_QUESTIONNAIRE_MINIMAL_REQUIRED_FIELD_IDS: Record<
  PatientReviewPathway,
  readonly string[]
> = {
  pre_surgery: [
    "hair_loss_history",
    "hair_loss_pattern_self",
    "current_treatments",
    "transplant_goals",
    "priority_areas",
    "expectations",
  ],
  post_surgery: [
    "clinic_name",
    "clinic_country",
    "clinic_city",
    "procedure_date",
    "procedure_type",
  ],
};

export type PathwayQuestionnairePageCopy = {
  title: string;
  subtitle: string;
  titleKey: string;
  subtitleKey: string;
};

export const PATHWAY_QUESTIONNAIRE_PAGE_COPY: Record<
  PatientReviewPathway,
  PathwayQuestionnairePageCopy
> = {
  pre_surgery: {
    title: "About Your Hair Restoration Goals",
    subtitle:
      "These questions help us understand your hair-loss history, goals, and any proposed clinic plan.",
    titleKey: "dashboard.patient.forms.questionsPage.preSurgery.title",
    subtitleKey: "dashboard.patient.forms.questionsPage.preSurgery.subtitle",
  },
  post_surgery: {
    title: "About your procedure",
    subtitle: "These questions help us understand your surgery, healing, and results.",
    titleKey: "dashboard.patient.forms.questionsPage.postSurgery.title",
    subtitleKey: "dashboard.patient.forms.questionsPage.postSurgery.subtitle",
  },
};

/** Fail-closed: only accept an explicit canonical pathway value. */
export function resolveCanonicalPatientReviewPathway(
  value: unknown
): PatientReviewPathway | null {
  return isPatientReviewPathway(value) ? value : null;
}

/**
 * Resolve pathway exclusively from the case row.
 * Never reads URL params or client overrides. Fail closed on missing/invalid.
 */
export function resolveQuestionnairePathwayFromCase(
  row: { patient_review_pathway?: string | null } | null | undefined
): PatientReviewPathway | null {
  return resolveCanonicalPatientReviewPathway(row?.patient_review_pathway);
}

/** Ignore any client/URL-supplied pathway; only the case row counts. */
export function resolveQuestionnairePathwayIgnoringClientOverrides(args: {
  caseRow: { patient_review_pathway?: string | null } | null | undefined;
  /** Intentionally ignored — URL/query/client state must not select the form. */
  urlPathway?: unknown;
  clientPathway?: unknown;
}): PatientReviewPathway | null {
  void args.urlPathway;
  void args.clientPathway;
  return resolveQuestionnairePathwayFromCase(args.caseRow);
}

export function getPatientIntakeSectionsForPathway(
  pathway: PatientReviewPathway
): readonly PatientIntakeSection[] {
  return pathway === "pre_surgery"
    ? PATIENT_PRE_SURGERY_SECTIONS
    : PATIENT_POST_SURGERY_SECTIONS;
}

export function filterIntakeSectionsForPathway(
  pathway: PatientReviewPathway,
  opts?: { minimal?: boolean; includeAdvanced?: boolean }
): PatientIntakeSection[] {
  const sections = getPatientIntakeSectionsForPathway(pathway);
  const allowed = opts?.minimal
    ? PATHWAY_QUESTIONNAIRE_MINIMAL_SECTION_IDS[pathway]
    : PATHWAY_QUESTIONNAIRE_SECTION_IDS[pathway];

  return sections.filter((s) => {
    if (!allowed.includes(s.id)) return false;
    if (s.advanced && !opts?.includeAdvanced) return false;
    return true;
  });
}

export function getPathwayQuestionnairePageCopy(
  pathway: PatientReviewPathway
): PathwayQuestionnairePageCopy {
  return PATHWAY_QUESTIONNAIRE_PAGE_COPY[pathway];
}

export function getQuestionsHrefAfterRequiredImages(caseId: string): string {
  return `/cases/${caseId}/patient/questions`;
}

function isFieldAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

/** Client + API gate for friction-free continue. */
export function getMissingPathwayMinimalRequiredFields(
  pathway: PatientReviewPathway,
  answers: PatientAuditAnswers | Record<string, unknown> | null | undefined
): string[] {
  const required = PATHWAY_QUESTIONNAIRE_MINIMAL_REQUIRED_FIELD_IDS[pathway];
  const data = answers ?? {};
  return required.filter((id) => !isFieldAnswered(data[id]));
}

export function validatePathwayMinimalIntake(
  pathway: PatientReviewPathway,
  answers: PatientAuditAnswers | Record<string, unknown> | null | undefined
): string | null {
  const missing = getMissingPathwayMinimalRequiredFields(pathway, answers);
  if (missing.length === 0) return null;
  return `Missing required fields: ${missing.join(", ")}`;
}

/**
 * Pre-surgery must never require a completed procedure date.
 * Reject payloads that try to force post-surgery date validation onto pre_surgery.
 */
export function assertPreSurgeryDoesNotRequireProcedureDate(
  pathway: PatientReviewPathway
): void {
  if (pathway !== "pre_surgery") return;
  const required = PATHWAY_QUESTIONNAIRE_MINIMAL_REQUIRED_FIELD_IDS.pre_surgery;
  if (required.includes("procedure_date")) {
    throw new Error("pre_surgery questionnaire must not require procedure_date");
  }
}

export function isPreSurgeryQuestionnaire(pathway: PatientReviewPathway): boolean {
  return pathway === "pre_surgery";
}

export function questionnaireUsesCompletedSurgeryLanguage(
  pathway: PatientReviewPathway
): boolean {
  return pathway === "post_surgery";
}
