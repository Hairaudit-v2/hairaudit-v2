/**
 * HA-PRE-SURGERY-OPENAI-IMAGE-PROVIDER-2B — Post-generation containment / identity checks.
 * Mask adherence is guidance-only per OpenAI docs; measurable drift can fail the asset.
 */

import { createHash } from "node:crypto";
import sharp from "sharp";

export type OutcomeValidationMeasurement = {
  sourceChecksum: string;
  outputChecksum: string;
  maskChecksum: string;
  widthMatch: boolean;
  heightMatch: boolean;
  mimeOk: boolean;
  byteSize: number;
  outOfMaskMeanDelta: number;
  outOfMaskMaxDelta: number;
  outOfMaskChangedFraction: number;
  faceBandMeanDelta: number;
  backgroundBandMeanDelta: number;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
};

export type OutcomeValidationResult =
  | { ok: true; measurements: OutcomeValidationMeasurement }
  | {
      ok: false;
      code: "identity_or_containment_failed" | "asset_invalid";
      message: string;
      statusHint: "clinician_review_failed" | "rejected" | "validation_failed";
      measurements: OutcomeValidationMeasurement | null;
    };

const FACE_Y_START = 0.28;
const FACE_Y_END = 0.72;
const FACE_X_START = 0.22;
const FACE_X_END = 0.78;
const BG_EDGE = 0.08;

function meanAbsDiff(
  a: Buffer,
  b: Buffer,
  maskAlpha: Buffer | null,
  w: number,
  h: number,
  opts: {
    /** If true, only sample where mask alpha === 255 (preserve / out-of-edit). */
    outOfMaskOnly?: boolean;
    region?: { x0: number; y0: number; x1: number; y1: number };
  }
): { mean: number; max: number; changedFraction: number; samples: number } {
  let sum = 0;
  let max = 0;
  let samples = 0;
  let changed = 0;
  const threshold = 18;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (opts.region) {
        const nx = x / w;
        const ny = y / h;
        if (
          nx < opts.region.x0 ||
          nx > opts.region.x1 ||
          ny < opts.region.y0 ||
          ny > opts.region.y1
        ) {
          continue;
        }
      }
      const i = (y * w + x) * 3;
      if (opts.outOfMaskOnly && maskAlpha) {
        const aIdx = y * w + x;
        if ((maskAlpha[aIdx] ?? 255) < 128) continue; // editable region — skip
      }
      const dr = Math.abs((a[i] ?? 0) - (b[i] ?? 0));
      const dg = Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0));
      const db = Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0));
      const d = (dr + dg + db) / 3;
      sum += d;
      if (d > max) max = d;
      if (d > threshold) changed += 1;
      samples += 1;
    }
  }
  return {
    mean: samples ? sum / samples : 0,
    max,
    changedFraction: samples ? changed / samples : 0,
    samples,
  };
}

export async function validateProjectedOutcomeAsset(input: {
  sourceBytes: Buffer;
  outputBytes: Buffer;
  maskPng: Buffer;
  maskChecksum: string;
  expectedMime?: string;
}): Promise<OutcomeValidationResult> {
  const sourceChecksum = createHash("sha256").update(input.sourceBytes).digest("hex");
  const outputChecksum = createHash("sha256").update(input.outputBytes).digest("hex");

  let sourceMeta: sharp.Metadata;
  let outputMeta: sharp.Metadata;
  try {
    sourceMeta = await sharp(input.sourceBytes).metadata();
    outputMeta = await sharp(input.outputBytes).metadata();
  } catch {
    return {
      ok: false,
      code: "asset_invalid",
      message: "Could not decode source or output image for validation",
      statusHint: "validation_failed",
      measurements: null,
    };
  }

  const sw = sourceMeta.width ?? 0;
  const sh = sourceMeta.height ?? 0;
  const ow = outputMeta.width ?? 0;
  const oh = outputMeta.height ?? 0;
  if (!sw || !sh || !ow || !oh) {
    return {
      ok: false,
      code: "asset_invalid",
      message: "Missing image dimensions",
      statusHint: "validation_failed",
      measurements: null,
    };
  }

  // Align output to source size for comparison (gpt-image size may differ).
  const targetW = sw;
  const targetH = sh;
  const sourceRgb = await sharp(input.sourceBytes)
    .rotate()
    .resize(targetW, targetH, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const outputRgb = await sharp(input.outputBytes)
    .rotate()
    .resize(targetW, targetH, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const maskRaw = await sharp(input.maskPng)
    .ensureAlpha()
    .resize(targetW, targetH, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const maskAlpha = Buffer.alloc(targetW * targetH);
  for (let i = 0; i < targetW * targetH; i++) {
    maskAlpha[i] = maskRaw.data[i * 4 + 3] ?? 255;
  }

  const outOfMask = meanAbsDiff(sourceRgb, outputRgb, maskAlpha, targetW, targetH, {
    outOfMaskOnly: true,
  });
  const faceBand = meanAbsDiff(sourceRgb, outputRgb, maskAlpha, targetW, targetH, {
    outOfMaskOnly: true,
    region: { x0: FACE_X_START, y0: FACE_Y_START, x1: FACE_X_END, y1: FACE_Y_END },
  });
  const backgroundBand = meanAbsDiff(sourceRgb, outputRgb, null, targetW, targetH, {
    region: { x0: 0, y0: 0, x1: BG_EDGE, y1: 1 },
  });

  const mimeOk =
    (outputMeta.format === "jpeg" ||
      outputMeta.format === "png" ||
      outputMeta.format === "webp") &&
    (!input.expectedMime ||
      input.expectedMime.includes(outputMeta.format) ||
      (input.expectedMime.includes("jpeg") && outputMeta.format === "jpeg"));

  const measurements: OutcomeValidationMeasurement = {
    sourceChecksum,
    outputChecksum,
    maskChecksum: input.maskChecksum,
    widthMatch: ow === sw,
    heightMatch: oh === sh,
    mimeOk,
    byteSize: input.outputBytes.byteLength,
    outOfMaskMeanDelta: outOfMask.mean,
    outOfMaskMaxDelta: outOfMask.max,
    outOfMaskChangedFraction: outOfMask.changedFraction,
    faceBandMeanDelta: faceBand.mean,
    backgroundBandMeanDelta: backgroundBand.mean,
    sourceWidth: sw,
    sourceHeight: sh,
    outputWidth: ow,
    outputHeight: oh,
  };

  if (!mimeOk || input.outputBytes.byteLength < 8_000) {
    return {
      ok: false,
      code: "asset_invalid",
      message: "Output asset failed MIME/size validation",
      statusHint: "validation_failed",
      measurements,
    };
  }

  // Containment / identity thresholds — tunable pilot values.
  // Face-band samples only out-of-edit pixels; keep masks above the eye line so this catches drift.
  const identityFail =
    faceBand.mean > 12 ||
    outOfMask.mean > 18 ||
    outOfMask.max > 90 ||
    outOfMask.changedFraction > 0.08 ||
    backgroundBand.mean > 22;

  if (identityFail) {
    return {
      ok: false,
      code: "identity_or_containment_failed",
      message:
        "Projected outcome failed out-of-mask / identity preservation checks. Asset held for rejection or clinician_review_failed — not approved.",
      statusHint: "clinician_review_failed",
      measurements,
    };
  }

  return { ok: true, measurements };
}
