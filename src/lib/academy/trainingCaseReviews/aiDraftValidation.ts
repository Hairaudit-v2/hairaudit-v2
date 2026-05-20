import {
  AI_REVIEW_IMAGE_LIMITATION_COPY,
  type AiReviewConfidence,
  type AiReviewSectionSuggestion,
  type TrainingCaseAiReviewStructuredFeedback,
} from "./aiDraftTypes";
import { TRAINING_CASE_REVIEW_SECTIONS } from "./reviewSections";

const VALID_SECTION_KEYS = new Set(TRAINING_CASE_REVIEW_SECTIONS.map((s) => s.key));
const VALID_CONFIDENCE = new Set<AiReviewConfidence>(["low", "medium", "high"]);

const FACULTY_CONFIRMATION_NOTE = "Faculty confirmation required before any feedback is released to the trainee.";

/** Phrases the model must not use in training coaching drafts */
const FORBIDDEN_PHRASE_PATTERNS: RegExp[] = [
  /\bpassed\b/i,
  /\bfailed\b/i,
  /\bpass\/fail\b/i,
  /\bmalpractice\b/i,
  /\bfraud\b/i,
  /\bnegligen(ce|t)\b/i,
  /\bunsafe\s+surgeon\b/i,
  /\bsurgeon\s+is\s+(not\s+)?safe\b/i,
  /\bguarantee(d)?\s+(outcome|result|growth)\b/i,
  /\bdefinitive\s+diagnosis\b/i,
  /\bcertif(y|ied)\s+competent\b/i,
  /\bcompetency\s+(signed\s+off|achieved)\b/i,
];

export type AiDraftValidationResult =
  | { ok: true; feedback: TrainingCaseAiReviewStructuredFeedback }
  | { ok: false; errors: string[]; partial?: TrainingCaseAiReviewStructuredFeedback };

function uniqStrings(xs: string[]): string[] {
  return Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean)));
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function collectTextFields(feedback: TrainingCaseAiReviewStructuredFeedback): string[] {
  const texts: string[] = [];
  if (feedback.overallSummary) texts.push(feedback.overallSummary);
  if (feedback.suggestedNextFocus) texts.push(feedback.suggestedNextFocus);
  for (const n of feedback.imageQualityNotes ?? []) texts.push(n);
  for (const n of feedback.strengths ?? []) texts.push(n);
  for (const n of feedback.improvementAreas ?? []) texts.push(n);
  for (const n of feedback.safetyNotes ?? []) texts.push(n);
  for (const s of feedback.sectionSuggestions ?? []) {
    if (s.whatWentWell) texts.push(s.whatWentWell);
    if (s.needsImprovement) texts.push(s.needsImprovement);
    if (s.clinicalImportance) texts.push(s.clinicalImportance);
    if (s.nextCaseFocus) texts.push(s.nextCaseFocus);
    if (s.imageLimitations) texts.push(s.imageLimitations);
  }
  return texts;
}

export function detectForbiddenPhrases(texts: string[]): string[] {
  const hits: string[] = [];
  for (const text of texts) {
    for (const re of FORBIDDEN_PHRASE_PATTERNS) {
      if (re.test(text)) {
        hits.push(`Forbidden phrasing detected: ${re.source}`);
        break;
      }
    }
  }
  return uniqStrings(hits);
}

export function normalizeAiReviewSectionSuggestion(raw: unknown): AiReviewSectionSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sectionKey = typeof o.sectionKey === "string" ? o.sectionKey.trim() : "";
  if (!VALID_SECTION_KEYS.has(sectionKey)) return null;

  const confidenceRaw = typeof o.confidence === "string" ? o.confidence.trim().toLowerCase() : "low";
  const confidence = VALID_CONFIDENCE.has(confidenceRaw as AiReviewConfidence)
    ? (confidenceRaw as AiReviewConfidence)
    : "low";

  const strOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  return {
    sectionKey,
    whatWentWell: strOrNull(o.whatWentWell),
    needsImprovement: strOrNull(o.needsImprovement),
    clinicalImportance: strOrNull(o.clinicalImportance),
    nextCaseFocus: strOrNull(o.nextCaseFocus),
    confidence,
    imageLimitations: strOrNull(o.imageLimitations),
  };
}

export function normalizeStructuredFeedbackFromRaw(raw: unknown): TrainingCaseAiReviewStructuredFeedback {
  if (!raw || typeof raw !== "object") {
    return {
      placeholder: true,
      safetyNotes: [AI_REVIEW_IMAGE_LIMITATION_COPY, FACULTY_CONFIRMATION_NOTE],
    };
  }
  const o = raw as Record<string, unknown>;
  const sectionSuggestions = Array.isArray(o.sectionSuggestions)
    ? o.sectionSuggestions
        .map(normalizeAiReviewSectionSuggestion)
        .filter((s): s is AiReviewSectionSuggestion => s != null)
    : [];

  const safetyNotes = uniqStrings([
    ...stringArray(o.safetyNotes),
    AI_REVIEW_IMAGE_LIMITATION_COPY,
    FACULTY_CONFIRMATION_NOTE,
  ]);

  return {
    overallSummary: typeof o.overallSummary === "string" ? o.overallSummary.trim() : null,
    imageQualityNotes: stringArray(o.imageQualityNotes),
    missingCategories: stringArray(o.missingCategories),
    strengths: stringArray(o.strengths),
    improvementAreas: stringArray(o.improvementAreas),
    suggestedNextFocus: typeof o.suggestedNextFocus === "string" ? o.suggestedNextFocus.trim() : null,
    sectionSuggestions,
    safetyNotes,
    placeholder: Boolean(o.placeholder),
  };
}

export function validateTrainingCaseAiReviewFeedback(
  feedback: TrainingCaseAiReviewStructuredFeedback,
): AiDraftValidationResult {
  const errors: string[] = [];

  if (!feedback.overallSummary?.trim()) {
    errors.push("overallSummary is required and must be non-empty.");
  }

  if (!Array.isArray(feedback.imageQualityNotes)) {
    errors.push("imageQualityNotes must be an array.");
  }

  if (!Array.isArray(feedback.strengths)) {
    errors.push("strengths must be an array.");
  }

  if (!Array.isArray(feedback.improvementAreas)) {
    errors.push("improvementAreas must be an array.");
  }

  if (!feedback.suggestedNextFocus?.trim()) {
    errors.push("suggestedNextFocus is required and must be non-empty.");
  }

  if (!Array.isArray(feedback.sectionSuggestions)) {
    errors.push("sectionSuggestions must be an array.");
  } else {
    for (const s of feedback.sectionSuggestions) {
      if (!VALID_SECTION_KEYS.has(s.sectionKey)) {
        errors.push(`Invalid sectionKey: ${s.sectionKey}`);
      }
      if (!s.confidence || !VALID_CONFIDENCE.has(s.confidence)) {
        errors.push(`Invalid confidence for section ${s.sectionKey}`);
      }
    }
  }

  if (!feedback.safetyNotes?.length) {
    errors.push("safetyNotes must include at least one caution.");
  } else if (!feedback.safetyNotes.some((n) => n.includes("Faculty review is required"))) {
    errors.push("safetyNotes must include faculty review limitation language.");
  }

  const forbidden = detectForbiddenPhrases(collectTextFields(feedback));
  errors.push(...forbidden);

  if (errors.length) {
    return { ok: false, errors, partial: feedback };
  }

  return { ok: true, feedback };
}

export function buildFailedFeedback(
  staffMessage: string,
  validationErrors: string[],
  missingCategories: string[],
): TrainingCaseAiReviewStructuredFeedback {
  return {
    placeholder: false,
    overallSummary: staffMessage,
    imageQualityNotes: [],
    missingCategories,
    strengths: [],
    improvementAreas: [],
    suggestedNextFocus: null,
    sectionSuggestions: [],
    safetyNotes: uniqStrings([
      AI_REVIEW_IMAGE_LIMITATION_COPY,
      FACULTY_CONFIRMATION_NOTE,
      "AI draft could not be applied automatically. Faculty should enter feedback manually.",
      ...validationErrors.slice(0, 3).map((e) => `Validation: ${e}`),
    ]),
    validationErrors,
  };
}
