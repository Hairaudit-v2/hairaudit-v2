/**
 * Intake-driven copy and UI hints for patient photo upload (guidance only; no submit logic).
 */

import type { PatientIntakeMonthsSince } from "@/lib/patientPhoto/patientPhotoReadinessPolicy";
import { readMonthsSinceFromPatientAnswers } from "@/lib/patientPhoto/patientPhotoReadinessPolicy";
import type { PatientExtendedUploadGroupId } from "@/lib/patientExtendedUploadUi";

export type PatientPhotoUploadGuidancePanel = {
  title: string;
  body: string;
  /** Optional: order extended upload accordion groups with these ids first (rest unchanged). */
  extendedGroupOrderHint: readonly PatientExtendedUploadGroupId[];
};

const DEFAULT_ORDER: readonly PatientExtendedUploadGroupId[] = [
  "donor_monitoring",
  "early_recovery",
  "intraoperative_evidence",
  "graft_handling_evidence",
  "progress_tracking",
];

function orderForMonths(months: PatientIntakeMonthsSince | null): readonly PatientExtendedUploadGroupId[] {
  if (!months) return DEFAULT_ORDER;
  if (months === "under_3") {
    return ["early_recovery", "donor_monitoring", "intraoperative_evidence", "graft_handling_evidence", "progress_tracking"];
  }
  if (months === "3_6" || months === "6_9") {
    return ["progress_tracking", "early_recovery", "donor_monitoring", "intraoperative_evidence", "graft_handling_evidence"];
  }
  return ["progress_tracking", "donor_monitoring", "early_recovery", "intraoperative_evidence", "graft_handling_evidence"];
}

function bodyForMonths(months: PatientIntakeMonthsSince | null): { title: string; body: string } {
  if (!months) {
    return {
      title: "Photo tips",
      body: "Upload clear baseline views (front, top, donor rear) if you have them. Add day-of and follow-up photos in the optional sections when available—they strengthen your audit.",
    };
  }
  if (months === "under_3") {
    return {
      title: "Early recovery",
      body: "Baseline (before surgery) photos are ideal when available. If you are still early after surgery, also add day-of or first-week images in the optional sections below.",
    };
  }
  if (months === "3_6") {
    return {
      title: "Roughly 3–6 months post-op",
      body: "Include ~3-month outcome angles (front, top, donor) when you can. Baseline pre-op photos are still valuable if you have them. Use optional sections for other milestones.",
    };
  }
  if (months === "6_9") {
    return {
      title: "Roughly 6–9 months post-op",
      body: "~6-month outcome photos (front, top, donor) are especially useful. Add 9-month views in optional progress sections if you have them.",
    };
  }
  if (months === "9_12") {
    return {
      title: "Roughly 9–12 months post-op",
      body: "9–12 month outcome documentation helps reviewers assess maturity. Use the progress-tracking section for month-marked uploads.",
    };
  }
  return {
    title: "12+ months post-op",
    body: "Long-term outcome photos (12-month style front/top/donor) are most informative now, alongside any earlier milestones you can provide.",
  };
}

export function buildPatientPhotoUploadGuidancePanel(
  patientAnswers: Record<string, unknown> | null | undefined
): PatientPhotoUploadGuidancePanel {
  const months = readMonthsSinceFromPatientAnswers(patientAnswers ?? null);
  const { title, body } = bodyForMonths(months);
  return {
    title,
    body,
    extendedGroupOrderHint: [...orderForMonths(months)],
  };
}

/**
 * Reorder extended upload group specs: unknown ids append in original order.
 */
export function orderExtendedUploadGroupsByHint<T extends { id: PatientExtendedUploadGroupId }>(
  groups: readonly T[],
  hint: readonly PatientExtendedUploadGroupId[]
): T[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const seen = new Set<PatientExtendedUploadGroupId>();
  const out: T[] = [];
  for (const id of hint) {
    const g = byId.get(id);
    if (g) {
      out.push(g);
      seen.add(id);
    }
  }
  for (const g of groups) {
    if (!seen.has(g.id)) out.push(g);
  }
  return out;
}
