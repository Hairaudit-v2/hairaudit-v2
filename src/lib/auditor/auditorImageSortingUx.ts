/**
 * HA-UX-7A — grouped category options, pathway ordering, and sorting helpers for auditor image workflow.
 */

import { AUDITOR_REASSIGNABLE_CATEGORY_KEYS, auditorPatientPhotoCategoryLabel, normalizeAuditorPatientPhotoCategory } from "@/lib/auditor/auditorPatientPhotoCategories";
import {
  getMissingPathwayRequiredUploadKeys,
  requiredPhotoKeys,
  type PathwaySatisfactionOpts,
  type PatientReviewPathway,
} from "@/lib/patient/patientReviewPathway";

const REASSIGNABLE = new Set<string>(AUDITOR_REASSIGNABLE_CATEGORY_KEYS);

export type AuditorImageCategoryGroup = {
  id: string;
  label: string;
  keys: readonly string[];
};

/** UX group definitions — keys filtered to auditor-reassignable set at runtime. */
export const AUDITOR_IMAGE_CATEGORY_GROUP_DEFS: readonly AuditorImageCategoryGroup[] = [
  {
    id: "required_patient_views",
    label: "Required Patient Views",
    keys: [
      "preop_front",
      "preop_left",
      "preop_right",
      "preop_top",
      "preop_crown",
      "preop_donor_rear",
      "patient_current_front",
      "patient_current_left",
      "patient_current_right",
      "patient_current_top",
      "patient_current_crown",
      "patient_current_donor_rear",
    ],
  },
  {
    id: "post_surgery_repair",
    label: "Post-Surgery / Repair Views",
    keys: [
      "current_recipient_closeup",
      "preop_donor_closeup",
      "preop_hairline_closeup",
      "postop_day0",
      "day0_recipient",
      "day0_donor",
      "postop_day1_recipient",
      "postop_day1_donor",
      "postop_week1_recipient",
      "postop_week1_donor",
      "day0_donor_rear",
      "postop_wet_recipient",
    ],
  },
  {
    id: "supporting_documents",
    label: "Supporting Documents",
    keys: ["preop_clinic_quote", "graft_count_board", "preop_styling_reference", "preop_family_pattern"],
  },
  {
    id: "optional_extra",
    label: "Optional / Extra Views",
    keys: [
      "preop_wet_top",
      "any_preop",
      "any_day0",
      "any_early_postop_day0_3",
      "graft_tray_closeup",
      "graft_tray_overview",
      "postop_month3_front",
      "postop_month6_front",
      "postop_month12_front",
    ],
  },
] as const;

/** Pathway-specific keys pinned to the top of dropdowns (post-surgery audit workflow). */
export const POST_SURGERY_PINNED_CATEGORY_KEYS: readonly string[] = [
  "preop_front",
  "patient_current_front",
  "current_recipient_closeup",
  "preop_top",
  "patient_current_top",
  "preop_donor_rear",
  "patient_current_donor_rear",
  "preop_donor_closeup",
  "preop_clinic_quote",
  "graft_count_board",
];

/** Pathway-specific keys pinned for pre-surgery planning. */
export const PRE_SURGERY_PINNED_CATEGORY_KEYS: readonly string[] = [
  "preop_front",
  "preop_left",
  "preop_right",
  "preop_top",
  "preop_donor_rear",
  "preop_donor_closeup",
];

export type AuditorQuickAction = {
  id: string;
  label: string;
  categoryKey: string;
};

export const AUDITOR_QUICK_ACTIONS: readonly AuditorQuickAction[] = [
  { id: "front", label: "Front", categoryKey: "preop_front" },
  { id: "top", label: "Top/Crown", categoryKey: "preop_top" },
  { id: "donor", label: "Donor", categoryKey: "preop_donor_rear" },
  { id: "recipient", label: "Recipient", categoryKey: "current_recipient_closeup" },
  { id: "document", label: "Document", categoryKey: "preop_clinic_quote" },
  { id: "other", label: "Other", categoryKey: "any_preop" },
];

const LOW_CONFIDENCE_THRESHOLD = 0.55;

const PRIMARY_GROUP_KEY_SET = new Set(
  AUDITOR_IMAGE_CATEGORY_GROUP_DEFS.flatMap((g) => g.keys).filter((k) => REASSIGNABLE.has(k))
);

function filterReassignable(keys: readonly string[]): string[] {
  return keys.filter((k) => REASSIGNABLE.has(k));
}

function sortAlpha(keys: string[], pathway?: PatientReviewPathway): string[] {
  return [...keys].sort((a, b) =>
    auditorPatientPhotoCategoryLabel(a, pathway).localeCompare(
      auditorPatientPhotoCategoryLabel(b, pathway)
    )
  );
}

export function getPathwayPinnedCategoryKeys(pathway: PatientReviewPathway): readonly string[] {
  return pathway === "pre_surgery" ? PRE_SURGERY_PINNED_CATEGORY_KEYS : POST_SURGERY_PINNED_CATEGORY_KEYS;
}

export type AuditorGroupedCategoryOption = {
  groupId: string;
  groupLabel: string;
  key: string;
  label: string;
};

export function buildAuditorGroupedCategoryOptions(opts: {
  pathway: PatientReviewPathway;
  excludeKey?: string | null;
  showAdvanced?: boolean;
  searchQuery?: string;
}): AuditorGroupedCategoryOption[] {
  const pinned = new Set(getPathwayPinnedCategoryKeys(opts.pathway));
  const query = (opts.searchQuery ?? "").trim().toLowerCase();
  const exclude = opts.excludeKey ?? null;

  const pinnedOptions: AuditorGroupedCategoryOption[] = [];
  for (const key of getPathwayPinnedCategoryKeys(opts.pathway)) {
    if (!REASSIGNABLE.has(key) || key === exclude) continue;
    const label = auditorPatientPhotoCategoryLabel(key, opts.pathway);
    if (query && !label.toLowerCase().includes(query) && !key.includes(query)) continue;
    pinnedOptions.push({
      groupId: "pinned",
      groupLabel: "Priority for this case",
      key,
      label,
    });
  }

  const out: AuditorGroupedCategoryOption[] = [...pinnedOptions];

  for (const group of AUDITOR_IMAGE_CATEGORY_GROUP_DEFS) {
    let keys = filterReassignable(group.keys).filter((k) => k !== exclude && !pinned.has(k));
    if (!opts.showAdvanced) {
      keys = keys.filter((k) => PRIMARY_GROUP_KEY_SET.has(k));
    }
    keys = sortAlpha(keys, opts.pathway);
    for (const key of keys) {
      const label = auditorPatientPhotoCategoryLabel(key, opts.pathway);
      if (query && !label.toLowerCase().includes(query) && !key.includes(query)) continue;
      out.push({ groupId: group.id, groupLabel: group.label, key, label });
    }
  }

  if (opts.showAdvanced) {
    const covered = new Set(out.map((o) => o.key));
    const advanced = sortAlpha(
      AUDITOR_REASSIGNABLE_CATEGORY_KEYS.filter(
        (k) => k !== exclude && !covered.has(k) && !pinned.has(k)
      ),
      opts.pathway
    );
    for (const key of advanced) {
      const label = auditorPatientPhotoCategoryLabel(key, opts.pathway);
      if (query && !label.toLowerCase().includes(query) && !key.includes(query)) continue;
      out.push({
        groupId: "advanced",
        groupLabel: "Advanced categories",
        key,
        label,
      });
    }
  }

  return out;
}

export type RequiredPhotoChecklistItem = {
  key: string;
  label: string;
  satisfied: boolean;
};

export function buildRequiredPhotoChecklist(
  pathway: PatientReviewPathway,
  uploads: Array<{ type?: string | null; metadata?: unknown }>,
  opts?: PathwaySatisfactionOpts
): RequiredPhotoChecklistItem[] {
  const missing = new Set(getMissingPathwayRequiredUploadKeys(pathway, uploads, opts));
  return requiredPhotoKeys[pathway]
    .filter((k) => REASSIGNABLE.has(k))
    .map((key) => ({
      key,
      label: auditorPatientPhotoCategoryLabel(key, pathway),
      satisfied: !missing.has(key),
    }));
}

export type ClassifierSuggestion = {
  categoryKey: string;
  label: string;
  confidence: number | null;
  isLowConfidence: boolean;
};

export function readClassifierSuggestion(metadata: unknown): ClassifierSuggestion | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const raw = m.ai_detected_category;
  if (typeof raw !== "string" || !raw.trim()) return null;
  let categoryKey: string;
  try {
    categoryKey = normalizeAuditorPatientPhotoCategory(raw.trim());
  } catch {
    return null;
  }
  if (!REASSIGNABLE.has(categoryKey)) return null;
  const confRaw = m.ai_classification_confidence;
  const confidence =
    typeof confRaw === "number" && Number.isFinite(confRaw) && confRaw >= 0 && confRaw <= 1
      ? confRaw
      : null;
  const isLowConfidence = confidence == null || confidence < LOW_CONFIDENCE_THRESHOLD;
  return {
    categoryKey,
    label: auditorPatientPhotoCategoryLabel(categoryKey),
    confidence,
    isLowConfidence,
  };
}

export function isUncategorizedCategoryKey(categoryKey: string): boolean {
  return categoryKey === "uncategorized" || !categoryKey.trim();
}

export function categoryMatchesSuggestion(
  effectiveCategory: string,
  suggestion: ClassifierSuggestion | null
): boolean {
  if (!suggestion) return false;
  return effectiveCategory === suggestion.categoryKey;
}

/** Upload rows whose AI suggestion or filename hints match a target category. */
export function filterLikelyMatchesForCategory<T extends { type?: string | null; metadata?: unknown }>(
  uploads: T[],
  targetCategoryKey: string,
  resolveCategory: (row: T) => string
): T[] {
  const target = targetCategoryKey.toLowerCase();
  const targetLabel = auditorPatientPhotoCategoryLabel(targetCategoryKey).toLowerCase();
  return uploads.filter((u) => {
    const current = resolveCategory(u);
    if (!isUncategorizedCategoryKey(current) && current === targetCategoryKey) return false;
    const suggestion = readClassifierSuggestion(u.metadata);
    if (suggestion?.categoryKey === targetCategoryKey) return true;
    const meta = u.metadata;
    if (meta && typeof meta === "object") {
      const on = (meta as Record<string, unknown>).original_name;
      if (typeof on === "string") {
        const lower = on.toLowerCase();
        if (lower.includes(target) || lower.includes(targetLabel.split(" ")[0] ?? "")) return true;
      }
    }
    return false;
  });
}

export function sortUploadsForAuditorReview<T extends { type?: string | null; metadata?: unknown; created_at?: string }>(
  uploads: T[],
  pathway: PatientReviewPathway,
  resolveCategory: (row: T) => string
): T[] {
  const pinned = getPathwayPinnedCategoryKeys(pathway);
  const pinnedIndex = new Map(pinned.map((k, i) => [k, i]));

  function priority(row: T): number {
    const cat = resolveCategory(row);
    if (isUncategorizedCategoryKey(cat)) return 0;
    const suggestion = readClassifierSuggestion(row.metadata);
    if (suggestion && !categoryMatchesSuggestion(cat, suggestion)) return 1;
    if (suggestion?.isLowConfidence && categoryMatchesSuggestion(cat, suggestion)) return 2;
    const pi = pinnedIndex.get(cat);
    if (pi != null) return 10 + pi;
    return 100;
  }

  return [...uploads].sort((a, b) => {
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
}

export function formatUploadDate(createdAt: string | undefined): string {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return createdAt;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
