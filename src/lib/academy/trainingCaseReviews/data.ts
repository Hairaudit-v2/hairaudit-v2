import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveTrainingCase } from "../trainingCases";
import { parseTrainingPhotoType } from "../photoCategories";
import { isTrainingCaseAiReviewConfigured } from "./trainingCaseAiReviewProvider";
import { defaultSectionRows } from "./reviewSections";
import type {
  TrainingCaseReviewBundle,
  TrainingCaseReviewImageInput,
  TrainingCaseReviewRow,
  TrainingCaseReviewSectionInput,
  TrainingCaseReviewUpsertBody,
} from "./types";

export type StaffTrainingCaseReviewWorkload = {
  draftCount: number;
  recentSubmitted: TrainingCaseReviewRow[];
  casesReadyForReview: {
    caseId: string;
    surgeryDate: string;
    traineeName: string;
    uploadCount: number;
  }[];
};

async function fetchActiveCaseIdSet(
  supabase: SupabaseClient,
  caseIds: string[],
): Promise<Set<string>> {
  if (!caseIds.length) return new Set();
  const { data, error } = await supabase.from("training_cases").select("id, deleted_at, status").in("id", caseIds);
  if (error) throw error;
  return new Set((data ?? []).filter(isActiveTrainingCase).map((c) => c.id as string));
}

export async function filterReviewsOnActiveCases(
  supabase: SupabaseClient,
  reviews: TrainingCaseReviewRow[],
): Promise<TrainingCaseReviewRow[]> {
  const caseIds = [...new Set(reviews.map((r) => r.training_case_id).filter(Boolean))] as string[];
  if (!caseIds.length) return reviews;
  const activeIds = await fetchActiveCaseIdSet(supabase, caseIds);
  return reviews.filter((r) => !r.training_case_id || activeIds.has(r.training_case_id));
}

export async function fetchStaffTrainingCaseReviewWorkload(
  supabase: SupabaseClient,
): Promise<StaffTrainingCaseReviewWorkload> {
  const [{ count: draftCount }, { data: recentRaw }, { data: allCases }] = await Promise.all([
    supabase
      .from("training_case_reviews")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "draft"),
    supabase
      .from("training_case_reviews")
      .select("*")
      .eq("review_status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(8),
    supabase.from("training_cases").select("id, surgery_date, training_doctor_id, deleted_at, status"),
  ]);

  const activeCases = (allCases ?? []).filter(isActiveTrainingCase);
  const activeCaseIds = activeCases.map((c) => c.id as string);

  const recentSubmitted = await filterReviewsOnActiveCases(
    supabase,
    (recentRaw ?? []) as TrainingCaseReviewRow[],
  );

  if (!activeCaseIds.length) {
    return { draftCount: draftCount ?? 0, recentSubmitted, casesReadyForReview: [] };
  }

  const [{ data: uploads }, { data: submittedReviews }] = await Promise.all([
    supabase
      .from("training_case_uploads")
      .select("training_case_id, deleted_at")
      .in("training_case_id", activeCaseIds)
      .is("deleted_at", null),
    supabase
      .from("training_case_reviews")
      .select("training_case_id")
      .eq("review_status", "submitted")
      .in("training_case_id", activeCaseIds),
  ]);

  const casesWithUploads = new Set((uploads ?? []).map((u) => u.training_case_id as string));
  const casesWithSubmittedReview = new Set(
    (submittedReviews ?? []).map((r) => r.training_case_id as string).filter(Boolean),
  );

  const readyCaseIds = [...casesWithUploads].filter((id) => !casesWithSubmittedReview.has(id)).slice(0, 12);
  const readyCases = activeCases.filter((c) => readyCaseIds.includes(c.id as string));

  const doctorIds = [...new Set(readyCases.map((c) => c.training_doctor_id as string))];
  const { data: doctors } = doctorIds.length
    ? await supabase.from("training_doctors").select("id, full_name").in("id", doctorIds)
    : { data: [] };
  const doctorById = new Map((doctors ?? []).map((d) => [d.id as string, d.full_name as string]));

  const uploadCountByCase = new Map<string, number>();
  for (const u of uploads ?? []) {
    const id = u.training_case_id as string;
    uploadCountByCase.set(id, (uploadCountByCase.get(id) ?? 0) + 1);
  }

  const casesReadyForReview = readyCases.map((c) => ({
    caseId: c.id as string,
    surgeryDate: c.surgery_date as string,
    traineeName: doctorById.get(c.training_doctor_id as string) ?? "Trainee",
    uploadCount: uploadCountByCase.get(c.id as string) ?? 0,
  }));

  return {
    draftCount: draftCount ?? 0,
    recentSubmitted,
    casesReadyForReview,
  };
}

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
    .limit(10);
  if (error) throw error;
  const filtered = await filterReviewsOnActiveCases(supabase, (data ?? []) as TrainingCaseReviewRow[]);
  return filtered[0] ?? null;
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
  return filterReviewsOnActiveCases(supabase, (data ?? []) as TrainingCaseReviewRow[]);
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
  const { data: existingDraft, error: findErr } = await supabase
    .from("training_case_reviews")
    .select("*")
    .eq("training_case_id", args.trainingCaseId)
    .eq("reviewer_id", args.reviewerId)
    .eq("review_status", "draft")
    .maybeSingle();
  if (findErr) throw findErr;
  if (existingDraft) return existingDraft as TrainingCaseReviewRow;

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

  const review = data as TrainingCaseReviewRow;
  if (review.training_case_id) {
    const { data: caseRow } = await supabase
      .from("training_cases")
      .select("id, status, deleted_at")
      .eq("id", review.training_case_id)
      .maybeSingle();
    if (caseRow && isActiveTrainingCase(caseRow)) {
      await supabase
        .from("training_cases")
        .update({ status: "reviewed", updated_at: now })
        .eq("id", review.training_case_id);
    }
  }

  return review;
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

/** @deprecated Use generateTrainingCaseAiReviewDraft via the AI draft API instead. */
export async function suggestTrainingCaseReviewDraft(caseId?: string): Promise<
  | { available: true; caseId: string }
  | { available: false; reason: string }
> {
  if (!caseId) {
    return {
      available: false,
      reason: "AI-assisted review drafting requires a training case. Use Generate AI draft feedback on the review form.",
    };
  }
  if (!isTrainingCaseAiReviewConfigured()) {
    return {
      available: false,
      reason: "AI review is not configured for this environment. Faculty should enter feedback manually.",
    };
  }
  return { available: true, caseId };
}
