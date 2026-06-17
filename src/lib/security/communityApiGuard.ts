import { NextResponse } from "next/server";

/** Public community feature limits — defense in depth before service-role writes. */
export const COMMUNITY_MAX_IMAGES = 6;
export const COMMUNITY_MAX_REQUEST_BYTES = 5 * 1024 * 1024;
export const COMMUNITY_MAX_IMAGE_DATA_BYTES = 4 * 1024 * 1024;

export function estimateDataUrlBytes(dataUrls: string[]): number {
  return dataUrls.reduce((sum, url) => sum + url.length, 0);
}

/**
 * Rejects oversized community write payloads before hitting the database.
 * Returns a NextResponse when blocked, or null when allowed.
 */
export function guardCommunityWritePayload(req: Request, imageDataUrls: string[]): NextResponse | null {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > COMMUNITY_MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, error: "Request too large." }, { status: 413 });
  }

  if (imageDataUrls.length > COMMUNITY_MAX_IMAGES) {
    return NextResponse.json({ ok: false, error: "Too many images." }, { status: 400 });
  }

  const imageBytes = estimateDataUrlBytes(imageDataUrls);
  if (imageBytes > COMMUNITY_MAX_IMAGE_DATA_BYTES) {
    return NextResponse.json({ ok: false, error: "Images exceed size limit." }, { status: 413 });
  }

  return null;
}

/** Ensures rating mutations target published community cases only (caller still validates row). */
export function guardCommunityRatingValues(args: {
  naturalness: number | null;
  density: number | null;
  hairlineDesign: number | null;
}): NextResponse | null {
  if (!args.naturalness || !args.density || !args.hairlineDesign) {
    return NextResponse.json({ ok: false, error: "Ratings must be between 1 and 5." }, { status: 400 });
  }
  return null;
}
