/**
 * FI-OUTCOME-INTELLIGENCE-1E — Patient-facing capture guidance overlays.
 *
 * Enriches (does not replace) 1C role instructions with short mobile copy.
 * Does not invent required roles or treatment scope.
 */

import type { LongitudinalEvidenceRole } from "@/lib/projection/types";
import {
  CAPTURE_PHOTOGRAPHY_GUIDANCE,
  captureInstructionsForRole,
} from "./longitudinalCapturePolicy";

/** Global standardization copy shown before capture (not calibrated measurement claims). */
export const GUIDED_CAPTURE_STANDARDIZATION: readonly string[] = [
  "For the most useful comparison, try to keep your photos consistent with previous HairAudit images.",
  "Use dry hair where practical.",
  "Avoid fibres, concealers or filters.",
  "Use bright, even lighting.",
  "Keep similar hair styling and camera distance when you can.",
  "Keep a neutral head position and make sure the full requested area is visible.",
];

export const GUIDED_CAPTURE_REPRESENTATIVE_COPY =
  "Use a clear photo that shows the full requested area. Avoid selecting only the most flattering angle.";

export const GUIDED_CAPTURE_REFERENCE_MATCH_COPY =
  "Try to match this angle.";

export const GUIDED_CAPTURE_RECOMMENDED_COPY =
  "This photo is optional, but it may help HairAudit make a more complete assessment.";

/** Concise on-screen bullets preferred for the guided wizard. */
const GUIDED_ROLE_INSTRUCTIONS: Readonly<
  Record<LongitudinalEvidenceRole, string[]>
> = {
  followup_front: [
    "Hold the phone at eye level.",
    "Look straight at the camera.",
    "Keep the full hairline and forehead visible.",
    "Use bright, even lighting.",
    "Avoid fibres, concealers or filters.",
  ],
  followup_top: [
    "Tilt your head forward.",
    "Capture the full top of the scalp.",
    "Keep the image sharp and well lit.",
    "Avoid strong overhead glare.",
  ],
  followup_crown: [
    "Capture the crown / vertex area clearly.",
    "Keep the scalp visible through the hair.",
    "Use even lighting without harsh glare.",
  ],
  followup_left: [
    "Turn to show the left side clearly.",
    "Keep lighting even across the temple and side hairline.",
    "Hold the phone steady at eye level.",
  ],
  followup_right: [
    "Turn to show the right side clearly.",
    "Keep lighting even across the temple and side hairline.",
    "Hold the phone steady at eye level.",
  ],
  followup_recipient_closeup: [
    "Move closer without using digital zoom.",
    "Keep the recipient area sharply focused.",
    "Avoid flash glare where possible.",
  ],
  followup_donor_rear: [
    "Capture the full donor area from behind.",
    "Keep the camera level.",
    "Make sure the scalp is visible through the hair.",
  ],
  followup_donor_closeup: [
    "Move closer without digital zoom.",
    "Keep the donor area sharply focused.",
    "Avoid filters and strong flash glare.",
  ],
};

export function guidedInstructionsForRole(
  role: LongitudinalEvidenceRole
): string[] {
  return [...(GUIDED_ROLE_INSTRUCTIONS[role] ?? captureInstructionsForRole(role))];
}

export function guidedPhotographyGuidance(): string[] {
  return [...GUIDED_CAPTURE_STANDARDIZATION];
}

/** Fallback to 1C shared list when callers need protocol guidance only. */
export function protocolPhotographyGuidance(): string[] {
  return [...CAPTURE_PHOTOGRAPHY_GUIDANCE];
}
