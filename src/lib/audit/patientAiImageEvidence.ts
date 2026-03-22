/**
 * Deterministic grouping of patient photo uploads for AI audit context.
 * Patient evidence letter grades and `canSubmit` live in `auditPhotoSchemas`; this module only shapes AI prompt groupings.
 */

import { PATIENT_AUDIT_PHOTO_BUCKET_DEFS, PATIENT_UPLOAD_CATEGORY_DEFS } from "@/lib/patientPhotoCategoryConfig";
import {
  PATIENT_PHOTO_CATEGORY_ALIASES,
  PatientPhotoCategorySchema,
  resolveCategoryForValidation,
} from "@/lib/photoCategories";
import { effectivePatientPhotoCategoryKey, isPatientUploadAuditExcluded } from "@/lib/uploads/patientPhotoAuditMeta";

export type PatientAiEvidenceGroupId =
  | "baseline_evidence"
  | "donor_monitoring_evidence"
  | "surgical_evidence"
  | "graft_handling_evidence"
  | "followup_outcome_evidence";

export type PatientImageEvidenceItem = {
  category: string;
  uploadId: string;
  type: string;
  storagePath: string | null;
  preparedSourceKey?: string;
  manifestCategory?: string;
};

export type PatientImageEvidenceGroupBucket = {
  items: PatientImageEvidenceItem[];
  count: number;
  hasAny: boolean;
};

export type PatientImageEvidenceGroupsResult = {
  enabled: boolean;
  groups: Record<PatientAiEvidenceGroupId, PatientImageEvidenceGroupBucket>;
  /** Total patient_photo uploads considered after category resolution. */
  totalPatientPhotoUploads: number;
  /** Any group has at least one item. */
  hasAnyGroupedEvidence: boolean;
};

type PreparedRow = {
  upload_id: string;
  category: string;
  original_path?: string;
  prepared_path?: string;
};

const ALL_GROUP_IDS: PatientAiEvidenceGroupId[] = [
  "baseline_evidence",
  "donor_monitoring_evidence",
  "surgical_evidence",
  "graft_handling_evidence",
  "followup_outcome_evidence",
];

/** Explicit category → group membership (multi-group allowed). Derived from Stage 4 spec + patientPhotoCategoryConfig keys. */
const CATEGORY_TO_GROUPS: Readonly<Record<string, readonly PatientAiEvidenceGroupId[]>> = (() => {
  const m: Record<string, PatientAiEvidenceGroupId[]> = {};
  const add = (cat: string, groups: PatientAiEvidenceGroupId[]) => {
    m[cat] = [...(m[cat] ?? []), ...groups];
  };

  const BASELINE_ONLY: PatientAiEvidenceGroupId[] = ["baseline_evidence"];
  const DONOR_ONLY: PatientAiEvidenceGroupId[] = ["donor_monitoring_evidence"];
  const SURG: PatientAiEvidenceGroupId[] = ["surgical_evidence"];
  const GRAFT: PatientAiEvidenceGroupId[] = ["graft_handling_evidence"];
  const FOLLOW: PatientAiEvidenceGroupId[] = ["followup_outcome_evidence"];
  const BASELINE_AND_DONOR: PatientAiEvidenceGroupId[] = ["baseline_evidence", "donor_monitoring_evidence"];
  const SURG_AND_DONOR: PatientAiEvidenceGroupId[] = ["surgical_evidence", "donor_monitoring_evidence"];

  for (const c of [
    "patient_current_front",
    "patient_current_top",
    "patient_current_left",
    "patient_current_right",
    "patient_current_crown",
  ]) {
    add(c, BASELINE_ONLY);
  }
  add("patient_current_donor_rear", BASELINE_AND_DONOR);
  add("any_preop", BASELINE_ONLY);
  add("any_day0", SURG_AND_DONOR);
  add("any_early_postop_day0_3", SURG);
  add("intraop", SURG);
  add("postop_day0", SURG);

  for (const c of [
    "preop_front",
    "preop_left",
    "preop_right",
    "preop_top",
    "preop_crown",
  ]) {
    add(c, BASELINE_ONLY);
  }

  for (const c of ["preop_donor_rear", "preop_donor_left", "preop_donor_right", "preop_donor_closeup"]) {
    add(c, BASELINE_AND_DONOR);
  }

  for (const c of [
    "day0_donor",
    "day0_donor_rear",
    "day0_donor_left",
    "day0_donor_right",
    "day0_donor_closeup",
    "intraop_donor_closeup",
    "postop_day1_donor",
    "postop_week1_donor",
    "postop_month3_donor",
    "postop_month6_donor",
    "postop_month9_donor",
    "postop_month12_donor",
  ]) {
    add(c, DONOR_ONLY);
  }

  for (const c of [
    "day0_recipient",
    "intraop_extraction",
    "intraop_recipient_sites",
    "intraop_implantation",
    "postop_day1_recipient",
    "postop_week1_recipient",
  ]) {
    add(c, SURG);
  }

  for (const c of [
    "graft_tray_overview",
    "graft_tray_closeup",
    "graft_sorting",
    "graft_hydration_solution",
    "graft_count_board",
  ]) {
    add(c, GRAFT);
  }

  for (const c of [
    "postop_month3_front",
    "postop_month3_top",
    "postop_month3_crown",
    "postop_month3_donor",
    "postop_month6_front",
    "postop_month6_top",
    "postop_month6_crown",
    "postop_month6_donor",
    "postop_month9_front",
    "postop_month9_top",
    "postop_month9_crown",
    "postop_month9_donor",
    "postop_month12_front",
    "postop_month12_top",
    "postop_month12_crown",
    "postop_month12_donor",
  ]) {
    add(c, FOLLOW);
  }

  for (const [, groups] of Object.entries(m)) {
    groups.sort();
  }
  return m;
})();

const KNOWN_CATEGORY_KEYS = new Set<string>(PATIENT_UPLOAD_CATEGORY_DEFS.map((d) => d.key));
const KNOWN_AUDIT_BUCKET_KEYS = new Set<string>(PATIENT_AUDIT_PHOTO_BUCKET_DEFS.map((d) => d.key));

/** @internal Exported for tests — assert config and grouping stay aligned. */
export function __getCategoryToGroupsForTests(): Readonly<Record<string, readonly PatientAiEvidenceGroupId[]>> {
  return CATEGORY_TO_GROUPS;
}

export function storageCategoryKeyFromPatientUploadType(type: string): string | null {
  const t = String(type ?? "").trim();
  if (!t.toLowerCase().startsWith("patient_photo:")) return null;
  const raw = t.slice("patient_photo:".length).trim();
  if (!raw) return null;
  const alias = (PATIENT_PHOTO_CATEGORY_ALIASES as Record<string, string>)[raw];
  if (alias) return alias;
  if (PatientPhotoCategorySchema.safeParse(raw).success) return raw;
  const resolved = resolveCategoryForValidation(raw);
  if (resolved.length > 0) return resolved[0];
  return raw;
}

/** Resolve grouping/alias key using DB-backed category when present (metadata.category or type suffix). */
export function resolvePatientPhotoCategoryKeyFromUpload(row: {
  type?: string | null;
  metadata?: unknown;
}): string | null {
  const eff = effectivePatientPhotoCategoryKey(row);
  if (eff != null) {
    return storageCategoryKeyFromPatientUploadType(`patient_photo:${eff}`);
  }
  return storageCategoryKeyFromPatientUploadType(String(row.type ?? ""));
}

function emptyBuckets(): Record<PatientAiEvidenceGroupId, PatientImageEvidenceGroupBucket> {
  const g = {} as Record<PatientAiEvidenceGroupId, PatientImageEvidenceGroupBucket>;
  for (const id of ALL_GROUP_IDS) {
    g[id] = { items: [], count: 0, hasAny: false };
  }
  return g;
}

export type BuildPatientImageEvidenceGroupsArgs = {
  enabled: boolean;
  uploads: Array<{
    id?: string | null;
    type?: string | null;
    storage_path?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  preparedImages?: PreparedRow[] | null;
};

/**
 * Build grouped evidence for AI prompts. When `enabled` is false, returns a disabled stub without inspecting uploads.
 */
export function buildPatientImageEvidenceGroups(
  args: BuildPatientImageEvidenceGroupsArgs
): PatientImageEvidenceGroupsResult {
  const empty: PatientImageEvidenceGroupsResult = {
    enabled: false,
    groups: emptyBuckets(),
    totalPatientPhotoUploads: 0,
    hasAnyGroupedEvidence: false,
  };

  if (!args.enabled) return empty;

  const preparedByUploadId = new Map<string, PreparedRow>();
  for (const p of args.preparedImages ?? []) {
    const uid = String(p.upload_id ?? "").trim();
    if (uid) preparedByUploadId.set(uid, p);
  }

  const groups = emptyBuckets();
  let totalPatient = 0;

  for (const u of args.uploads) {
    const type = String(u.type ?? "");
    const cat = resolvePatientPhotoCategoryKeyFromUpload(u);
    if (cat === null) continue;
    if (isPatientUploadAuditExcluded(u)) continue;
    totalPatient += 1;

    const groupIds = CATEGORY_TO_GROUPS[cat];
    if (!groupIds || groupIds.length === 0) continue;

    const uploadId = String(u.id ?? "").trim() || "unknown";
    const prep = preparedByUploadId.get(uploadId);
    const item: PatientImageEvidenceItem = {
      category: cat,
      uploadId,
      type,
      storagePath: u.storage_path != null ? String(u.storage_path) : null,
      preparedSourceKey: prep?.prepared_path,
      manifestCategory: prep?.category,
    };

    for (const gid of groupIds) {
      const bucket = groups[gid];
      bucket.items.push(item);
    }
  }

  let hasAny = false;
  for (const id of ALL_GROUP_IDS) {
    const b = groups[id];
    b.count = b.items.length;
    b.hasAny = b.count > 0;
    if (b.hasAny) hasAny = true;
  }

  return {
    enabled: true,
    groups,
    totalPatientPhotoUploads: totalPatient,
    hasAnyGroupedEvidence: hasAny,
  };
}

/** Human-readable block for the AI user prompt (reference only; not scoring input). */
export function formatPatientImageEvidenceGroupsForPrompt(result: PatientImageEvidenceGroupsResult): string {
  if (!result.enabled || !result.hasAnyGroupedEvidence) return "";

  const lines: string[] = [
    "Structured grouping of **patient-submitted** photos (by storage category). The same upload may appear in more than one group. This is contextual organization only — use the images and image_source_key list as primary evidence.",
  ];

  for (const gid of ALL_GROUP_IDS) {
    const b = result.groups[gid];
    if (!b.hasAny) continue;
    const short = b.items
      .map((it) => `${it.category} (upload ${it.uploadId}${it.manifestCategory ? `; manifest ${it.manifestCategory}` : ""})`)
      .join("; ");
    lines.push(`- **${gid}** (n=${b.count}): ${short}`);
  }

  return lines.join("\n");
}

/** @internal Verify every grouped category exists in shared config. */
export function __assertAllGroupedCategoriesExistInConfig(): void {
  for (const cat of Object.keys(CATEGORY_TO_GROUPS)) {
    if (!KNOWN_CATEGORY_KEYS.has(cat) && !KNOWN_AUDIT_BUCKET_KEYS.has(cat)) {
      throw new Error(
        `patientAiImageEvidence: category ${cat} not in PATIENT_UPLOAD_CATEGORY_DEFS or PATIENT_AUDIT_PHOTO_BUCKET_DEFS`
      );
    }
  }
}
