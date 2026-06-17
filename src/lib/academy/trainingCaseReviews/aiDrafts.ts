import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ACADEMY_REQUIRED_PHOTO_CATEGORIES,
  type AcademyPhotoCategory,
} from "../constants";
import { parseTrainingPhotoType } from "../photoCategories";
import { isActiveTrainingCase } from "../trainingCases";
import { isActiveTrainingCaseUpload } from "../trainingCaseUploads";
import type { TrainingCaseUploadRow } from "../types";
import { buildFailedFeedback } from "./aiDraftValidation";
import type { TrainingCaseAiPromptContext } from "./aiDraftPrompt";
import {
  AI_REVIEW_IMAGE_LIMITATION_COPY,
  type GenerateTrainingCaseAiReviewDraftResult,
  type MappedAiSectionSuggestion,
  type TrainingCaseAiReviewDraftRow,
  type TrainingCaseAiReviewDraftStatus,
  type TrainingCaseAiReviewStructuredFeedback,
} from "./aiDraftTypes";
import { TRAINING_CASE_REVIEW_SECTIONS } from "./reviewSections";
import type { TrainingCaseReviewSectionInput } from "./types";
import {
  getTrainingCaseAiReviewProviderConfig,
  isTrainingCaseAiReviewConfigured,
  runTrainingCaseAiReviewProvider,
  type TrainingCaseAiReviewImageInput,
} from "./trainingCaseAiReviewProvider";
import { normalizeStructuredFeedbackFromRaw } from "./aiDraftValidation";
import { getCaseFilesBucketNameForReadOnlyUse } from "@/lib/hairaudit/uploadStorage";

function sectionTitleForKey(key: string): string {
  return TRAINING_CASE_REVIEW_SECTIONS.find((s) => s.key === key)?.title ?? key;
}

export { isTrainingCaseAiReviewConfigured } from "./trainingCaseAiReviewProvider";
export { getTrainingCaseAiReviewProviderConfig } from "./trainingCaseAiReviewProvider";

function computeMissingPhotoCategories(present: Set<AcademyPhotoCategory>): string[] {
  return ACADEMY_REQUIRED_PHOTO_CATEGORIES.filter((c) => !present.has(c));
}

async function signTrainingUploadUrls(
  uploads: TrainingCaseUploadRow[],
  ttlSeconds: number,
): Promise<TrainingCaseAiReviewImageInput[]> {
  const bucket = getCaseFilesBucketNameForReadOnlyUse();
  const admin = createSupabaseAdminClient();
  const config = getTrainingCaseAiReviewProviderConfig();
  const signed: TrainingCaseAiReviewImageInput[] = [];

  for (const u of uploads.slice(0, config.maxImages)) {
    const cat = parseTrainingPhotoType(u.type);
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(u.storage_path, ttlSeconds);
    if (error || !data?.signedUrl) continue;
    signed.push({
      uploadId: u.id,
      category: cat ?? u.type,
      signedUrl: data.signedUrl,
    });
  }
  return signed;
}

export function mapAiDraftToReviewSectionSuggestions(
  draft: TrainingCaseAiReviewDraftRow,
): MappedAiSectionSuggestion[] {
  const structured = normalizeStructuredFeedbackFromRaw(draft.structured_feedback);
  const suggestions = structured.sectionSuggestions ?? [];
  return suggestions.map((s) => {
    const sectionInput: Partial<TrainingCaseReviewSectionInput> = {
      section_key: s.sectionKey,
      what_went_well: s.whatWentWell ?? null,
      needs_improvement: s.needsImprovement ?? null,
      clinical_importance: s.clinicalImportance ?? null,
      next_case_focus: s.nextCaseFocus ?? null,
    };
    return {
      sectionKey: s.sectionKey,
      sectionTitle: sectionTitleForKey(s.sectionKey),
      suggestion: s,
      sectionInput,
    };
  });
}

export async function listTrainingCaseAiReviewDrafts(
  supabase: SupabaseClient,
  trainingCaseId: string,
  opts?: { reviewId?: string | null; limit?: number },
): Promise<TrainingCaseAiReviewDraftRow[]> {
  let q = supabase
    .from("training_case_ai_review_drafts")
    .select("*")
    .eq("training_case_id", trainingCaseId)
    .order("created_at", { ascending: false });

  if (opts?.reviewId) {
    q = q.eq("training_case_review_id", opts.reviewId);
  }
  if (opts?.limit) {
    q = q.limit(opts.limit);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TrainingCaseAiReviewDraftRow[];
}

export async function getLatestTrainingCaseAiReviewDraft(
  supabase: SupabaseClient,
  trainingCaseId: string,
  reviewId?: string | null,
): Promise<TrainingCaseAiReviewDraftRow | null> {
  const rows = await listTrainingCaseAiReviewDrafts(supabase, trainingCaseId, {
    reviewId: reviewId ?? undefined,
    limit: 1,
  });
  return rows[0] ?? null;
}

function draftRowFromProviderResult(
  params: {
    trainingCaseId: string;
    trainingCaseReviewId: string | null;
    requestedBy: string;
    imageCount: number;
    missingPhotoCategories: string[];
  },
  provider: Awaited<ReturnType<typeof runTrainingCaseAiReviewProvider>>,
): {
  status: TrainingCaseAiReviewDraftStatus;
  ai_model: string | null;
  overall_summary: string | null;
  strengths: string[];
  improvement_areas: string[];
  suggested_next_focus: string | null;
  structured_feedback: TrainingCaseAiReviewStructuredFeedback;
  safety_notes: string[];
  error_message: string | null;
  missing_categories: string[];
  staffMessage: string;
} {
  const baseMissing = params.missingPhotoCategories;

  if (provider.outcome === "not_configured") {
    return {
      status: "completed",
      ai_model: null,
      overall_summary: provider.feedback.overallSummary ?? null,
      strengths: provider.feedback.strengths ?? [],
      improvement_areas: provider.feedback.improvementAreas ?? [],
      suggested_next_focus: provider.feedback.suggestedNextFocus ?? null,
      structured_feedback: provider.feedback,
      safety_notes: provider.feedback.safetyNotes ?? [AI_REVIEW_IMAGE_LIMITATION_COPY],
      error_message: provider.staffMessage,
      missing_categories: provider.feedback.missingCategories ?? baseMissing,
      staffMessage: provider.staffMessage,
    };
  }

  if (provider.outcome === "provider_error") {
    const failedFeedback = buildFailedFeedback(provider.staffMessage, [provider.errorCode], baseMissing);
    return {
      status: "failed",
      ai_model: provider.model,
      overall_summary: provider.staffMessage,
      strengths: [],
      improvement_areas: [],
      suggested_next_focus: null,
      structured_feedback: failedFeedback,
      safety_notes: failedFeedback.safetyNotes ?? [AI_REVIEW_IMAGE_LIMITATION_COPY],
      error_message: provider.staffMessage,
      missing_categories: baseMissing,
      staffMessage: provider.staffMessage,
    };
  }

  if (provider.outcome === "validation_failed") {
    const failedFeedback = buildFailedFeedback(
      provider.staffMessage,
      provider.validationErrors,
      provider.rawFeedback.missingCategories ?? baseMissing,
    );
    return {
      status: "failed",
      ai_model: provider.model,
      overall_summary: provider.staffMessage,
      strengths: [],
      improvement_areas: [],
      suggested_next_focus: null,
      structured_feedback: failedFeedback,
      safety_notes: failedFeedback.safetyNotes ?? [AI_REVIEW_IMAGE_LIMITATION_COPY],
      error_message: provider.staffMessage,
      missing_categories: provider.rawFeedback.missingCategories ?? baseMissing,
      staffMessage: provider.staffMessage,
    };
  }

  const fb = provider.feedback;
  return {
    status: "completed",
    ai_model: provider.model,
    overall_summary: fb.overallSummary ?? null,
    strengths: fb.strengths ?? [],
    improvement_areas: fb.improvementAreas ?? [],
    suggested_next_focus: fb.suggestedNextFocus ?? null,
    structured_feedback: fb,
    safety_notes: fb.safetyNotes ?? [AI_REVIEW_IMAGE_LIMITATION_COPY],
    error_message: null,
    missing_categories: fb.missingCategories ?? baseMissing,
    staffMessage:
      "AI draft generated. Review and edit all suggestions before submitting feedback to the trainee.",
  };
}

export async function generateTrainingCaseAiReviewDraft(
  supabase: SupabaseClient,
  params: {
    trainingCaseId: string;
    trainingCaseReviewId?: string | null;
    requestedBy: string;
  },
): Promise<GenerateTrainingCaseAiReviewDraftResult> {
  const { data: caseRow, error: caseErr } = await supabase
    .from("training_cases")
    .select("id, procedure_type, surgery_date, training_doctor_id, deleted_at, status, trainee_roles_json")
    .eq("id", params.trainingCaseId)
    .maybeSingle();

  if (caseErr || !caseRow || !isActiveTrainingCase(caseRow)) {
    throw new Error("Case not found or not active");
  }

  const { data: doctor } = await supabase
    .from("training_doctors")
    .select("current_stage")
    .eq("id", caseRow.training_doctor_id)
    .maybeSingle();

  const { data: uploadsRaw } = await supabase
    .from("training_case_uploads")
    .select("*")
    .eq("training_case_id", params.trainingCaseId)
    .order("created_at", { ascending: true });

  const uploads = ((uploadsRaw ?? []) as TrainingCaseUploadRow[]).filter(isActiveTrainingCaseUpload);
  const presentCategories = new Set<AcademyPhotoCategory>();
  for (const u of uploads) {
    const cat = parseTrainingPhotoType(u.type);
    if (cat) presentCategories.add(cat);
  }

  const missingPhotoCategories = computeMissingPhotoCategories(presentCategories);
  const roles = (caseRow.trainee_roles_json ?? {}) as Record<string, unknown>;
  const traineeWeek =
    typeof roles.training_week === "string"
      ? roles.training_week
      : typeof roles.week === "string"
        ? roles.week
        : roles.week != null
          ? String(roles.week)
          : null;

  const promptContext: TrainingCaseAiPromptContext = {
    caseType: caseRow.procedure_type ?? null,
    caseDate: caseRow.surgery_date ?? null,
    traineeStage: doctor?.current_stage ?? null,
    traineeWeek,
    presentPhotoCategories: [...presentCategories],
    missingPhotoCategories,
    imageCount: uploads.length,
  };

  const config = getTrainingCaseAiReviewProviderConfig();
  const signedImages = await signTrainingUploadUrls(uploads, config.signedUrlTtlSeconds);

  const providerResult = await runTrainingCaseAiReviewProvider({
    trainingCaseId: params.trainingCaseId,
    promptContext,
    images: signedImages,
  });

  const mapped = draftRowFromProviderResult(
    {
      trainingCaseId: params.trainingCaseId,
      trainingCaseReviewId: params.trainingCaseReviewId ?? null,
      requestedBy: params.requestedBy,
      imageCount: uploads.length,
      missingPhotoCategories,
    },
    providerResult,
  );

  const row = {
    training_case_id: params.trainingCaseId,
    training_case_review_id: params.trainingCaseReviewId ?? null,
    requested_by: params.requestedBy,
    ai_model: mapped.ai_model,
    status: mapped.status,
    image_count: uploads.length,
    missing_categories: mapped.missing_categories,
    overall_summary: mapped.overall_summary,
    strengths: mapped.strengths,
    improvement_areas: mapped.improvement_areas,
    suggested_next_focus: mapped.suggested_next_focus,
    structured_feedback: mapped.structured_feedback,
    safety_notes: mapped.safety_notes,
    error_message: mapped.error_message,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("training_case_ai_review_drafts")
    .insert(row)
    .select("*")
    .single();

  if (insErr || !inserted) throw insErr ?? new Error("Failed to store AI draft");

  return {
    draft: inserted as TrainingCaseAiReviewDraftRow,
    staffMessage: mapped.staffMessage,
  };
}
