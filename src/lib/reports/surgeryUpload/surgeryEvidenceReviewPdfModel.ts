/**
 * Serializable inputs for the Stage 7B/8 non-AI evidence review PDF (for tests + PDF builder).
 */
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";
import type { SurgerySlotReviewRow } from "@/lib/surgeryUpload/evidenceReview";
import {
  buildEvidenceCompletenessChecklist,
  evidenceCompletenessRatio,
  groupUploadsByEvidenceWorkspaceCategory,
  EVIDENCE_WORKSPACE_CATEGORY_ORDER,
  EVIDENCE_WORKSPACE_CATEGORY_LABEL,
  parseEvidenceWorkspaceFlagsJson,
  type EvidenceCompletenessItem,
  type EvidenceIssueFlagRow,
  type EvidenceWorkspaceCategoryId,
  type EvidenceWorkspaceUploadRow,
} from "@/lib/surgeryUpload/evidenceReviewWorkspace";

export type SurgeryEvidenceReviewPdfInput = {
  caseId: string;
  generatedAtIso: string;
  requestedByDisplay: string;
  details: SurgeryUploadDetails;
  uploads: ReadonlyArray<EvidenceWorkspaceUploadRow>;
  slotReviews: ReadonlyArray<SurgerySlotReviewRow>;
  workspaceNotes: string | null;
  workspaceFlags: EvidenceIssueFlagRow[];
  completenessChecklist: EvidenceCompletenessItem[];
  completenessRatio: { met: number; total: number };
  groupedEvidenceCounts: Array<{
    categoryId: EvidenceWorkspaceCategoryId;
    label: string;
    count: number;
    sampleTypes: string[];
  }>;
};

export function buildSurgeryEvidenceReviewPdfInput(args: {
  caseId: string;
  generatedAtIso: string;
  requestedByDisplay: string;
  details: SurgeryUploadDetails;
  uploads: ReadonlyArray<EvidenceWorkspaceUploadRow>;
  slotReviews: ReadonlyArray<SurgerySlotReviewRow>;
}): SurgeryEvidenceReviewPdfInput {
  const checklist = buildEvidenceCompletenessChecklist(args.details, args.uploads);
  const ratio = evidenceCompletenessRatio(checklist);
  const grouped = groupUploadsByEvidenceWorkspaceCategory(args.uploads);
  const groupedEvidenceCounts = EVIDENCE_WORKSPACE_CATEGORY_ORDER.map((categoryId) => {
    const list = grouped[categoryId];
    const sampleTypes = [...new Set(list.map((u) => u.type))].slice(0, 8);
    return {
      categoryId,
      label: EVIDENCE_WORKSPACE_CATEGORY_LABEL[categoryId],
      count: list.length,
      sampleTypes,
    };
  }).filter((g) => g.count > 0);

  const workspaceFlags = parseEvidenceWorkspaceFlagsJson(args.details.evidence_review_workspace_flags);

  return {
    caseId: args.caseId,
    generatedAtIso: args.generatedAtIso,
    requestedByDisplay: args.requestedByDisplay,
    details: args.details,
    uploads: args.uploads,
    slotReviews: args.slotReviews,
    workspaceNotes: args.details.evidence_review_workspace_notes ?? null,
    workspaceFlags,
    completenessChecklist: checklist,
    completenessRatio: ratio,
    groupedEvidenceCounts,
  };
}
