/**
 * HA-PRE-SURGERY-OPENAI-IMAGE-PROVIDER-2B — Build RGBA mask for OpenAI image edit.
 *
 * Transparent (alpha=0) = editable recipient region.
 * Opaque (alpha=255) = preserve (face, background, native hair outside plan).
 */

import sharp from "sharp";
import type { ClinicalImageAnnotation, PreSurgeryGraftPlan, PreSurgeryProjectionMode } from "../types";
import { deriveProjectionModeAllocation } from "./modes";

export type TreatmentMaskBuildResult = {
  /** Soft-edged mask for OpenAI edit guidance (preferred API input). */
  maskPng: Buffer;
  /** Hard containment mask for post-edit composite / validation. */
  hardMaskPng: Buffer;
  widthPx: number;
  heightPx: number;
  maskChecksum: string;
  hardMaskChecksum: string;
  editablePixelCount: number;
  totalPixelCount: number;
  zonesIncluded: string[];
};

function defaultZonePolygon(
  zone: string,
  w: number,
  h: number
): Array<{ x: number; y: number }> {
  // Frontal portrait masks must stay on the upper scalp — never cross the eye band (~0.34+).
  switch (zone) {
    case "hairline":
    case "frontal":
    case "frontal_third":
    case "frontal_tuft":
    case "forelock":
      return [
        { x: 0.24 * w, y: 0.08 * h },
        { x: 0.76 * w, y: 0.08 * h },
        { x: 0.72 * w, y: 0.22 * h },
        { x: 0.28 * w, y: 0.22 * h },
      ];
    case "temple_left":
    case "left_temple":
      return [
        { x: 0.08 * w, y: 0.14 * h },
        { x: 0.24 * w, y: 0.12 * h },
        { x: 0.22 * w, y: 0.26 * h },
        { x: 0.1 * w, y: 0.28 * h },
      ];
    case "temple_right":
    case "right_temple":
      return [
        { x: 0.76 * w, y: 0.12 * h },
        { x: 0.92 * w, y: 0.14 * h },
        { x: 0.9 * w, y: 0.28 * h },
        { x: 0.78 * w, y: 0.26 * h },
      ];
    case "mid_scalp":
      return [
        { x: 0.3 * w, y: 0.1 * h },
        { x: 0.7 * w, y: 0.1 * h },
        { x: 0.68 * w, y: 0.2 * h },
        { x: 0.32 * w, y: 0.2 * h },
      ];
    case "crown":
      // Crown is poorly visible on pure frontal photos — keep a small upper scalp patch only.
      return [
        { x: 0.36 * w, y: 0.06 * h },
        { x: 0.64 * w, y: 0.06 * h },
        { x: 0.62 * w, y: 0.14 * h },
        { x: 0.38 * w, y: 0.14 * h },
      ];
    default:
      return [
        { x: 0.3 * w, y: 0.1 * h },
        { x: 0.7 * w, y: 0.1 * h },
        { x: 0.68 * w, y: 0.2 * h },
        { x: 0.32 * w, y: 0.2 * h },
      ];
  }
}

function clampPolygonToScalp(
  pts: Array<{ x: number; y: number }>,
  heightPx: number
): Array<{ x: number; y: number }> {
  const maxY = heightPx * 0.3;
  return pts.map((p) => ({ x: p.x, y: Math.min(p.y, maxY) }));
}

function pointsToSvgPath(pts: Array<{ x: number; y: number }>, closed: boolean): string {
  if (pts.length === 0) return "";
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  return closed ? `${d} Z` : d;
}

/**
 * Build an OpenAI-compatible edit mask (PNG with alpha).
 * Alpha 0 = edit; alpha 255 = preserve.
 */
export async function buildRecipientEditMask(input: {
  sourceBytes: Buffer;
  plan: PreSurgeryGraftPlan;
  mode: PreSurgeryProjectionMode;
  annotations: ClinicalImageAnnotation[];
}): Promise<TreatmentMaskBuildResult> {
  const { createHash } = await import("node:crypto");
  const meta = await sharp(input.sourceBytes).metadata();
  const widthPx = meta.width ?? 0;
  const heightPx = meta.height ?? 0;
  if (widthPx < 256 || heightPx < 256) {
    throw new Error("Source image too small to build treatment mask");
  }

  const allocation = deriveProjectionModeAllocation(input.plan, input.mode);
  const approvedAnns = input.annotations.filter((a) => a.approved && !a.deletedAt);
  const zonesIncluded: string[] = [];
  const paths: string[] = [];

  for (const z of allocation.zoneGraftTargets) {
    if (z.priority === "defer" || z.grafts <= 0) continue;
    const matching = approvedAnns.find((a) => {
      if (a.coordinates.length < 3 || a.geometryType === "point") return false;
      if (a.annotationType === z.zone) return true;
      if (
        (z.zone === "hairline" || z.zone === "frontal" || z.zone === "frontal_third") &&
        (a.annotationType === "frontal_tuft" || a.annotationType === "recipient_zone")
      ) {
        return a.geometryType === "polygon";
      }
      if ((z.zone === "temple_left" || z.zone === "left_temple") && a.annotationType === "temple_left")
        return true;
      if ((z.zone === "temple_right" || z.zone === "right_temple") && a.annotationType === "temple_right")
        return true;
      if (z.zone === "mid_scalp" && a.annotationType === "mid_scalp") return true;
      if (z.zone === "crown" && a.annotationType === "crown") return true;
      if (a.annotationType === "recipient_zone" && a.geometryType === "polygon") return true;
      return false;
    });
    const ptsRaw =
      matching && matching.coordinates.length >= 3
        ? matching.coordinates.map((c) => ({ x: c.x * widthPx, y: c.y * heightPx }))
        : defaultZonePolygon(z.zone, widthPx, heightPx);
    const pts = clampPolygonToScalp(ptsRaw, heightPx);
    const path = pointsToSvgPath(pts, true);
    if (!path) continue;
    zonesIncluded.push(z.zone);
    // White fill with alpha 0 elsewhere — we draw opaque white then invert alpha for OpenAI:
    // OpenAI: transparent areas indicate where image should be edited.
    paths.push(`<path d="${path}" fill="#ffffff" fill-opacity="1"/>`);
  }

  // Soften hairline leading edge band into the editable region.
  const hairline = approvedAnns.find(
    (a) => a.annotationType === "proposed_hairline" || a.annotationType === "existing_hairline"
  );
  if (hairline && hairline.coordinates.length >= 2) {
    const pts = clampPolygonToScalp(
      hairline.coordinates.map((c) => ({
        x: c.x * widthPx,
        y: c.y * heightPx,
      })),
      heightPx
    );
    const path = pointsToSvgPath(pts, false);
    paths.push(
      `<path d="${path}" fill="none" stroke="#ffffff" stroke-width="${Math.max(18, Math.round(heightPx * 0.015))}" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }

  // Start fully opaque black (preserve), punch white holes (will become transparent = editable).
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="#000000"/>
  ${paths.join("\n  ")}
</svg>`;

  const composed = await sharp(input.sourceBytes)
    .rotate()
    .ensureAlpha()
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = composed;
  const w = info.width;
  const h = info.height;
  const channels = info.channels;
  // Convert: white-ish composite pixels → alpha 0 (edit); black → alpha 255 (preserve).
  const rgba = Buffer.alloc(w * h * 4);
  let editablePixelCount = 0;
  for (let i = 0, p = 0; i < w * h; i++, p += channels) {
    const r = data[p] ?? 0;
    const g = data[p + 1] ?? 0;
    const b = data[p + 2] ?? 0;
    const luminance = (r + g + b) / 3;
    const editable = luminance > 40;
    rgba[i * 4] = 0;
    rgba[i * 4 + 1] = 0;
    rgba[i * 4 + 2] = 0;
    rgba[i * 4 + 3] = editable ? 0 : 255;
    if (editable) editablePixelCount += 1;
  }

  // Soft alpha edge for OpenAI mask guidance (API adherence is soft).
  const softSigma = Math.max(2, Math.round(h * 0.004));
  const alphaChannel = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) alphaChannel[i] = rgba[i * 4 + 3] ?? 255;
  const blurredAlpha = await sharp(alphaChannel, {
    raw: { width: w, height: h, channels: 1 },
  })
    .blur(softSigma)
    .raw()
    .toBuffer();

  const softRgba = Buffer.from(rgba);
  let softEditable = 0;
  for (let i = 0; i < w * h; i++) {
    const a = blurredAlpha[i] ?? 255;
    softRgba[i * 4 + 3] = a;
    if (a < 128) softEditable += 1;
  }

  const hardMaskPng = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
  const maskPng = await sharp(softRgba, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();

  return {
    maskPng,
    hardMaskPng,
    widthPx: w,
    heightPx: h,
    maskChecksum: createHash("sha256").update(maskPng).digest("hex"),
    hardMaskChecksum: createHash("sha256").update(hardMaskPng).digest("hex"),
    editablePixelCount: softEditable || editablePixelCount,
    totalPixelCount: w * h,
    zonesIncluded,
  };
}
