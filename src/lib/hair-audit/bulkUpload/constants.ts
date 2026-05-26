export const BULK_IMAGE_CATEGORIES = [
  { value: "pre_op_front", label: "Pre-op front" },
  { value: "pre_op_temples", label: "Pre-op temples" },
  { value: "pre_op_crown", label: "Pre-op crown" },
  { value: "donor_before", label: "Donor before" },
  { value: "donor_extraction", label: "Donor extraction" },
  { value: "donor_after", label: "Donor after" },
  { value: "recipient_placement", label: "Recipient placement" },
  { value: "immediate_post_op", label: "Immediate post-op" },
  { value: "result_front", label: "Result front" },
  { value: "result_temples", label: "Result temples" },
  { value: "result_crown", label: "Result crown" },
  { value: "equipment", label: "Equipment" },
  { value: "punch_photo", label: "Punch photo" },
  { value: "other", label: "Other" },
] as const;

export type BulkImageCategory = (typeof BULK_IMAGE_CATEGORIES)[number]["value"];

export const BULK_IMAGE_CATEGORY_SET = new Set<string>(BULK_IMAGE_CATEGORIES.map((c) => c.value));

export const BULK_INTAKE_STATUSES = ["draft", "incomplete", "ready_for_audit"] as const;
export type BulkIntakeStatus = (typeof BULK_INTAKE_STATUSES)[number];

export const BULK_BATCH_STATUSES = ["draft", "in_progress", "ready_for_review", "archived"] as const;
export type BulkBatchStatus = (typeof BULK_BATCH_STATUSES)[number];

/** Map bulk categories to doctor audit photo keys when syncing to uploads. */
export const BULK_TO_DOCTOR_PHOTO_KEY: Partial<Record<BulkImageCategory, string>> = {
  pre_op_front: "img_preop_front",
  pre_op_temples: "img_preop_left",
  pre_op_crown: "img_preop_top",
  donor_before: "img_preop_donor_rear",
  donor_extraction: "img_preop_donor_rear",
  donor_after: "img_immediate_postop_donor",
  recipient_placement: "img_immediate_postop_recipient",
  immediate_post_op: "img_immediate_postop_recipient",
  result_front: "img_preop_front",
  result_temples: "img_preop_left",
  result_crown: "img_preop_top",
  equipment: "img_preop_front",
  punch_photo: "img_preop_donor_rear",
  other: "img_preop_front",
};

export function bulkStoragePath(batchId: string, caseId: string | null, fileName: string) {
  const caseSegment = caseId ?? "unassigned";
  return `cases/bulk/${batchId}/${caseSegment}/${Date.now()}-${fileName}`;
}
