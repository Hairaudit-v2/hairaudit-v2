/**
 * Deterministic sufficiency annotations for grouped patient image evidence (AI prompt context only).
 * Does not affect scoring, canSubmit, eligibility, or required uploads.
 */

import type {
  PatientAiEvidenceGroupId,
  PatientImageEvidenceGroupBucket,
  PatientImageEvidenceGroupsResult,
} from "@/lib/audit/patientAiImageEvidence";
import { buildPatientImageEvidenceGroups } from "@/lib/audit/patientAiImageEvidence";
import { PATIENT_UPLOAD_CATEGORY_DEFS } from "@/lib/patientPhotoCategoryConfig";

const ALL_GROUP_IDS: PatientAiEvidenceGroupId[] = [
  "baseline_evidence",
  "donor_monitoring_evidence",
  "surgical_evidence",
  "graft_handling_evidence",
  "followup_outcome_evidence",
];

/** Stage-2 / hidden UI categories — used only for hasExtendedEvidence. */
const HIDDEN_UPLOAD_CATEGORY_KEYS: Set<string> = new Set(
  PATIENT_UPLOAD_CATEGORY_DEFS.filter((d) => !d.visibleInUi).map((d) => d.key)
);

export type PatientImageEvidenceSufficiencyLevel = "none" | "limited" | "moderate" | "strong";

export type PatientImageEvidenceOverallSummaryLevel = "limited" | "moderate" | "strong";

export type PatientImageEvidenceGroupAssessment = {
  count: number;
  level: PatientImageEvidenceSufficiencyLevel;
  rationale: string;
};

export type PatientImageEvidenceConfidenceResult = {
  overall: {
    hasExtendedEvidence: boolean;
    summaryLevel: PatientImageEvidenceOverallSummaryLevel;
  };
  groups: Record<PatientAiEvidenceGroupId, PatientImageEvidenceGroupAssessment>;
};

/* —— Thresholds (explicit) ——
 * baseline_evidence: none=0 items; limited=1–2 items; moderate=3–5 items OR ≥4 distinct categories (without hitting strong); strong=≥6 items OR ≥5 distinct categories
 * surgical_evidence: none=0; limited=1; moderate=2–3; strong=≥4
 * graft_handling_evidence: none=0; limited=1 distinct category and ≤2 items; moderate=2 distinct categories OR 3–4 items; strong=≥3 distinct categories OR ≥5 items
 * donor_monitoring_evidence: none=0; limited=≤2 items and 1 phase; moderate=2+ phases OR 3–7 items (without hitting strong); strong=≥3 distinct phases OR (≥2 phases and ≥4 items) OR ≥8 items
 * followup_outcome_evidence: none=0; limited=≤1 distinct follow-up month and ≤3 items; moderate=2 distinct months OR 4–7 items (without hitting strong); strong=≥3 distinct months OR month 6+12 both present OR ≥8 items
 */

function levelScore(level: PatientImageEvidenceSufficiencyLevel): number {
  switch (level) {
    case "none":
      return 0;
    case "limited":
      return 1;
    case "moderate":
      return 2;
    case "strong":
      return 3;
  }
}

function donorMonitoringPhase(category: string): string | null {
  if (category.startsWith("preop_donor")) return "preop";
  if (category.startsWith("day0_donor")) return "day0";
  if (category === "intraop_donor_closeup") return "intraop";
  if (category === "postop_day1_donor" || category === "postop_week1_donor") return "early_postop";
  if (category === "postop_month3_donor" || category === "postop_month6_donor") return "mid_postop";
  if (category === "postop_month9_donor" || category === "postop_month12_donor") return "late_postop";
  return null;
}

function followupMonthFromCategory(category: string): number | null {
  const m = /^postop_month(\d+)_/.exec(category);
  return m ? parseInt(m[1], 10) : null;
}

function assessBaseline(bucket: PatientImageEvidenceGroupBucket): PatientImageEvidenceGroupAssessment {
  const count = bucket.count;
  const distinct = new Set(bucket.items.map((i) => i.category)).size;
  if (count === 0) {
    return { count: 0, level: "none", rationale: "No baseline views in grouped evidence." };
  }
  let level: PatientImageEvidenceSufficiencyLevel;
  if (count >= 6 || distinct >= 5) level = "strong";
  else if (count >= 3 || distinct >= 4) level = "moderate";
  else level = "limited";

  const rationale =
    level === "strong"
      ? "Broad pre-operative scalp and donor coverage."
      : level === "moderate"
        ? "Multiple pre-operative scalp and/or donor views."
        : "Few pre-operative views only.";

  return { count, level, rationale };
}

function assessSurgical(bucket: PatientImageEvidenceGroupBucket): PatientImageEvidenceGroupAssessment {
  const count = bucket.count;
  if (count === 0) {
    return { count: 0, level: "none", rationale: "No surgical-phase images in grouped evidence." };
  }
  let level: PatientImageEvidenceSufficiencyLevel;
  if (count >= 4) level = "strong";
  else if (count >= 2) level = "moderate";
  else level = "limited";

  const rationale =
    level === "strong"
      ? "Broad surgical-phase documentation."
      : level === "moderate"
        ? "Several surgical-phase views."
        : "Single surgical-phase image only.";

  return { count, level, rationale };
}

function assessGraft(bucket: PatientImageEvidenceGroupBucket): PatientImageEvidenceGroupAssessment {
  const count = bucket.count;
  const distinct = new Set(bucket.items.map((i) => i.category)).size;
  if (count === 0) {
    return { count: 0, level: "none", rationale: "No graft-handling images in grouped evidence." };
  }
  let level: PatientImageEvidenceSufficiencyLevel;
  if (distinct >= 3 || count >= 5) level = "strong";
  else if (distinct >= 2 || count >= 3) level = "moderate";
  else level = "limited";

  const rationale =
    level === "strong"
      ? "Several distinct graft-handling categories represented."
      : level === "moderate"
        ? "Multiple graft-handling categories or several images."
        : "Single graft-handling view or one handling category.";

  return { count, level, rationale };
}

function assessDonorMonitoring(bucket: PatientImageEvidenceGroupBucket): PatientImageEvidenceGroupAssessment {
  const count = bucket.count;
  const phases = new Set(
    bucket.items.map((i) => donorMonitoringPhase(i.category)).filter((p): p is string => p != null)
  );
  const phaseCount = phases.size;

  if (count === 0) {
    return { count: 0, level: "none", rationale: "No donor monitoring images in grouped evidence." };
  }

  let level: PatientImageEvidenceSufficiencyLevel;
  if (phaseCount >= 3 || count >= 8 || (phaseCount >= 2 && count >= 4)) level = "strong";
  else if (phaseCount >= 2 || count >= 3) level = "moderate";
  else level = "limited";

  const rationale =
    level === "strong"
      ? "Donor imagery spans three or more recovery phases."
      : level === "moderate"
        ? "Donor imagery spans two recovery phases."
        : "Donor imagery from a single phase only.";

  return { count, level, rationale };
}

function assessFollowup(bucket: PatientImageEvidenceGroupBucket): PatientImageEvidenceGroupAssessment {
  const count = bucket.count;
  const months = new Set(
    bucket.items.map((i) => followupMonthFromCategory(i.category)).filter((m): m is number => m != null)
  );
  const monthCount = months.size;
  const has6 = months.has(6);
  const has12 = months.has(12);

  if (count === 0) {
    return { count: 0, level: "none", rationale: "No follow-up outcome images in grouped evidence." };
  }

  let level: PatientImageEvidenceSufficiencyLevel;
  if (monthCount >= 3 || count >= 8 || (has6 && has12)) level = "strong";
  else if (monthCount >= 2 || count >= 4) level = "moderate";
  else level = "limited";

  const rationale =
    level === "strong"
      ? "Follow-up spans multiple month markers with strong longitudinal coverage."
      : level === "moderate"
        ? "Follow-up spans two distinct month markers."
        : "Follow-up limited to one timepoint or very few images.";

  return { count, level, rationale };
}

function computeHasExtendedEvidence(groups: PatientImageEvidenceGroupsResult): boolean {
  const cats = new Set<string>();
  for (const id of ALL_GROUP_IDS) {
    for (const it of groups.groups[id].items) {
      cats.add(it.category);
    }
  }
  for (const c of cats) {
    if (HIDDEN_UPLOAD_CATEGORY_KEYS.has(c)) return true;
  }
  return false;
}

function computeOverallSummary(perGroup: Record<PatientAiEvidenceGroupId, PatientImageEvidenceGroupAssessment>): PatientImageEvidenceOverallSummaryLevel {
  const active = ALL_GROUP_IDS.filter((id) => perGroup[id].count > 0);
  if (active.length === 0) return "limited";

  const sum = active.reduce((s, id) => s + levelScore(perGroup[id].level), 0);
  const avg = sum / active.length;

  if (avg >= 2.25) return "strong";
  if (avg >= 1.5) return "moderate";
  return "limited";
}

/** Human labels for review UI (same order as `ALL_GROUP_IDS`). */
export const PATIENT_IMAGE_EVIDENCE_QUALITY_LABELS: Record<PatientAiEvidenceGroupId, string> = {
  baseline_evidence: "Baseline evidence",
  donor_monitoring_evidence: "Donor monitoring evidence",
  surgical_evidence: "Surgical evidence",
  graft_handling_evidence: "Graft handling evidence",
  followup_outcome_evidence: "Follow-up outcome evidence",
};

export const PATIENT_IMAGE_EVIDENCE_QUALITY_GROUP_ORDER: readonly PatientAiEvidenceGroupId[] = ALL_GROUP_IDS;

const GROUP_LABEL = PATIENT_IMAGE_EVIDENCE_QUALITY_LABELS;

/**
 * Build sufficiency + confidence annotations from Stage-4 grouping output.
 * When `groups.enabled` is false, returns a stable stub (all none, overall limited).
 */
export function buildPatientImageEvidenceConfidence(
  groups: PatientImageEvidenceGroupsResult
): PatientImageEvidenceConfidenceResult {
  if (!groups.enabled) {
    const stubGroup = (rationale: string): PatientImageEvidenceGroupAssessment => ({
      count: 0,
      level: "none",
      rationale,
    });
    return {
      overall: { hasExtendedEvidence: false, summaryLevel: "limited" },
      groups: {
        baseline_evidence: stubGroup("Grouped patient image evidence is disabled."),
        donor_monitoring_evidence: stubGroup("Grouped patient image evidence is disabled."),
        surgical_evidence: stubGroup("Grouped patient image evidence is disabled."),
        graft_handling_evidence: stubGroup("Grouped patient image evidence is disabled."),
        followup_outcome_evidence: stubGroup("Grouped patient image evidence is disabled."),
      },
    };
  }

  const baseline = assessBaseline(groups.groups.baseline_evidence);
  const donor = assessDonorMonitoring(groups.groups.donor_monitoring_evidence);
  const surgical = assessSurgical(groups.groups.surgical_evidence);
  const graft = assessGraft(groups.groups.graft_handling_evidence);
  const follow = assessFollowup(groups.groups.followup_outcome_evidence);

  const perGroup: Record<PatientAiEvidenceGroupId, PatientImageEvidenceGroupAssessment> = {
    baseline_evidence: baseline,
    donor_monitoring_evidence: donor,
    surgical_evidence: surgical,
    graft_handling_evidence: graft,
    followup_outcome_evidence: follow,
  };

  const hasExtendedEvidence = computeHasExtendedEvidence(groups);
  const summaryLevel = computeOverallSummary(perGroup);

  return {
    overall: { hasExtendedEvidence, summaryLevel },
    groups: perGroup,
  };
}

/** Concise deterministic sentences for the AI user prompt (reference only). */
export function formatPatientImageEvidenceConfidenceForPrompt(result: PatientImageEvidenceConfidenceResult): string {
  const lines: string[] = [
    "This block summarizes **how complete** grouped patient photo evidence is. It is **not** a scoring rubric and must not change section weights.",
    `Overall evidence depth: **${result.overall.summaryLevel}**. Extended optional upload categories present: **${result.overall.hasExtendedEvidence ? "yes" : "no"}**.`,
  ];

  for (const gid of ALL_GROUP_IDS) {
    const g = result.groups[gid];
    if (g.level === "none") continue;
    const label = GROUP_LABEL[gid];
    lines.push(`${label} is **${g.level}** (${g.count} grouped item(s)): ${g.rationale}`);
  }

  return lines.join("\n");
}

type CaseUploadRow = {
  id?: string | null;
  type?: string | null;
  storage_path?: string | null;
};

/**
 * Deterministic sufficiency from case `uploads` rows (no prepared manifest).
 * For internal review only; uses the same grouping rules as Stage 4 with grouping enabled.
 */
export function computePatientImageEvidenceQualityFromCaseUploads(uploads: CaseUploadRow[]): PatientImageEvidenceConfidenceResult {
  const groups = buildPatientImageEvidenceGroups({
    enabled: true,
    uploads: uploads.map((u) => ({
      id: u.id,
      type: u.type,
      storage_path: u.storage_path,
    })),
  });
  return buildPatientImageEvidenceConfidence(groups);
}
