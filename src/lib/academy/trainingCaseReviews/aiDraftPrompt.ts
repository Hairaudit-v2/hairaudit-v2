import {
  ACADEMY_OPTIONAL_PHOTO_CATEGORIES,
  ACADEMY_REQUIRED_PHOTO_CATEGORIES,
} from "../constants";
import { TRAINING_CASE_REVIEW_SECTIONS } from "./reviewSections";
import { AI_REVIEW_IMAGE_LIMITATION_COPY } from "./aiDraftTypes";

/** Educational AI review dimensions mapped to formal review section keys */
export const AI_REVIEW_CATEGORY_HINTS: { label: string; sectionKey: string }[] = [
  { label: "Photo completeness", sectionKey: "communication_docs" },
  { label: "Donor area appearance", sectionKey: "donor_management" },
  { label: "Donor extraction spread", sectionKey: "extraction_pattern" },
  { label: "Recipient site planning", sectionKey: "recipient_design" },
  { label: "Hairline design", sectionKey: "hairline_design" },
  { label: "Temple transition", sectionKey: "hairline_design" },
  { label: "Direction and angle control", sectionKey: "direction_angle" },
  { label: "Density distribution", sectionKey: "density_planning" },
  { label: "Graft placement pattern", sectionKey: "implantation_quality" },
  { label: "Tissue handling signs visible in images", sectionKey: "bleeding_trauma" },
  { label: "Post-operative presentation", sectionKey: "postop_presentation" },
  { label: "Documentation quality", sectionKey: "communication_docs" },
];

export const TRAINING_CASE_AI_REVIEW_SYSTEM_PROMPT = `You are an educational coaching assistant for the IIOHR / HairAudit training portal.

MISSION
Help faculty draft developmental observations from supervised training case images. This is NOT a formal HairAudit patient audit, medico-legal report, or competency certification.

STRICT RULES
- Use supportive, educational tone focused on skill progression.
- Do NOT use punitive audit language (fraud, malpractice, negligence, dishonest, etc.).
- Do NOT make medico-legal conclusions, definitive medical diagnoses, or patient-facing report language.
- Do NOT assign numeric scores, pass/fail grades, or certify competency.
- Do NOT say the trainee passed or failed, or that a surgeon is safe/unsafe.
- Do NOT guarantee patient outcomes or claim certainty when photos are incomplete.
- Do NOT state facts you cannot verify from images; widen uncertainty and lower confidence instead.
- Observations are suggestions only — faculty makes the final judgement.
- When image evidence is insufficient, say so explicitly in imageLimitations and safetyNotes.

ASSESS ONLY VISIBLE TRAINING EVIDENCE (when images support it)
- Completeness of image documentation
- Donor extraction spread and donor area presentation
- Visible donor trauma or tissue-handling concerns (tentative, image-limited)
- Recipient distribution and site planning
- Hairline design and temple transition
- Density planning where visible
- Implantation / graft placement pattern and direction where visible
- Post-operative presentation

OUTPUT
Return ONLY valid JSON matching the provided schema. No markdown.

Always include in safetyNotes:
"${AI_REVIEW_IMAGE_LIMITATION_COPY}"

sectionKey values MUST be one of the allowed section keys provided in the user message.`;

export type TrainingCaseAiPromptContext = {
  caseType: string | null;
  caseDate: string | null;
  traineeStage: string | null;
  traineeWeek: string | null;
  presentPhotoCategories: string[];
  missingPhotoCategories: string[];
  imageCount: number;
};

export function buildTrainingCaseAiReviewUserPrompt(ctx: TrainingCaseAiPromptContext): string {
  const sectionKeys = TRAINING_CASE_REVIEW_SECTIONS.map((s) => `- ${s.key}: ${s.title}`).join("\n");
  const categoryHints = AI_REVIEW_CATEGORY_HINTS.map((c) => `- ${c.label} → sectionKey: ${c.sectionKey}`).join("\n");
  const required = ACADEMY_REQUIRED_PHOTO_CATEGORIES.join(", ");
  const optional = ACADEMY_OPTIONAL_PHOTO_CATEGORIES.join(", ");

  return [
    "## Task",
    "Draft educational faculty coaching suggestions from the training case images attached.",
    "Suggest observations only — faculty will review, edit, and submit the final review.",
    "",
    "## Case context",
    `Case type: ${ctx.caseType ?? "(not specified)"}`,
    `Case date: ${ctx.caseDate ?? "(not specified)"}`,
    `Trainee stage: ${ctx.traineeStage ?? "(not specified)"}`,
    `Trainee week: ${ctx.traineeWeek ?? "(not specified)"}`,
    `Active training images provided: ${ctx.imageCount}`,
    "",
    "## Photo categories",
    `Required categories: ${required}`,
    `Optional categories: ${optional}`,
    `Present upload categories: ${ctx.presentPhotoCategories.length ? ctx.presentPhotoCategories.join(", ") : "(none)"}`,
    `Missing required categories: ${ctx.missingPhotoCategories.length ? ctx.missingPhotoCategories.join(", ") : "(none — all required present)"}`,
    "",
    "## Review section keys (use exactly these sectionKey values)",
    sectionKeys,
    "",
    "## Suggested coaching dimensions (map to sectionKey above)",
    categoryHints,
    "",
    "## Output guidance",
    "- overallSummary: brief supportive overview of visible learning themes",
    "- imageQualityNotes: documentation / clarity observations",
    "- missingCategories: photo slots not evidenced in uploads",
    "- strengths / improvementAreas: bullet-style coaching points",
    "- suggestedNextFocus: one priority skill for next supervised case",
    "- sectionSuggestions: only for sections where images support a comment; include confidence low|medium|high",
    "- When uncertain, use low confidence and explain imageLimitations",
  ].join("\n");
}

/** OpenAI strict structured-output schema (all object properties must be listed in `required`). */
export const TRAINING_CASE_AI_REVIEW_JSON_SCHEMA = {
  name: "training_case_ai_review_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "overallSummary",
      "imageQualityNotes",
      "missingCategories",
      "strengths",
      "improvementAreas",
      "suggestedNextFocus",
      "sectionSuggestions",
      "safetyNotes",
    ],
    properties: {
      overallSummary: { type: "string" },
      imageQualityNotes: { type: "array", items: { type: "string" } },
      missingCategories: { type: "array", items: { type: "string" } },
      strengths: { type: "array", items: { type: "string" } },
      improvementAreas: { type: "array", items: { type: "string" } },
      suggestedNextFocus: { type: "string" },
      sectionSuggestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "sectionKey",
            "whatWentWell",
            "needsImprovement",
            "clinicalImportance",
            "nextCaseFocus",
            "confidence",
            "imageLimitations",
          ],
          properties: {
            sectionKey: { type: "string" },
            whatWentWell: { anyOf: [{ type: "string" }, { type: "null" }] },
            needsImprovement: { anyOf: [{ type: "string" }, { type: "null" }] },
            clinicalImportance: { anyOf: [{ type: "string" }, { type: "null" }] },
            nextCaseFocus: { anyOf: [{ type: "string" }, { type: "null" }] },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
            imageLimitations: { anyOf: [{ type: "string" }, { type: "null" }] },
          },
        },
      },
      safetyNotes: { type: "array", items: { type: "string" } },
    },
  },
} as const;
