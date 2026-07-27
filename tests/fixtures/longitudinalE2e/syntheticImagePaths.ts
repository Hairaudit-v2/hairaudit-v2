/**
 * FI-OUTCOME-INTELLIGENCE-1F — Static paths for synthetic JPEG fixtures.
 * No sharp / Node-native deps — safe for Playwright browser tests.
 */

import * as path from "node:path";

export const LONGITUDINAL_SYNTHETIC_IMAGE_DIR = path.resolve(
  process.cwd(),
  "tests/e2e/fixtures/images/longitudinal"
);

export const SYNTHETIC_IMAGE_ROLES = [
  "front",
  "top",
  "left",
  "right",
  "recipient_closeup",
  "crown",
  "donor_rear",
  "donor_closeup",
] as const;

export type SyntheticImageRole = (typeof SYNTHETIC_IMAGE_ROLES)[number];

export function syntheticImagePath(role: SyntheticImageRole): string {
  return path.join(LONGITUDINAL_SYNTHETIC_IMAGE_DIR, `${role}.jpg`);
}

export function roleToSyntheticImage(evidenceRole: string): SyntheticImageRole {
  switch (evidenceRole) {
    case "followup_front":
    case "front":
      return "front";
    case "followup_top":
    case "top":
      return "top";
    case "followup_left":
    case "left":
      return "left";
    case "followup_right":
    case "right":
      return "right";
    case "followup_crown":
    case "crown":
      return "crown";
    case "followup_donor_rear":
    case "donor_rear":
      return "donor_rear";
    case "followup_donor_closeup":
    case "donor_closeup":
      return "donor_closeup";
    case "followup_recipient_closeup":
    case "recipient_closeup":
      return "recipient_closeup";
    default:
      return "front";
  }
}
