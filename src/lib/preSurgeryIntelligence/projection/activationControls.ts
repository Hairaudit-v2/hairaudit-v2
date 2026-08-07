/**
 * HA-PRE-SURGERY-INTELLIGENCE-2D — Controlled ImagingOS activation controls.
 *
 * A configured provider must NOT automatically mean every eligible professional
 * can generate projections. Generation and patient sharing are independently gated.
 *
 * Production default remains HA_PRE_SURGERY_PROJECTION_PROVIDER=stub until a
 * controlled 2D pilot explicitly enables ImagingOS traffic.
 */

import type { PreSurgeryProjectionMode } from "../types";

export const HA_PRE_SURGERY_IMAGINGOS_ENABLED_ENV =
  "HA_PRE_SURGERY_IMAGINGOS_ENABLED" as const;
export const HA_PRE_SURGERY_PROJECTION_CLINIC_ALLOWLIST_ENV =
  "HA_PRE_SURGERY_PROJECTION_CLINIC_ALLOWLIST" as const;
export const HA_PRE_SURGERY_PROJECTION_CLINICIAN_ALLOWLIST_ENV =
  "HA_PRE_SURGERY_PROJECTION_CLINICIAN_ALLOWLIST" as const;
export const HA_PRE_SURGERY_PROJECTION_CASE_ALLOWLIST_ENV =
  "HA_PRE_SURGERY_PROJECTION_CASE_ALLOWLIST" as const;
export const HA_PRE_SURGERY_PROJECTION_MODE_ALLOWLIST_ENV =
  "HA_PRE_SURGERY_PROJECTION_MODE_ALLOWLIST" as const;
export const HA_PRE_SURGERY_PROJECTION_MAX_REQUESTS_PER_CASE_ENV =
  "HA_PRE_SURGERY_PROJECTION_MAX_REQUESTS_PER_CASE" as const;
export const HA_PRE_SURGERY_PROJECTION_DAILY_CEILING_ENV =
  "HA_PRE_SURGERY_PROJECTION_DAILY_CEILING" as const;
export const HA_PRE_SURGERY_PROVIDER_KILL_SWITCH_ENV =
  "HA_PRE_SURGERY_PROVIDER_KILL_SWITCH" as const;
export const HA_PRE_SURGERY_PATIENT_SHARING_KILL_SWITCH_ENV =
  "HA_PRE_SURGERY_PATIENT_SHARING_KILL_SWITCH" as const;
export const HA_PRE_SURGERY_PROJECTION_SHADOW_MODE_ENV =
  "HA_PRE_SURGERY_PROJECTION_SHADOW_MODE" as const;
export const HA_PRE_SURGERY_PROJECTION_RELEASE_STAGE_ENV =
  "HA_PRE_SURGERY_PROJECTION_RELEASE_STAGE" as const;

export type ProjectionReleaseStage =
  | "internal_review_only"
  | "selected_clinicians"
  | "selected_clinics"
  | "selected_consented_patients"
  | "wider_controlled";

export type ProjectionActivationControls = {
  /** Global ImagingOS traffic enablement (independent of provider env kind). */
  imagingOsEnabled: boolean;
  clinicAllowlist: string[] | null;
  clinicianAllowlist: string[] | null;
  caseAllowlist: string[] | null;
  modeAllowlist: PreSurgeryProjectionMode[] | null;
  maxRequestsPerCase: number | null;
  dailyGenerationCeiling: number | null;
  /** Emergency: blocks all provider contact (ImagingOS or otherwise). */
  providerKillSwitch: boolean;
  /** Independent of generation — blocks patient sharing / new report inclusion. */
  patientSharingKillSwitch: boolean;
  /** Non-patient pilot: real generation, clinician_review only, no patient sharing. */
  shadowMode: boolean;
  releaseStage: ProjectionReleaseStage;
};

export type ActivationDecision =
  | { allowed: true; shadowMode: boolean; releaseStage: ProjectionReleaseStage }
  | {
      allowed: false;
      code: string;
      message: string;
      contactedProvider: false;
    };

const ALL_MODES: PreSurgeryProjectionMode[] = [
  "conservative",
  "planned",
  "optimistic_within_approved_range",
];

const RELEASE_STAGES: ProjectionReleaseStage[] = [
  "internal_review_only",
  "selected_clinicians",
  "selected_clinics",
  "selected_consented_patients",
  "wider_controlled",
];

function parseCsvAllowlist(raw: string | undefined): string[] | null {
  if (raw == null || raw.trim() === "") return null;
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

function parsePositiveIntOrNull(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseBool(raw: string | undefined): boolean {
  return (raw ?? "").trim().toLowerCase() === "true";
}

function parseReleaseStage(raw: string | undefined): ProjectionReleaseStage {
  const v = (raw ?? "internal_review_only").trim().toLowerCase();
  return (RELEASE_STAGES as string[]).includes(v)
    ? (v as ProjectionReleaseStage)
    : "internal_review_only";
}

function parseModeAllowlist(raw: string | undefined): PreSurgeryProjectionMode[] | null {
  const items = parseCsvAllowlist(raw);
  if (!items) return null;
  const modes = items.filter((m): m is PreSurgeryProjectionMode =>
    (ALL_MODES as string[]).includes(m)
  );
  return modes.length > 0 ? modes : null;
}

export function resolveProjectionActivationControls(
  env: NodeJS.ProcessEnv = process.env
): ProjectionActivationControls {
  const imagingOsEnabled = parseBool(env[HA_PRE_SURGERY_IMAGINGOS_ENABLED_ENV]);
  const explicitStage = (env[HA_PRE_SURGERY_PROJECTION_RELEASE_STAGE_ENV] ?? "").trim();
  return {
    imagingOsEnabled,
    clinicAllowlist: parseCsvAllowlist(env[HA_PRE_SURGERY_PROJECTION_CLINIC_ALLOWLIST_ENV]),
    clinicianAllowlist: parseCsvAllowlist(
      env[HA_PRE_SURGERY_PROJECTION_CLINICIAN_ALLOWLIST_ENV]
    ),
    caseAllowlist: parseCsvAllowlist(env[HA_PRE_SURGERY_PROJECTION_CASE_ALLOWLIST_ENV]),
    modeAllowlist: parseModeAllowlist(env[HA_PRE_SURGERY_PROJECTION_MODE_ALLOWLIST_ENV]),
    maxRequestsPerCase: parsePositiveIntOrNull(
      env[HA_PRE_SURGERY_PROJECTION_MAX_REQUESTS_PER_CASE_ENV]
    ),
    dailyGenerationCeiling: parsePositiveIntOrNull(
      env[HA_PRE_SURGERY_PROJECTION_DAILY_CEILING_ENV]
    ),
    providerKillSwitch: parseBool(env[HA_PRE_SURGERY_PROVIDER_KILL_SWITCH_ENV]),
    patientSharingKillSwitch: parseBool(env[HA_PRE_SURGERY_PATIENT_SHARING_KILL_SWITCH_ENV]),
    shadowMode: parseBool(env[HA_PRE_SURGERY_PROJECTION_SHADOW_MODE_ENV]),
    // ImagingOS activation defaults to internal review; stub / non-ImagingOS keeps 2C sharing.
    releaseStage: explicitStage
      ? parseReleaseStage(explicitStage)
      : imagingOsEnabled
        ? "internal_review_only"
        : "wider_controlled",
  };
}

export type ActivationGateContext = {
  controls: ProjectionActivationControls;
  /** Provider kind resolved from config. */
  providerKind: "stub" | "imagingos" | "local_illustrative" | "disabled";
  clinicId: string | null;
  clinicianId: string;
  caseId: string;
  mode: PreSurgeryProjectionMode;
  /** Prior generation attempts for this case (any status). */
  requestsForCase: number;
  /** Successful or attempted generations today (UTC day). */
  requestsToday: number;
  /** Explicit case-level enablement flag from workspace / case metadata. */
  caseLevelEnabled: boolean;
};

/**
 * Decide whether a real (or stub) generation request may proceed under 2D controls.
 *
 * Stub remains usable for local/dev without ImagingOS allowlists, unless the
 * provider kill switch is on. ImagingOS traffic additionally requires global
 * enablement + allowlist membership.
 */
export function decideProjectionActivation(ctx: ActivationGateContext): ActivationDecision {
  const { controls } = ctx;

  if (controls.providerKillSwitch || ctx.providerKind === "disabled") {
    return {
      allowed: false,
      code: "provider_kill_switch",
      message: "Projection provider kill switch is active",
      contactedProvider: false,
    };
  }

  if (!ctx.caseLevelEnabled) {
    return {
      allowed: false,
      code: "case_not_enabled",
      message: "Case-level projection enablement is required",
      contactedProvider: false,
    };
  }

  if (controls.modeAllowlist && !controls.modeAllowlist.includes(ctx.mode)) {
    return {
      allowed: false,
      code: "mode_not_allowlisted",
      message: `Projection mode "${ctx.mode}" is not in the activation allowlist`,
      contactedProvider: false,
    };
  }

  if (
    controls.maxRequestsPerCase != null &&
    ctx.requestsForCase >= controls.maxRequestsPerCase
  ) {
    return {
      allowed: false,
      code: "case_generation_ceiling",
      message: `Case has reached the maximum of ${controls.maxRequestsPerCase} projection requests`,
      contactedProvider: false,
    };
  }

  if (
    controls.dailyGenerationCeiling != null &&
    ctx.requestsToday >= controls.dailyGenerationCeiling
  ) {
    return {
      allowed: false,
      code: "daily_generation_ceiling",
      message: `Daily generation ceiling of ${controls.dailyGenerationCeiling} has been reached`,
      contactedProvider: false,
    };
  }

  // ImagingOS real traffic: require global enable + allowlists.
  if (ctx.providerKind === "imagingos") {
    if (!controls.imagingOsEnabled) {
      return {
        allowed: false,
        code: "imagingos_not_enabled",
        message:
          "ImagingOS is configured but global enablement is off — keep provider=stub until 2D activation",
        contactedProvider: false,
      };
    }

    if (controls.clinicAllowlist) {
      if (!ctx.clinicId || !controls.clinicAllowlist.includes(ctx.clinicId)) {
        return {
          allowed: false,
          code: "clinic_not_allowlisted",
          message: "Clinic is not on the ImagingOS activation allowlist",
          contactedProvider: false,
        };
      }
    }

    if (controls.clinicianAllowlist) {
      if (!controls.clinicianAllowlist.includes(ctx.clinicianId)) {
        return {
          allowed: false,
          code: "clinician_not_allowlisted",
          message: "Clinician is not on the ImagingOS activation allowlist",
          contactedProvider: false,
        };
      }
    }

    if (controls.caseAllowlist) {
      if (!controls.caseAllowlist.includes(ctx.caseId)) {
        return {
          allowed: false,
          code: "case_not_allowlisted",
          message: "Case is not on the ImagingOS activation allowlist",
          contactedProvider: false,
        };
      }
    }

    // At selected_clinicians / selected_clinics stages, empty allowlists fail closed.
    if (
      (controls.releaseStage === "selected_clinicians" && !controls.clinicianAllowlist) ||
      (controls.releaseStage === "selected_clinics" && !controls.clinicAllowlist)
    ) {
      return {
        allowed: false,
        code: "release_stage_allowlist_required",
        message: `Release stage "${controls.releaseStage}" requires a non-empty allowlist`,
        contactedProvider: false,
      };
    }
  }

  return {
    allowed: true,
    shadowMode: controls.shadowMode || controls.releaseStage === "internal_review_only",
    releaseStage: controls.releaseStage,
  };
}

/** Patient sharing is independently reversible from generation. */
export function decidePatientSharingAllowed(input: {
  controls: ProjectionActivationControls;
  shadowMode?: boolean;
  patientConsentRecorded: boolean;
  projectionApproved: boolean;
}):
  | { allowed: true }
  | { allowed: false; code: string; message: string } {
  if (input.controls.patientSharingKillSwitch) {
    return {
      allowed: false,
      code: "patient_sharing_kill_switch",
      message: "Patient sharing kill switch is active",
    };
  }
  if (input.shadowMode || input.controls.shadowMode) {
    return {
      allowed: false,
      code: "shadow_mode",
      message: "Shadow mode prevents patient sharing",
    };
  }
  if (
    input.controls.releaseStage === "internal_review_only" ||
    input.controls.releaseStage === "selected_clinicians" ||
    input.controls.releaseStage === "selected_clinics"
  ) {
    return {
      allowed: false,
      code: "release_stage_blocks_sharing",
      message: `Release stage "${input.controls.releaseStage}" does not permit patient sharing`,
    };
  }
  if (!input.projectionApproved) {
    return {
      allowed: false,
      code: "not_approved",
      message: "Projection must be approved before patient sharing",
    };
  }
  // Consent is required once patient-release stages are active (ImagingOS pilot).
  if (
    (input.controls.releaseStage === "selected_consented_patients" ||
      input.controls.imagingOsEnabled) &&
    !input.patientConsentRecorded
  ) {
    return {
      allowed: false,
      code: "consent_required",
      message: "Patient consent for illustrative projection sharing is required",
    };
  }
  return { allowed: true };
}

/** New report pin / inclusion of projections — blocked when provider disabled or sharing kill switch. */
export function decideReportProjectionInclusionAllowed(input: {
  controls: ProjectionActivationControls;
  providerKind: "stub" | "imagingos" | "local_illustrative" | "disabled";
  projectionStale: boolean;
}):
  | { allowed: true }
  | { allowed: false; code: string; message: string } {
  if (input.controls.providerKillSwitch || input.providerKind === "disabled") {
    return {
      allowed: false,
      code: "provider_disabled",
      message: "New report inclusion is blocked while the projection provider is disabled",
    };
  }
  if (input.controls.patientSharingKillSwitch || input.controls.shadowMode) {
    return {
      allowed: false,
      code: "sharing_blocked",
      message: "New report projection inclusion is blocked by sharing policy",
    };
  }
  if (input.projectionStale) {
    return {
      allowed: false,
      code: "projection_stale",
      message: "Stale projections cannot be selected for a new report",
    };
  }
  return { allowed: true };
}
