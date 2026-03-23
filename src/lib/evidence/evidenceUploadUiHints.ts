/**
 * Maps evidence gaps to patient upload card keys for UI emphasis (advisory only).
 */

import type { SubmitterType } from "@/lib/auditPhotoSchemas";
import { DOCTOR_PHOTO_SCHEMA } from "@/lib/photoSchemas";
import {
  photoKeysSatisfyingEvidenceRequirement,
  type EvidenceEvaluationResult,
} from "./evidenceEvaluator";
import type { EvidenceRequirementKey } from "./evidenceRequirements";

function distinctMissingEvidenceKeys(result: EvidenceEvaluationResult): EvidenceRequirementKey[] {
  const s = new Set<EvidenceRequirementKey>();
  for (const m of Object.values(result.metricCoverage)) {
    for (const k of m.missing) s.add(k);
  }
  return [...s];
}

/**
 * Patient uploader: core bucket keys + extended `patient_photo:*` keys that best match each gap.
 */
const PATIENT_HIGHLIGHT_BY_EVIDENCE: Partial<Record<EvidenceRequirementKey, readonly string[]>> = {
  recipient_day0_macro: ["any_day0", "day0_recipient", "postop_day0"],
  recipient_day0_angle: ["patient_current_left", "patient_current_right", "preop_left", "preop_right"],
  recipient_mid_range: ["any_early_postop_day0_3", "postop_day1_recipient", "postop_week1_recipient"],
  hairline_frontal_macro: ["patient_current_front", "any_preop", "preop_front"],
  hairline_oblique: ["patient_current_left", "patient_current_right", "preop_left", "preop_right"],
  extraction_phase_closeup: ["intraop_extraction", "intraop_donor_closeup"],
  graft_macro: ["graft_tray_closeup", "graft_tray_overview", "intraop_extraction"],
  donor_preop: ["patient_current_donor_rear", "preop_donor_rear", "preop_donor_closeup"],
  donor_shaved_macro: ["day0_donor_rear", "day0_donor_closeup", "day0_donor"],
  donor_postop_shaved: ["postop_day1_donor"],
  donor_healed: ["postop_week1_donor", "postop_month3_donor", "postop_month6_donor", "postop_month12_donor"],
  graft_tray_overview: ["graft_tray_overview"],
  graft_tray_closeup: ["graft_tray_closeup"],
};

export function getUploadHighlightKeys(
  submitterType: SubmitterType,
  result: EvidenceEvaluationResult
): Set<string> {
  const missing = distinctMissingEvidenceKeys(result);
  const out = new Set<string>();

  if (submitterType === "patient") {
    for (const ek of missing) {
      const hints = PATIENT_HIGHLIGHT_BY_EVIDENCE[ek];
      if (hints?.length) {
        for (const k of hints) out.add(k);
        continue;
      }
      for (const pk of photoKeysSatisfyingEvidenceRequirement(ek)) {
        if (!pk.startsWith("img_")) out.add(pk);
      }
    }
    return out;
  }

  if (submitterType === "doctor" || submitterType === "clinic") {
    const allowed = new Set(DOCTOR_PHOTO_SCHEMA.map((c) => c.key));
    for (const ek of missing) {
      for (const pk of photoKeysSatisfyingEvidenceRequirement(ek)) {
        if (allowed.has(pk)) out.add(pk);
      }
    }
  }

  return out;
}

/** Category keys from a fixed list (e.g. clinic upload page) that match missing evidence. */
export function getHighlightKeysIntersectingCategories(
  result: EvidenceEvaluationResult,
  categoryKeys: readonly string[]
): Set<string> {
  const allowed = new Set(categoryKeys);
  const out = new Set<string>();
  for (const ek of distinctMissingEvidenceKeys(result)) {
    for (const pk of photoKeysSatisfyingEvidenceRequirement(ek)) {
      if (allowed.has(pk)) out.add(pk);
    }
  }
  return out;
}
