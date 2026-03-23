/**
 * Evidence Intelligence: map case photos to abstract evidence keys and score metric coverage.
 * Works with existing `patient_photo:{key}`, `doctor_photo:img_*`, `clinic_photo:img_*` uploads.
 */

import { parsePhotoKey } from "@/lib/auditPhotoSchemas";
import {
  EVIDENCE_REQUIREMENTS,
  minRequiredForMetric,
  type EvidenceRequirementKey,
  type SurgicalMetricId,
} from "./evidenceRequirements";

/** Upload / audit row shape compatible with parsePhotoKey. */
export type CasePhotoInput = {
  type?: string | null;
  photo_key?: string | null;
  submitter_type?: string | null;
  metadata?: { category?: string | null } | null;
};

/**
 * Normalized storage key: patient category slug, or doctor/clinic `img_*` key.
 */
function normalizedPhotoKey(photo: CasePhotoInput): string | null {
  const parsed = parsePhotoKey(photo as Parameters<typeof parsePhotoKey>[0]);
  if (parsed?.key) {
    return String(parsed.key).trim().toLowerCase();
  }
  const meta = String(photo.metadata?.category ?? "").trim().toLowerCase();
  if (meta) return meta;
  return null;
}

/**
 * Maps existing photo category keys (after parsePhotoKey / metadata.category) to abstract evidence keys.
 * Multiple evidence keys may be satisfied by one photo (e.g. broad day-0 recipient views).
 */
const PHOTO_KEY_TO_EVIDENCE_KEYS: Readonly<Record<string, readonly EvidenceRequirementKey[]>> = {
  // Recipient / implant context (patient + doctor)
  day0_recipient: ["recipient_day0_macro"],
  postop_day0: ["recipient_day0_macro"],
  any_day0: ["recipient_day0_macro"],
  img_immediate_postop_recipient: ["recipient_day0_macro"],
  intraop_recipient_sites: ["recipient_day0_macro", "recipient_day0_angle"],
  img_site_creation: ["recipient_day0_macro"],
  img_implantation_stage: ["recipient_day0_macro"],
  postop_day1_recipient: ["recipient_mid_range"],
  postop_week1_recipient: ["recipient_mid_range"],
  // Angled / lateral recipient & hairline
  preop_left: ["recipient_day0_angle", "hairline_oblique"],
  preop_right: ["recipient_day0_angle", "hairline_oblique"],
  day0_donor_left: ["recipient_day0_angle"],
  day0_donor_right: ["recipient_day0_angle"],
  img_preop_left: ["hairline_oblique"],
  img_preop_right: ["hairline_oblique"],
  // Hairline naturalness
  preop_front: ["hairline_frontal_macro"],
  img_preop_front: ["hairline_frontal_macro"],
  patient_current_front: ["hairline_frontal_macro"],
  // Transection / extraction / graft inspection
  intraop_extraction: ["extraction_phase_closeup"],
  intraop_donor_closeup: ["extraction_phase_closeup"],
  img_intraop_extraction: ["extraction_phase_closeup"],
  img_graft_inspection: ["graft_macro", "extraction_phase_closeup"],
  img_graft_microscopy: ["graft_macro"],
  // Donor quality
  preop_donor_rear: ["donor_preop"],
  preop_donor_closeup: ["donor_preop"],
  img_preop_donor_rear: ["donor_preop"],
  img_preop_donor_sides: ["donor_preop"],
  day0_donor_rear: ["donor_shaved_macro"],
  day0_donor_closeup: ["donor_shaved_macro"],
  img_immediate_postop_donor: ["donor_shaved_macro", "donor_postop_shaved"],
  // Donor scar / healed
  postop_day1_donor: ["donor_postop_shaved"],
  postop_week1_donor: ["donor_healed"],
  postop_month3_donor: ["donor_healed"],
  postop_month6_donor: ["donor_healed"],
  postop_month9_donor: ["donor_healed"],
  postop_month12_donor: ["donor_healed"],
  img_followup_donor: ["donor_healed"],
  // Graft handling (patient category keys match evidence keys)
  graft_tray_overview: ["graft_tray_overview"],
  graft_tray_closeup: ["graft_tray_closeup"],
  img_graft_tray_overview: ["graft_tray_overview"],
  img_graft_tray_closeup: ["graft_tray_closeup"],
};

/**
 * Returns unique evidence requirement keys satisfied by the given case photos.
 */
export function mapPhotosToEvidenceKeys(photos: readonly CasePhotoInput[]): Set<EvidenceRequirementKey> {
  const out = new Set<EvidenceRequirementKey>();
  for (const p of photos) {
    const nk = normalizedPhotoKey(p);
    if (!nk) continue;
    const keys = PHOTO_KEY_TO_EVIDENCE_KEYS[nk];
    if (!keys) continue;
    for (const k of keys) out.add(k);
  }
  return out;
}

/** Storage / category keys (patient slug or `img_*`) that can satisfy a given evidence requirement. */
export function photoKeysSatisfyingEvidenceRequirement(ek: EvidenceRequirementKey): string[] {
  const acc: string[] = [];
  for (const [photoKey, evs] of Object.entries(PHOTO_KEY_TO_EVIDENCE_KEYS)) {
    if ((evs as readonly EvidenceRequirementKey[]).includes(ek)) acc.push(photoKey);
  }
  return acc;
}

export type MetricCoverageEntry = {
  provided: number;
  required: number;
  missing: EvidenceRequirementKey[];
  coverageScore: number;
  status: "complete" | "partial" | "insufficient";
};

export type EvidenceEvaluationResult = {
  metricCoverage: Record<SurgicalMetricId, MetricCoverageEntry>;
  overallCoverageScore: number;
};

/**
 * Evaluate how well case photos cover each surgical metric's evidence requirements.
 */
export function evaluateEvidence(casePhotos: readonly CasePhotoInput[]): EvidenceEvaluationResult {
  const satisfied = mapPhotosToEvidenceKeys(casePhotos);
  const metricCoverage = {} as Record<SurgicalMetricId, MetricCoverageEntry>;
  const scores: number[] = [];

  for (const metricId of Object.keys(EVIDENCE_REQUIREMENTS) as SurgicalMetricId[]) {
    const def = EVIDENCE_REQUIREMENTS[metricId];
    const requiredKeys = [...def.required];
    const minReq = minRequiredForMetric(def);
    const missing = requiredKeys.filter((k) => !satisfied.has(k));
    const provided = requiredKeys.length - missing.length;

    const denom = Math.max(requiredKeys.length, minReq, 1);
    const coverageScore = Math.min(100, Math.round((provided / denom) * 100));
    scores.push(coverageScore);

    let status: MetricCoverageEntry["status"];
    if (provided >= minReq && missing.length === 0) {
      status = "complete";
    } else if (provided > 0) {
      status = "partial";
    } else {
      status = "insufficient";
    }

    metricCoverage[metricId] = {
      provided,
      required: minReq,
      missing,
      coverageScore,
      status,
    };
  }

  const overallCoverageScore =
    scores.length === 0 ? 0 : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return { metricCoverage, overallCoverageScore };
}
