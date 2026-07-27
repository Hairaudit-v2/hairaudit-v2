/**
 * FI-OUTCOME-INTELLIGENCE-1C — Versioned capture protocol / evidence requirements.
 *
 * Historical plans freeze `captureProtocolVersion` and resolve requirements
 * through versioned rules — later v2 must not silently rewrite v1 meaning.
 */

import { isCrownRelevant } from "@/lib/projection/longitudinalEvidence";
import { normalizeRecipientZone } from "@/lib/projection/surgeryDayZones";
import type {
  LongitudinalEvidenceRole,
  LongitudinalOutcomeStage,
} from "@/lib/projection/types";
import type { ProjectionSnapshot } from "@/lib/projection/projectionSnapshotTypes";
import {
  CAPTURE_PLAN_VERSION,
  CAPTURE_PROTOCOL_VERSION,
  type CapturePlanVersion,
  type CaptureProtocolVersion,
} from "./longitudinalCaptureTypes";

export type TreatmentCaptureContext = {
  treatedAreas: string[];
  crownTreated: boolean;
  templesTreated: boolean;
  frontalFocus: boolean;
  /** When true, donor rear becomes required (conservative donor-concern policy). */
  donorEvidenceRequired: boolean;
};

export type MilestoneEvidenceRequirements = {
  stage: LongitudinalOutcomeStage;
  required: LongitudinalEvidenceRole[];
  recommended: LongitudinalEvidenceRole[];
  protocolVersion: CaptureProtocolVersion;
};

const PATIENT_SAFE_ROLE_LABELS: Readonly<Record<LongitudinalEvidenceRole, string>> = {
  followup_front: "Front View",
  followup_left: "Left Side",
  followup_right: "Right Side",
  followup_top: "Top View",
  followup_crown: "Crown View",
  followup_donor_rear: "Donor Rear",
  followup_donor_closeup: "Donor Close-up",
  followup_recipient_closeup: "Recipient Close-up",
};

/** Shared patient-safe photography guidance (no clinical promises). */
export const CAPTURE_PHOTOGRAPHY_GUIDANCE: readonly string[] = [
  "Use dry hair where practical.",
  "Avoid fibres or concealers before photos.",
  "Use bright, even lighting.",
  "Use the same room and background where practical.",
  "Keep camera distance similar to prior photos.",
  "Keep head position neutral.",
  "Capture the same general angles each time.",
  "Avoid filters.",
  "Keep the scalp visible.",
  "Avoid extreme styling differences where practical.",
];

const ROLE_WHY: Readonly<Record<LongitudinalEvidenceRole, string>> = {
  followup_front: "Documents the frontal appearance for consistent follow-up review.",
  followup_left: "Documents the left profile where side framing was treated.",
  followup_right: "Documents the right profile where side framing was treated.",
  followup_top: "Documents top-down coverage for follow-up documentation.",
  followup_crown: "Documents the crown region because it was included in treatment.",
  followup_donor_rear: "Documents the donor region for follow-up documentation.",
  followup_donor_closeup: "Documents donor close-up detail for follow-up documentation.",
  followup_recipient_closeup:
    "Documents recipient close-up detail for follow-up documentation.",
};

const ROLE_INSTRUCTIONS: Readonly<Record<LongitudinalEvidenceRole, string[]>> = {
  followup_front: [
    "Face the camera directly with a neutral head position.",
    "Keep hair away from the forehead where practical so the hairline is visible.",
  ],
  followup_left: [
    "Turn to show the left side of the head clearly.",
    "Keep lighting even across the temple and side hairline.",
  ],
  followup_right: [
    "Turn to show the right side of the head clearly.",
    "Keep lighting even across the temple and side hairline.",
  ],
  followup_top: [
    "Tilt or raise the camera so the top of the scalp is visible.",
    "Avoid heavy styling that hides the scalp.",
  ],
  followup_crown: [
    "Capture the crown / vertex area clearly from above or behind.",
    "Keep scalp visibility consistent with prior photos where practical.",
  ],
  followup_donor_rear: [
    "Capture the rear donor region with even lighting.",
    "Keep hair parted or lifted enough that the donor area is visible.",
  ],
  followup_donor_closeup: [
    "Take a closer photo of the donor region without filters.",
    "Keep the camera steady and the scalp visible.",
  ],
  followup_recipient_closeup: [
    "Take a closer photo of the treated recipient area.",
    "Avoid fibres or concealers that hide the scalp.",
  ],
};

export function patientSafeLabelForRole(role: LongitudinalEvidenceRole): string {
  return PATIENT_SAFE_ROLE_LABELS[role];
}

export function whyRequestedForRole(role: LongitudinalEvidenceRole): string {
  return ROLE_WHY[role];
}

export function captureInstructionsForRole(role: LongitudinalEvidenceRole): string[] {
  return [...ROLE_INSTRUCTIONS[role]];
}

export function isSupportedCaptureProtocolVersion(
  version: string
): version is CaptureProtocolVersion {
  return version === CAPTURE_PROTOCOL_VERSION;
}

export function isSupportedCapturePlanVersion(
  version: string
): version is CapturePlanVersion {
  return version === CAPTURE_PLAN_VERSION;
}

export function getCapturePolicy(version: CaptureProtocolVersion = CAPTURE_PROTOCOL_VERSION): {
  planVersion: CapturePlanVersion;
  protocolVersion: CaptureProtocolVersion;
  photographyGuidance: readonly string[];
} {
  if (!isSupportedCaptureProtocolVersion(version)) {
    throw new Error(`Unsupported capture protocol version: ${version}`);
  }
  return {
    planVersion: CAPTURE_PLAN_VERSION,
    protocolVersion: version,
    photographyGuidance: CAPTURE_PHOTOGRAPHY_GUIDANCE,
  };
}

function uniqueRoles(roles: LongitudinalEvidenceRole[]): LongitudinalEvidenceRole[] {
  return [...new Set(roles)];
}

function zonesFromAreas(areas: string[]): ReturnType<typeof normalizeRecipientZone>[] {
  return areas.map((a) => normalizeRecipientZone(a));
}

/**
 * Derive treatment context from frozen 1A/1B projection snapshot.
 */
export function resolveTreatmentCaptureContext(
  projection: ProjectionSnapshot
): TreatmentCaptureContext {
  const reconstruction = projection.reconstructionSnapshot;
  const fromProcedure = reconstruction.procedureContext?.treatedAreas ?? [];
  const fromObserved = reconstruction.recipient?.observedTreatedAreas ?? [];
  const treatedAreas = [...new Set([...fromProcedure, ...fromObserved].map(String))];
  const zones = zonesFromAreas(treatedAreas);

  const crownTreated =
    isCrownRelevant(treatedAreas) || zones.includes("crown");
  const templesTreated = zones.includes("temples");
  const frontalFocus = zones.some((z) =>
    z === "hairline" || z === "frontal" || z === "forelock" || z === "temples"
  );

  // Conservative v1: donor follow-up is recommended by default.
  // Only elevate to required when frozen reconstruction recorded donor concerns.
  const donorConcernCount = reconstruction.donor?.visibleConcerns?.length ?? 0;
  const donorEvidenceRequired = donorConcernCount > 0;

  return {
    treatedAreas,
    crownTreated,
    templesTreated,
    frontalFocus: frontalFocus || treatedAreas.length === 0,
    donorEvidenceRequired,
  };
}

/**
 * Treatment-aware required / recommended roles for a milestone.
 * Ready-for-review uses required only; recommended never blocks readiness.
 *
 * Alignment with 1E: front remains the absolute minimum; capture protocol
 * adds top + recipient close-up as required for a useful follow-up set,
 * with crown/sides/donor conditional on treatment (fi-outcome-capture-protocol-v1).
 */
export function buildMilestoneEvidenceRequirements(args: {
  stage: LongitudinalOutcomeStage;
  treatment: TreatmentCaptureContext;
  protocolVersion?: CaptureProtocolVersion;
}): MilestoneEvidenceRequirements {
  const protocolVersion = args.protocolVersion ?? CAPTURE_PROTOCOL_VERSION;
  if (!isSupportedCaptureProtocolVersion(protocolVersion)) {
    throw new Error(`Unsupported capture protocol version: ${protocolVersion}`);
  }

  const required: LongitudinalEvidenceRole[] = [
    "followup_front",
    "followup_top",
    "followup_recipient_closeup",
  ];
  const recommended: LongitudinalEvidenceRole[] = [];

  if (args.treatment.crownTreated) {
    required.push("followup_crown");
  } else {
    recommended.push("followup_crown");
  }

  if (args.treatment.templesTreated) {
    required.push("followup_left", "followup_right");
  } else {
    recommended.push("followup_left", "followup_right");
  }

  if (args.treatment.donorEvidenceRequired) {
    required.push("followup_donor_rear");
    if (args.stage !== "month_3") {
      required.push("followup_donor_closeup");
    } else {
      recommended.push("followup_donor_closeup");
    }
  } else {
    recommended.push("followup_donor_rear", "followup_donor_closeup");
  }

  // Month 3 prioritizes recipient views; keep donor recommended unless required above.
  if (args.stage === "month_3" && !args.treatment.donorEvidenceRequired) {
    // already recommended
  }

  const reqSet = new Set(required);
  const recommendedOnly = recommended.filter((r) => !reqSet.has(r));

  return {
    stage: args.stage,
    required: uniqueRoles(required),
    recommended: uniqueRoles(recommendedOnly),
    protocolVersion,
  };
}

/** Stable public view keys (not storage category strings). */
export function publicViewKeyForRole(role: LongitudinalEvidenceRole): string {
  switch (role) {
    case "followup_front":
      return "front";
    case "followup_left":
      return "left";
    case "followup_right":
      return "right";
    case "followup_top":
      return "top";
    case "followup_crown":
      return "crown";
    case "followup_donor_rear":
      return "donor_rear";
    case "followup_donor_closeup":
      return "donor_closeup";
    case "followup_recipient_closeup":
      return "recipient_closeup";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

export function patientMilestoneLabel(stage: LongitudinalOutcomeStage): string {
  switch (stage) {
    case "month_3":
      return "3-Month HairAudit";
    case "month_6":
      return "6-Month HairAudit";
    case "month_9":
      return "9-Month HairAudit";
    case "month_12":
      return "12-Month HairAudit";
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

/**
 * Map capture stage → existing postop_month{N}_* category prefix for upload UX.
 * Does not invent new storage namespaces.
 */
export function postopCategoryPrefixForStage(stage: LongitudinalOutcomeStage): string {
  switch (stage) {
    case "month_3":
      return "postop_month3";
    case "month_6":
      return "postop_month6";
    case "month_9":
      return "postop_month9";
    case "month_12":
      return "postop_month12";
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

export function roleToPostopCategoryHint(
  stage: LongitudinalOutcomeStage,
  role: LongitudinalEvidenceRole
): string | null {
  const prefix = postopCategoryPrefixForStage(stage);
  switch (role) {
    case "followup_front":
      return `${prefix}_front`;
    case "followup_top":
      return `${prefix}_top`;
    case "followup_crown":
      return `${prefix}_crown`;
    case "followup_donor_rear":
      return `${prefix}_donor`;
    case "followup_left":
      return "patient_current_left";
    case "followup_right":
      return "patient_current_right";
    case "followup_recipient_closeup":
      return "current_recipient_closeup";
    case "followup_donor_closeup":
      return "preop_donor_closeup";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
