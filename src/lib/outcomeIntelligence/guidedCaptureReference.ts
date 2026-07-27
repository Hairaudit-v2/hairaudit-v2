/**
 * FI-OUTCOME-INTELLIGENCE-1E — Reference prior-image resolution for guided capture.
 *
 * Priority (when multiple exist):
 * prior same-stage-family follow-up → surgery-day → preoperative
 *
 * Does not claim registration/calibration. Returns storage paths for signing only.
 */

import type { LongitudinalEvidenceRole, LongitudinalOutcomeStage } from "@/lib/projection/types";
import type { ReferenceImageSource } from "./longitudinalCaptureTypes";

export type ReferenceCandidateUpload = {
  id: string;
  type: string | null;
  storage_path: string | null;
  created_at?: string | null;
};

export type ResolvedReferenceImage = {
  available: true;
  uploadId: string;
  storagePath: string;
  source: ReferenceImageSource;
  label: string;
};

function categoryFromType(type: string | null | undefined): string | null {
  const t = String(type ?? "");
  if (t.startsWith("patient_photo:")) return t.slice("patient_photo:".length);
  if (t.startsWith("doctor_photo:")) return t.slice("doctor_photo:".length);
  if (t.startsWith("clinic_photo:")) return t.slice("clinic_photo:".length);
  if (t.startsWith("surgery_photo:")) return t.slice("surgery_photo:".length);
  return t || null;
}

/** Categories that can act as visual references for a follow-up role. */
const ROLE_REFERENCE_CATEGORIES: Readonly<
  Record<
    LongitudinalEvidenceRole,
    {
      prior_followup: string[];
      surgery_day: string[];
      preoperative: string[];
    }
  >
> = {
  followup_front: {
    prior_followup: [
      "postop_month12_front",
      "postop_month9_front",
      "postop_month6_front",
      "postop_month3_front",
      "patient_current_front",
    ],
    surgery_day: ["day0_recipient", "img_immediate_postop_recipient"],
    preoperative: ["preop_front", "preop_hairline_closeup"],
  },
  followup_top: {
    prior_followup: [
      "postop_month12_top",
      "postop_month9_top",
      "postop_month6_top",
      "postop_month3_top",
      "patient_current_top",
    ],
    surgery_day: ["day0_recipient"],
    preoperative: ["preop_top", "preop_wet_top"],
  },
  followup_crown: {
    prior_followup: [
      "postop_month12_crown",
      "postop_month9_crown",
      "postop_month6_crown",
      "postop_month3_crown",
    ],
    surgery_day: ["day0_recipient"],
    preoperative: ["preop_crown"],
  },
  followup_left: {
    prior_followup: ["patient_current_left"],
    surgery_day: ["day0_donor_left"],
    preoperative: ["preop_left", "preop_donor_left"],
  },
  followup_right: {
    prior_followup: ["patient_current_right"],
    surgery_day: ["day0_donor_right"],
    preoperative: ["preop_right", "preop_donor_right"],
  },
  followup_recipient_closeup: {
    prior_followup: ["current_recipient_closeup", "postop_wet_recipient"],
    surgery_day: ["day0_recipient"],
    preoperative: ["preop_hairline_closeup"],
  },
  followup_donor_rear: {
    prior_followup: [
      "postop_month12_donor",
      "postop_month9_donor",
      "postop_month6_donor",
      "postop_month3_donor",
      "patient_current_donor_rear",
    ],
    surgery_day: ["day0_donor", "day0_donor_rear"],
    preoperative: ["preop_donor_rear"],
  },
  followup_donor_closeup: {
    prior_followup: ["preop_donor_closeup"],
    surgery_day: ["day0_donor_closeup"],
    preoperative: ["preop_donor_closeup"],
  },
};

const SOURCE_LABEL: Record<ReferenceImageSource, string> = {
  prior_followup: "Your earlier follow-up photo",
  surgery_day: "Your surgery-day photo",
  preoperative: "Your before-surgery photo",
};

function stagePrefix(stage: LongitudinalOutcomeStage): string {
  switch (stage) {
    case "month_3":
      return "postop_month3_";
    case "month_6":
      return "postop_month6_";
    case "month_9":
      return "postop_month9_";
    case "month_12":
      return "postop_month12_";
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

function findByCategories(
  uploads: ReferenceCandidateUpload[],
  categories: string[]
): ReferenceCandidateUpload | null {
  const set = new Set(categories);
  const matches = uploads.filter((u) => {
    const cat = categoryFromType(u.type);
    return cat != null && set.has(cat) && Boolean(u.storage_path);
  });
  if (!matches.length) return null;
  matches.sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
  );
  return matches[0] ?? null;
}

/**
 * Resolve best prior reference for a role, excluding the current milestone's own uploads.
 */
export function resolveReferenceImageForRole(args: {
  role: LongitudinalEvidenceRole;
  stage: LongitudinalOutcomeStage;
  uploads: ReferenceCandidateUpload[];
}): ResolvedReferenceImage | null {
  const map = ROLE_REFERENCE_CATEGORIES[args.role];
  if (!map) return null;

  const currentPrefix = stagePrefix(args.stage);
  const usable = args.uploads.filter((u) => {
    const cat = categoryFromType(u.type);
    if (!cat) return false;
    // Exclude same-stage milestone band (current capture, not a prior reference).
    if (cat.startsWith(currentPrefix)) return false;
    return true;
  });

  const order: ReferenceImageSource[] = [
    "prior_followup",
    "surgery_day",
    "preoperative",
  ];

  for (const source of order) {
    const hit = findByCategories(usable, map[source]);
    if (hit?.storage_path) {
      return {
        available: true,
        uploadId: hit.id,
        storagePath: hit.storage_path,
        source,
        label: SOURCE_LABEL[source],
      };
    }
  }

  return null;
}

export function resolveCurrentImageForCategory(args: {
  uploadCategory: string;
  uploads: ReferenceCandidateUpload[];
}): { uploadId: string; storagePath: string } | null {
  const matches = args.uploads.filter((u) => {
    const cat = categoryFromType(u.type);
    return cat === args.uploadCategory && Boolean(u.storage_path);
  });
  if (!matches.length) return null;
  matches.sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
  );
  const hit = matches[0]!;
  return { uploadId: hit.id, storagePath: String(hit.storage_path) };
}
