/**
 * FI-OUTCOME-INTELLIGENCE-1F — Generate synthetic JPEG assets (Node / seed / unit only).
 */

import * as fs from "node:fs";
import sharp from "sharp";
import {
  LONGITUDINAL_SYNTHETIC_IMAGE_DIR,
  SYNTHETIC_IMAGE_ROLES,
  syntheticImagePath,
  type SyntheticImageRole,
} from "./syntheticImagePaths";

export {
  LONGITUDINAL_SYNTHETIC_IMAGE_DIR,
  SYNTHETIC_IMAGE_ROLES,
  syntheticImagePath,
  roleToSyntheticImage,
  type SyntheticImageRole,
} from "./syntheticImagePaths";

const ROLE_COLORS: Record<SyntheticImageRole, { r: number; g: number; b: number }> = {
  front: { r: 180, g: 160, b: 140 },
  top: { r: 150, g: 170, b: 190 },
  left: { r: 170, g: 150, b: 180 },
  right: { r: 160, g: 180, b: 150 },
  recipient_closeup: { r: 200, g: 170, b: 160 },
  crown: { r: 140, g: 160, b: 170 },
  donor_rear: { r: 130, g: 140, b: 150 },
  donor_closeup: { r: 145, g: 135, b: 125 },
};

/** Ensure all synthetic JPEGs exist on disk (idempotent). */
export async function ensureSyntheticLongitudinalImages(): Promise<
  Record<SyntheticImageRole, string>
> {
  fs.mkdirSync(LONGITUDINAL_SYNTHETIC_IMAGE_DIR, { recursive: true });
  const out = {} as Record<SyntheticImageRole, string>;

  for (const role of SYNTHETIC_IMAGE_ROLES) {
    const dest = syntheticImagePath(role);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 100) {
      const color = ROLE_COLORS[role];
      const buf = await sharp({
        create: {
          width: 1000,
          height: 1000,
          channels: 3,
          background: color,
        },
      })
        .jpeg({ quality: 82 })
        .toBuffer();
      const labeled = await sharp(buf)
        .composite([
          {
            input: Buffer.from(
              `<svg width="1000" height="40"><rect width="1000" height="40" fill="#222"/><text x="20" y="28" fill="#eee" font-size="20" font-family="sans-serif">SYNTHETIC ${role.toUpperCase()}</text></svg>`
            ),
            top: 20,
            left: 0,
          },
        ])
        .jpeg({ quality: 82 })
        .toBuffer();
      fs.writeFileSync(dest, labeled);
    }
    out[role] = dest;
  }

  return out;
}
