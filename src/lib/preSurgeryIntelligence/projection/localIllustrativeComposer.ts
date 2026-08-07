/**
 * HA-PRE-SURGERY-PROJECTION-REAL-ASSET-1A — Deterministic local illustrative image composer.
 *
 * Produces a real JPEG planning aid from the source photograph + approved plan/annotations.
 * This is not a photoreal neural predictor; it composites soft recipient fills and hairline
 * guidance so clinicians can review proposed coverage against the source view.
 */

import { createHash } from "node:crypto";
import sharp from "sharp";
import type {
  ClinicalImageAnnotation,
  PreSurgeryGraftPlan,
  PreSurgeryProjectionMode,
} from "../types";
import { deriveProjectionModeAllocation } from "./modes";

export type LocalIllustrativeComposeInput = {
  sourceBytes: Buffer;
  caseId: string;
  mode: PreSurgeryProjectionMode;
  plan: PreSurgeryGraftPlan;
  annotations: ClinicalImageAnnotation[];
  engineVersion: string;
  inputChecksum: string;
};

export type LocalIllustrativeComposeResult = {
  bytes: Buffer;
  mimeType: "image/jpeg";
  widthPx: number;
  heightPx: number;
  outputChecksum: string;
  extension: "jpg";
};

const MODE_OPACITY: Record<PreSurgeryProjectionMode, number> = {
  conservative: 0.28,
  planned: 0.38,
  optimistic_within_approved_range: 0.48,
};

const ZONE_COLOURS: Record<string, string> = {
  hairline: "#1a3a2a",
  frontal: "#1a3a2a",
  temple_left: "#243d30",
  temple_right: "#243d30",
  mid_scalp: "#2a4535",
  crown: "#314a3c",
  frontal_tuft: "#1f4030",
  forelock: "#1f4030",
};

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function defaultZonePolygon(
  zone: string,
  w: number,
  h: number
): Array<{ x: number; y: number }> {
  // Normalised fallbacks when no approved annotation polygon exists yet.
  // Anchored to the upper scalp / forehead — never the mid-face or chin.
  switch (zone) {
    case "hairline":
    case "frontal":
    case "frontal_third":
    case "frontal_tuft":
    case "forelock":
      return [
        { x: 0.22 * w, y: 0.12 * h },
        { x: 0.78 * w, y: 0.12 * h },
        { x: 0.74 * w, y: 0.28 * h },
        { x: 0.26 * w, y: 0.28 * h },
      ];
    case "temple_left":
    case "left_temple":
      return [
        { x: 0.06 * w, y: 0.18 * h },
        { x: 0.24 * w, y: 0.16 * h },
        { x: 0.22 * w, y: 0.34 * h },
        { x: 0.08 * w, y: 0.36 * h },
      ];
    case "temple_right":
    case "right_temple":
      return [
        { x: 0.76 * w, y: 0.16 * h },
        { x: 0.94 * w, y: 0.18 * h },
        { x: 0.92 * w, y: 0.36 * h },
        { x: 0.78 * w, y: 0.34 * h },
      ];
    case "mid_scalp":
      return [
        { x: 0.28 * w, y: 0.22 * h },
        { x: 0.72 * w, y: 0.22 * h },
        { x: 0.7 * w, y: 0.38 * h },
        { x: 0.3 * w, y: 0.38 * h },
      ];
    case "crown":
      return [
        { x: 0.34 * w, y: 0.32 * h },
        { x: 0.66 * w, y: 0.32 * h },
        { x: 0.64 * w, y: 0.48 * h },
        { x: 0.36 * w, y: 0.48 * h },
      ];
    default:
      return [
        { x: 0.3 * w, y: 0.14 * h },
        { x: 0.7 * w, y: 0.14 * h },
        { x: 0.68 * w, y: 0.3 * h },
        { x: 0.32 * w, y: 0.3 * h },
      ];
  }
}

function pointsToSvg(
  pts: Array<{ x: number; y: number }>,
  closed: boolean
): string {
  if (pts.length === 0) return "";
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  return closed ? `${d} Z` : d;
}

export async function composeLocalIllustrativeProjection(
  input: LocalIllustrativeComposeInput
): Promise<LocalIllustrativeComposeResult> {
  const meta = await sharp(input.sourceBytes).metadata();
  const widthPx = meta.width ?? 0;
  const heightPx = meta.height ?? 0;
  if (widthPx < 256 || heightPx < 256) {
    throw new Error("Source image dimensions are below the 256px minimum for projection");
  }

  const allocation = deriveProjectionModeAllocation(input.plan, input.mode);
  const opacity = MODE_OPACITY[input.mode];
  const approvedAnns = input.annotations.filter((a) => a.approved && !a.deletedAt);

  const overlayPaths: string[] = [];

  for (const z of allocation.zoneGraftTargets) {
    if (z.priority === "defer" || z.grafts <= 0) continue;
    const matching = approvedAnns.find((a) => {
      if (a.coordinates.length < 3 || a.geometryType === "point") return false;
      if (a.annotationType === z.zone) return true;
      if (
        (z.zone === "hairline" || z.zone === "frontal" || z.zone === "frontal_third") &&
        a.annotationType === "frontal_tuft"
      ) {
        return a.geometryType === "polygon";
      }
      if (
        (z.zone === "temple_left" || z.zone === "left_temple") &&
        a.annotationType === "temple_left"
      ) {
        return true;
      }
      if (
        (z.zone === "temple_right" || z.zone === "right_temple") &&
        a.annotationType === "temple_right"
      ) {
        return true;
      }
      if (z.zone === "mid_scalp" && a.annotationType === "mid_scalp") return true;
      if (z.zone === "crown" && a.annotationType === "crown") return true;
      return false;
    });
    const pts =
      matching && matching.coordinates.length >= 3
        ? matching.coordinates.map((c) => ({ x: c.x * widthPx, y: c.y * heightPx }))
        : defaultZonePolygon(z.zone, widthPx, heightPx);
    const colour = ZONE_COLOURS[z.zone] ?? "#2a4535";
    const path = pointsToSvg(pts, true);
    if (!path) continue;
    overlayPaths.push(
      `<path d="${path}" fill="${colour}" fill-opacity="${opacity}" stroke="${colour}" stroke-opacity="0.75" stroke-width="2"/>`
    );
  }

  const hairline = approvedAnns.find(
    (a) => a.annotationType === "proposed_hairline" || a.annotationType === "existing_hairline"
  );
  if (hairline && hairline.coordinates.length >= 2) {
    const pts = hairline.coordinates.map((c) => ({
      x: c.x * widthPx,
      y: c.y * heightPx,
    }));
    const path = pointsToSvg(pts, false);
    overlayPaths.push(
      `<path d="${path}" fill="none" stroke="#0f766e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  } else {
    // Default proposed hairline arc for frontal planning views.
    const path = pointsToSvg(
      [
        { x: 0.2 * widthPx, y: 0.2 * heightPx },
        { x: 0.35 * widthPx, y: 0.16 * heightPx },
        { x: 0.5 * widthPx, y: 0.14 * heightPx },
        { x: 0.65 * widthPx, y: 0.16 * heightPx },
        { x: 0.8 * widthPx, y: 0.2 * heightPx },
      ],
      false
    );
    overlayPaths.push(
      `<path d="${path}" fill="none" stroke="#0f766e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8 6"/>`
    );
  }

  const bannerH = Math.max(36, Math.round(heightPx * 0.055));
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}" xmlns="http://www.w3.org/2000/svg">
  ${overlayPaths.join("\n  ")}
  <rect x="0" y="${heightPx - bannerH}" width="${widthPx}" height="${bannerH}" fill="#0b1220" fill-opacity="0.72"/>
  <text x="16" y="${heightPx - Math.round(bannerH * 0.38)}" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="${Math.max(12, Math.round(bannerH * 0.38))}">
    ${escXml("Illustrative planning aid — not a guaranteed outcome")} · plan v${input.plan.version} · ${escXml(input.mode)}
  </text>
</svg>`;

  const base = sharp(input.sourceBytes).rotate().ensureAlpha();
  const composed = await base
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const outMeta = await sharp(composed).metadata();
  const outW = outMeta.width ?? widthPx;
  const outH = outMeta.height ?? heightPx;
  const outputChecksum = createHash("sha256").update(composed).digest("hex");

  return {
    bytes: composed,
    mimeType: "image/jpeg",
    widthPx: outW,
    heightPx: outH,
    outputChecksum,
    extension: "jpg",
  };
}
