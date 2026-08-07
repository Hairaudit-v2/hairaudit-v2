/**
 * HA-PRE-SURGERY-OPENAI-IMAGE-PROVIDER-2B — Force out-of-mask pixels back to the source.
 * OpenAI mask adherence is guidance-only; this composite restores identity / background.
 */

import sharp from "sharp";

/** Decode with EXIF orientation applied and strip to a stable PNG pixel grid. */
export async function normalizeProjectionRaster(input: Buffer): Promise<{
  png: Buffer;
  widthPx: number;
  heightPx: number;
}> {
  const png = await sharp(input).rotate().png().toBuffer();
  const verified = await sharp(png).metadata();
  const widthPx = verified.width ?? 0;
  const heightPx = verified.height ?? 0;
  if (!widthPx || !heightPx) throw new Error("Could not normalize image dimensions");
  return { png, widthPx, heightPx };
}

/**
 * Keep OpenAI pixels only where mask is editable (alpha ≈ 0).
 * Preserve all other source pixels (face, background, native hair).
 */
export async function compositeOutcomeWithinMask(input: {
  sourceBytes: Buffer;
  modelOutputBytes: Buffer;
  maskPng: Buffer;
}): Promise<{ bytes: Buffer; mimeType: "image/jpeg"; widthPx: number; heightPx: number }> {
  const sourceNorm = await normalizeProjectionRaster(input.sourceBytes);
  const w = sourceNorm.widthPx;
  const h = sourceNorm.heightPx;

  const sourceRgba = await sharp(sourceNorm.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const outputRgba = await sharp(input.modelOutputBytes)
    .rotate()
    .resize(w, h, { fit: "fill", kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const maskRaw = await sharp(input.maskPng)
    .ensureAlpha()
    .resize(w, h, { fit: "fill", kernel: "nearest" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (sourceRgba.info.width !== w || sourceRgba.info.height !== h) {
    throw new Error("Source raster dimension mismatch after normalize");
  }
  if (outputRgba.info.width !== w || outputRgba.info.height !== h) {
    throw new Error("Output raster dimension mismatch after resize");
  }

  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const mi = i * 4;
    // Mask alpha: 0 = fully editable (use model), 255 = preserve source. Blend by alpha.
    const preserve = (maskRaw.data[mi + 3] ?? 255) / 255;
    const t = 1 - preserve; // model weight
    out[mi] = Math.round((1 - t) * (sourceRgba.data[mi] ?? 0) + t * (outputRgba.data[mi] ?? 0));
    out[mi + 1] = Math.round(
      (1 - t) * (sourceRgba.data[mi + 1] ?? 0) + t * (outputRgba.data[mi + 1] ?? 0)
    );
    out[mi + 2] = Math.round(
      (1 - t) * (sourceRgba.data[mi + 2] ?? 0) + t * (outputRgba.data[mi + 2] ?? 0)
    );
    out[mi + 3] = 255;
  }

  const bytes = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  return { bytes, mimeType: "image/jpeg", widthPx: w, heightPx: h };
}
