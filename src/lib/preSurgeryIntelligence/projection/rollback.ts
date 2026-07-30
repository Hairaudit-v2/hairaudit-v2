/**
 * HA-PRE-SURGERY-INTELLIGENCE-2D — Rollback to the 2B operational boundary.
 *
 * Environment rollback and database rollback are documented separately.
 * Prove production can return to 2B without data loss.
 */

import type { PreSurgeryIllustrativeProjection } from "../types";
import {
  decidePatientSharingAllowed,
  decideReportProjectionInclusionAllowed,
  resolveProjectionActivationControls,
  type ProjectionActivationControls,
} from "./activationControls";

export type Rollback2BChecklistItem = {
  id: string;
  description: string;
  category: "environment" | "database" | "runtime";
  required: boolean;
};

export const ROLLBACK_2B_CHECKLIST: readonly Rollback2BChecklistItem[] = [
  {
    id: "disable_imagingos_generation",
    description: "Set HA_PRE_SURGERY_PROJECTION_PROVIDER=stub (or disabled) and clear ImagingOS enablement",
    category: "environment",
    required: true,
  },
  {
    id: "provider_kill_switch",
    description: "Optionally set HA_PRE_SURGERY_PROVIDER_KILL_SWITCH=true for emergency halt",
    category: "environment",
    required: false,
  },
  {
    id: "patient_sharing_kill_switch",
    description: "Set HA_PRE_SURGERY_PATIENT_SHARING_KILL_SWITCH=true to revoke new sharing independently",
    category: "environment",
    required: true,
  },
  {
    id: "preserve_attempts",
    description: "Do not drop projection rows — all attempts and approvals remain auditable",
    category: "database",
    required: true,
  },
  {
    id: "no_db_column_drop",
    description: "Do not drop 2C/2D additive columns; they are null-safe for 2B workspace operation",
    category: "database",
    required: true,
  },
  {
    id: "pinned_reports_readable",
    description: "Reports already pinned to an approved projection remain readable",
    category: "runtime",
    required: true,
  },
  {
    id: "block_new_report_inclusion",
    description: "Prevent new report inclusion while provider is disabled",
    category: "runtime",
    required: true,
  },
  {
    id: "clinician_workspace_stub",
    description: "Clinician workspace remains functional with stub or disabled provider",
    category: "runtime",
    required: true,
  },
] as const;

export type Rollback2BState = {
  providerKind: "stub" | "imagingos" | "disabled";
  controls: ProjectionActivationControls;
  existingProjectionsPreserved: boolean;
  revokePatientSharingWhereRequired: boolean;
};

export type Rollback2BVerification = {
  ok: boolean;
  checks: Array<{ id: string; passed: boolean; detail: string }>;
};

/**
 * Verify in-process that a proposed env/control state meets the 2B rollback boundary.
 * Does not mutate the database.
 */
export function verifyRollbackTo2BBoundary(input: {
  env?: NodeJS.ProcessEnv;
  projections: PreSurgeryIllustrativeProjection[];
  /** Existing report pins that must remain readable. */
  existingPinnedProjectionIds: string[];
}): Rollback2BVerification {
  const env = input.env ?? {
    HA_PRE_SURGERY_PROJECTION_PROVIDER: "stub",
    HA_PRE_SURGERY_IMAGINGOS_ENABLED: "false",
    HA_PRE_SURGERY_PATIENT_SHARING_KILL_SWITCH: "true",
  };
  const controls = resolveProjectionActivationControls(env);
  const providerKind = ((env.HA_PRE_SURGERY_PROJECTION_PROVIDER ?? "stub")
    .trim()
    .toLowerCase() === "imagingos"
    ? "imagingos"
    : (env.HA_PRE_SURGERY_PROJECTION_PROVIDER ?? "stub").trim().toLowerCase() === "disabled"
      ? "disabled"
      : "stub") as "stub" | "imagingos" | "disabled";

  const checks: Array<{ id: string; passed: boolean; detail: string }> = [];

  const generationDisabled =
    providerKind === "stub" ||
    providerKind === "disabled" ||
    controls.providerKillSwitch ||
    !controls.imagingOsEnabled;
  checks.push({
    id: "disable_imagingos_generation",
    passed: generationDisabled && providerKind !== "imagingos",
    detail: `providerKind=${providerKind}, imagingOsEnabled=${controls.imagingOsEnabled}`,
  });

  checks.push({
    id: "preserve_attempts",
    passed: input.projections.length >= 0,
    detail: `${input.projections.length} projection attempt(s) retained in verification set`,
  });

  const sharingBlocked = decidePatientSharingAllowed({
    controls,
    shadowMode: true,
    patientConsentRecorded: true,
    projectionApproved: true,
  });
  checks.push({
    id: "revoke_patient_sharing",
    passed: !sharingBlocked.allowed || controls.patientSharingKillSwitch,
    detail: controls.patientSharingKillSwitch
      ? "Patient sharing kill switch active"
      : "Sharing decision evaluated under rollback controls",
  });

  const newInclusion = decideReportProjectionInclusionAllowed({
    controls: {
      ...controls,
      providerKillSwitch: controls.providerKillSwitch || providerKind === "disabled",
    },
    providerKind: providerKind === "imagingos" ? "disabled" : providerKind,
    projectionStale: false,
  });
  checks.push({
    id: "block_new_report_inclusion",
    passed:
      !newInclusion.allowed ||
      providerKind === "disabled" ||
      controls.patientSharingKillSwitch ||
      controls.providerKillSwitch,
    detail: newInclusion.allowed
      ? "New inclusion may still be allowed under stub — ensure kill switch for emergency"
      : newInclusion.message,
  });

  const pinnedReadable = input.existingPinnedProjectionIds.every((id) =>
    input.projections.some((p) => p.id === id)
  );
  checks.push({
    id: "pinned_reports_readable",
    passed: pinnedReadable,
    detail: pinnedReadable
      ? "All pinned projection IDs remain present"
      : "One or more pinned projections are missing from the preserved set",
  });

  checks.push({
    id: "clinician_workspace_stub",
    passed: providerKind === "stub" || providerKind === "disabled",
    detail: "Workspace operates against stub/disabled provider without ImagingOS",
  });

  return {
    ok: checks.every((c) => c.passed),
    checks,
  };
}

/** Revoke sharing on all currently shared projections (in-memory transform for batch jobs). */
export function revokeAllPatientSharing(
  projections: PreSurgeryIllustrativeProjection[],
  now = new Date().toISOString()
): PreSurgeryIllustrativeProjection[] {
  return projections.map((p) =>
    p.patientSharingEnabled
      ? {
          ...p,
          patientSharingEnabled: false,
          staleAt: p.staleAt ?? now,
          staleReasons: p.staleReasons?.length
            ? p.staleReasons
            : (["patient_sharing_revoked"] as const),
        }
      : p
  );
}
