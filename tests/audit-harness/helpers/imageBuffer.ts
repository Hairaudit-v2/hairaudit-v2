/**
 * Default test image buffer for uploads (meets evidence min dimensions).
 * Uses sharp to create a small valid JPEG so prepareCaseEvidence quality is not "poor".
 */

import sharp from "sharp";

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 1000;

let cached: Buffer | null = null;

/** Returns a JPEG buffer (1000x1000) suitable for evidence preparation. */
export async function getDefaultImageBuffer(): Promise<Buffer> {
  if (cached) return cached;
  cached = await sharp({
    create: {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      channels: 3,
      background: { r: 200, g: 200, b: 200 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  return cached;
}
