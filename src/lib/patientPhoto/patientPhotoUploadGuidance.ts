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
      body: "Before Surgery: use the angles on this page (front, top, back of head, then left, right, and crown) as marked required. After Surgery / Progress: Surgery Day, then 3 Month Photos, 6 Month Photos, and so on when you reach those times.",
    };
  }
  if (months === "under_3") {
    return {
      title: "Early recovery",
      body: "Before Surgery photos help if you have them. After surgery, add Surgery Day and Early Healing shots in the optional sections when you can.",
    };
  }
  if (months === "3_6") {
    return {
      title: "About 3–6 months after surgery",
      body: "3 Month Photos (front, top, back of head) are very useful now. Before Surgery photos still help. Use the progress section for other months.",
    };
  }
  if (months === "6_9") {
    return {
      title: "About 6–9 months after surgery",
      body: "6 Month Photos are very useful now. Add 9 Month Photos in the optional sections when you have them.",
    };
  }
  if (months === "9_12") {
    return {
      title: "About 9–12 months after surgery",
      body: "9 Month Photos and 12 Month Photos are very useful. Use the progress section when you upload.",
    };
  }
  return {
    title: "12 months or more after surgery",
    body: "12 Month Photos are very useful now. Add Before Surgery or earlier progress photos if you still have them.",
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
