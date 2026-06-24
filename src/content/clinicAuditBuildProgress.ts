/**
 * Live clinic/audit build progress trackers — manually editable source of truth.
 * Update completion percentages and progressNote as engineering milestones land.
 */

export type ClinicAuditBuildProgressTracker = {
  id: string;
  label: string;
  /** 0–100 — edit directly when progress changes */
  completionPercent: number;
};

/** Live clinic/audit build progress rollups — edit completionPercent when milestones land. */
export const CLINIC_AUDIT_BUILD_PROGRESS_TRACKERS = {
  hairaudit: {
    id: "hairaudit",
    label: "HairAudit progress",
    completionPercent: 88,
  },
  fiOsEcosystem: {
    id: "fi-os-ecosystem",
    label: "FI OS ecosystem progress",
    completionPercent: 76,
  },
} as const satisfies Record<string, ClinicAuditBuildProgressTracker>;

/** Latest engineering status note for clinic and auditor dashboards. */
export const CLINIC_AUDIT_BUILD_PROGRESS_NOTE =
  "HairAudit operational recovery phase complete: structured clinical intelligence, image-limited regeneration, auditor workflow simplification, patient trust communication, and PDF recovery are now implemented." as const;
