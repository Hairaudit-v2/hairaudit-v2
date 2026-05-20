import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTrainingPhotoType } from "../photoCategories";
import { defaultSectionRows } from "./reviewSections";
import type {
  TrainingCaseReviewBundle,
  TrainingCaseReviewImageInput,
  TrainingCaseReviewRow,
  TrainingCaseReviewSectionInput,
  TrainingCaseReviewUpsertBody,
} from "./types";

export async function fetchTrainingCaseReviewsForCase(
  supabase: SupabaseClient,
  caseId: string,
): Promise<TrainingCaseReviewRow[]> {
  const { data, error } = await supabase
    .from("training_case_reviews")
    .select("*")
    .eq("training_case_id", caseId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TrainingCaseReviewRow[];
}

export async function fetchLatestSubmittedReviewForTrainee(
  supabase: SupabaseClient,
  traineeId: string,
): Promise<TrainingCaseReviewRow | null> {
  const { data, error } = await supabase
    .from("training_case_reviews")
    .select("*")
    .eq("trainee_id", traineeId)
    .eq("review_status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as TrainingCaseReviewRow | null) ?? null;
}

export async function fetchTrainingCaseReviewBundle(
  supabase: SupabaseClient,
  reviewId: string,
): Promise<TrainingCaseReviewBundle | null> {
  const [{ data: review, error: rErr }, { data: sections, error: sErr }, { data: images, error: iErr }] =
    await Promise.all([
      supabase.from("training_case_reviews").select("*").eq("id", reviewId).maybeSingle(),
      supabase
        .from("training_case_review_sections")
        .select("*")
        .eq("review_id", reviewId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("training_case_review_images")
        .select("*")
        .eq("review_id", reviewId)
        .order("sort_order", { ascending: true }),
    ]);
  if (rErr) throw rErr;
  if (sErr) throw sErr;
  if (iErr) throw iErr;
  if (!review) return null;
  return {
    review: review as TrainingCaseReviewRow,
    sections: (sections ?? []) as TrainingCaseReviewBundle["sections"],
    images: (images ?? []) as TrainingCaseReviewBundle["images"],
  };
}

export async function fetchTrainingCaseReviewsList(
  supabase: SupabaseClient,
  opts?: { traineeId?: string; status?: string; limit?: number },
): Promise<TrainingCaseReviewRow[]> {
  let q = supabase.from("training_case_reviews").select("*").order("updated_at", { ascending: false });
  if (opts?.traineeId) q = q.eq("trainee_id", opts.traineeId);
  if (opts?.status) q = q.eq("review_status", opts.status);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TrainingCaseReviewRow[];
}

type CreateReviewArgs = {
  trainingCaseId: string;
  traineeId: string;
  reviewerId: string;
  programId?: string | null;
  cohortId?: string | null;
  caseDate?: string | null;
  caseType?: string | null;
  traineeStage?: string | null;
};

export async function createDraftTrainingCaseReview(
  supabase: SupabaseClient,
  args: CreateReviewArgs,
): Promise<TrainingCaseReviewRow> {
  const { data: review, error } = await supabase
    .from("training_case_reviews")
    .insert({
      training_case_id: args.trainingCaseId,
      trainee_id: args.traineeId,
      reviewer_id: args.reviewerId,
      program_id: args.programId ?? null,
      cohort_id: args.cohortId ?? null,
      case_date: args.caseDate ?? null,
      case_type: args.caseType ?? null,
      trainee_stage: args.traineeStage ?? null,
      review_status: "draft",
    })
    .select("*")
    .single();
  if (error) throw error;

  const sectionRows = defaultSectionRows(review.id);
  const { error: secErr } = await supabase.from("training_case_review_sections").insert(sectionRows);
  if (secErr) throw secErr;

  return review as TrainingCaseReviewRow;
}

function sanitizeSectionInput(s: TrainingCaseReviewSectionInput) {
  return {
    developmental_level: s.developmental_level?.trim() || null,
    what_went_well: s.what_went_well?.trim() || null,
    needs_improvement: s.needs_improvement?.trim() || null,
    clinical_importance: s.clinical_importance?.trim() || null,
    next_case_focus: s.next_case_focus?.trim() || null,
    faculty_note: s.faculty_note?.trim() || null,
  };
}

export async function updateTrainingCaseReviewDraft(
  supabase: SupabaseClient,
  reviewId: string,
  body: TrainingCaseReviewUpsertBody,
): Promise<TrainingCaseReviewRow> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.case_date !== undefined) patch.case_date = body.case_date;
  if (body.case_type !== undefined) patch.case_type = body.case_type?.trim() || null;
  if (body.case_difficulty !== undefined) patch.case_difficulty = body.case_difficulty?.trim() || null;
  if (body.trainee_stage !== undefined) patch.trainee_stage = body.trainee_stage?.trim() || null;
  if (body.overall_level !== undefined) patch.overall_level = body.overall_level?.trim() || null;
  if (body.summary !== undefined) patch.summary = body.summary?.trim() || null;
  if (body.main_strengths !== undefined) patch.main_strengths = body.main_strengths;
  if (body.improvement_priorities !== undefined) patch.improvement_priorities = body.improvement_priorities;
  if (body.recommended_next_focus !== undefined) patch.recommended_next_focus = body.recommended_next_focus?.trim() || null;
  if (body.faculty_recommendation !== undefined) patch.faculty_recommendation = body.faculty_recommendation?.trim() || null;

  const { data: review, error } = await supabase
    .from("training_case_reviews")
    .update(patch)
    .eq("id", reviewId)
    .eq("review_status", "draft")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!review) throw new Error("Review not found or not editable (must be draft)");

  if (body.sections?.length) {
    for (const s of body.sections) {
      const { error: secErr } = await supabase
        .from("training_case_review_sections")
        .update(sanitizeSectionInput(s))
        .eq("review_id", reviewId)
        .eq("section_key", s.section_key);
      if (secErr) throw secErr;
    }
  }

  if (body.images) {
    await syncReviewImages(supabase, reviewId, body.images);
  }

  return review as TrainingCaseReviewRow;
}

async function syncReviewImages(
  supabase: SupabaseClient,
  reviewId: string,
  images: TrainingCaseReviewImageInput[],
) {
  const { data: existing, error: exErr } = await supabase
    .from("training_case_review_images")
    .select("id")
    .eq("review_id", reviewId);
  if (exErr) throw exErr;

  const keepIds = new Set(images.map((i) => i.id).filter(Boolean) as string[]);
  const toDelete = (existing ?? []).filter((e) => !keepIds.has(e.id)).map((e) => e.id);
  if (toDelete.length) {
    const { error: delErr } = await supabase.from("training_case_review_images").delete().in("id", toDelete);
    if (delErr) throw delErr;
  }

  for (let i = 0; i < images.length; i++) {
    const img = images[i]!;
    const row = {
      review_id: reviewId,
      image_id: img.image_id ?? null,
      image_category: img.image_category,
      reviewer_comment: img.reviewer_comment?.trim() || null,
      image_quality_level: img.image_quality_level?.trim() || null,
      sort_order: img.sort_order ?? i,
    };
    if (img.id) {
      const { error } = await supabase.from("training_case_review_images").update(row).eq("id", img.id);
      if (error) throw error;
    } else if (img.image_id || img.reviewer_comment) {
      const { error } = await supabase.from("training_case_review_images").insert(row);
      if (error) throw error;
    }
  }
}

export async function submitTrainingCaseReview(
  supabase: SupabaseClient,
  reviewId: string,
): Promise<TrainingCaseReviewRow> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("training_case_reviews")
    .update({ review_status: "submitted", submitted_at: now, updated_at: now })
    .eq("id", reviewId)
    .eq("review_status", "draft")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Review not found or already submitted");
  return data as TrainingCaseReviewRow;
}

/** Suggest upload rows for each review image category based on existing case uploads. */
export function mapUploadsToReviewCategories(
  uploads: { id: string; type: string }[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const u of uploads) {
    const cat = parseTrainingPhotoType(u.type);
    if (!cat) continue;
    if (!out.has(cat)) out.set(cat, u.id);
  }
  return out;
}

/**
 * Placeholder for future AI-assisted review drafting.
 * No image analysis is performed — faculty enter feedback manually.
 */
export async function suggestTrainingCaseReviewDraft(_caseId?: string): Promise<{ available: false; reason: string }> {
  void _caseId;
  return {
    available: false,
    reason: "AI-assisted review drafting is not enabled. Faculty should enter feedback manually.",
  };
}
