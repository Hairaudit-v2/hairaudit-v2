/**
 * Byte-level validation for uploaded images (JPEG / PNG / WebP only).
 * Never trusts browser `File.type` or filename extension alone.
 *
 * @see docs/stage1d-upload-validation-hardening.md
 */

import sharp, { type Metadata } from "sharp";
import type { UploadError } from "@/lib/uploads/safeUpload";
import { createUploadError } from "@/lib/uploads/safeUpload";
import {
  MAX_IMAGE_DIMENSION_PX,
  MAX_IMAGE_UPLOAD_BYTES,
} from "@/lib/uploads/uploadLimits";

export type DetectedImageKind = "jpeg" | "png" | "webp" | "unknown";

const JPEG = [0xff, 0xd8, 0xff] as const;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

function readU32LE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] ?? 0) |
    ((buf[offset + 1] ?? 0) << 8) |
    ((buf[offset + 2] ?? 0) << 16) |
    ((buf[offset + 3] ?? 0) << 24)
  );
}

/** Inspect leading bytes only (no Sharp). */
export function detectActualFileType(buffer: Uint8Array | Buffer): DetectedImageKind {
  const b = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  if (b.length < 12) return "unknown";
  if (b[0] === JPEG[0] && b[1] === JPEG[1] && b[2] === JPEG[2]) return "jpeg";
  let isPng = true;
  for (let i = 0; i < PNG.length; i++) {
    if (b[i] !== PNG[i]) {
      isPng = false;
      break;
    }
  }
  if (isPng) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
    const riffSize = readU32LE(b, 4);
    if (8 + riffSize <= b.length && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
      return "webp";
    }
    if (b.length >= 12 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  }
  return "unknown";
}

/** True when buffer has JPEG / PNG / WebP signature at offset 0. */
export function validateImageMagicBytes(buffer: Uint8Array | Buffer): boolean {
  const k = detectActualFileType(buffer);
  return k === "jpeg" || k === "png" || k === "webp";
}

/** Rejects obvious SVG / XML uploads (including UTF-8 BOM + whitespace). */
export function rejectSvgUploads(buffer: Uint8Array | Buffer): boolean {
  const b = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  const n = Math.min(b.length, 8192);
  if (n < 4) return false;
  let start = 0;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) start = 3;
  while (start < n && (b[start] === 0x20 || b[start] === 0x09 || b[start] === 0x0a || b[start] === 0x0d)) start++;
  const slice = b.subarray(start, n).toString("utf8").toLowerCase();
  return slice.includes("<svg") || slice.includes("<?xml");
}

/** Blocks common non-image carriers (exe, zip, pdf, ELF). */
export function rejectUnknownBinary(buffer: Uint8Array | Buffer): boolean {
  const b = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  if (b.length < 4) return true;
  if (b[0] === 0x4d && b[1] === 0x5a) return true;
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) return true;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return true;
  if (b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46) return true;
  return false;
}

export function enforceMaxFileSize(sizeBytes: number, maxBytes: number = MAX_IMAGE_UPLOAD_BYTES): UploadError | null {
  if (sizeBytes > maxBytes) {
    return createUploadError(
      "FILE_TOO_LARGE",
      `File exceeds maximum size of ${Math.round(maxBytes / (1024 * 1024))}MB`,
      { sizeBytes, maxBytes }
    );
  }
  return null;
}

/** Map Sharp / magic kind to a single storage Content-Type. */
export function normalizeAcceptedMimeType(
  detected: DetectedImageKind,
  _declaredMime?: string | null
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (detected === "jpeg") return "image/jpeg";
  if (detected === "png") return "image/png";
  if (detected === "webp") return "image/webp";
  return null;
}

export type ImageDimensionResult =
  | { ok: true; width: number; height: number }
  | { ok: false; error: UploadError };

export async function validateImageDimensions(buffer: Buffer): Promise<ImageDimensionResult> {
  let meta: Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    return {
      ok: false,
      error: createUploadError("VALIDATION_ERROR", "File is not a valid image"),
    };
  }
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    return {
      ok: false,
      error: createUploadError("VALIDATION_ERROR", "Could not read image dimensions"),
    };
  }
  if (w > MAX_IMAGE_DIMENSION_PX || h > MAX_IMAGE_DIMENSION_PX) {
    return {
      ok: false,
      error: createUploadError(
        "VALIDATION_ERROR",
        `Image is too large (${w}×${h}px). Maximum dimension is ${MAX_IMAGE_DIMENSION_PX}px.`
      ),
    };
  }
  return { ok: true, width: w, height: h };
}

export type ValidatedImage =
  | { ok: true; buffer: Buffer; normalizedMime: "image/jpeg" | "image/png" | "image/webp"; width: number; height: number }
  | { ok: false; error: UploadError };

/**
 * Full server-side image validation for a browser `File`.
 * Uses magic bytes + Sharp decode (rejects polyglots that are not decodable raster images).
 */
export async function validateUploadedImage(
  file: File,
  opts?: { maxBytes?: number }
): Promise<ValidatedImage> {
  const maxBytes = opts?.maxBytes ?? MAX_IMAGE_UPLOAD_BYTES;
  const sizeErr = enforceMaxFileSize(file.size, maxBytes);
  if (sizeErr) return { ok: false, error: sizeErr };

  const buffer = Buffer.from(await file.arrayBuffer());

  if (rejectUnknownBinary(buffer)) {
    return {
      ok: false,
      error: createUploadError("VALIDATION_ERROR", "Unsupported or unsafe file type"),
    };
  }
  if (rejectSvgUploads(buffer)) {
    return { ok: false, error: createUploadError("VALIDATION_ERROR", "SVG uploads are not allowed") };
  }
  if (!validateImageMagicBytes(buffer)) {
    return {
      ok: false,
      error: createUploadError("VALIDATION_ERROR", "File must be a JPEG, PNG, or WebP image"),
    };
  }

  const magicKind = detectActualFileType(buffer);
  const normalizedMime = normalizeAcceptedMimeType(magicKind);
  if (!normalizedMime) {
    return { ok: false, error: createUploadError("VALIDATION_ERROR", "Unrecognized image format") };
  }

  let meta: Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    return { ok: false, error: createUploadError("VALIDATION_ERROR", "File is not a valid image") };
  }

  const fmt = meta.format;
  if (fmt !== "jpeg" && fmt !== "png" && fmt !== "webp") {
    return {
      ok: false,
      error: createUploadError("VALIDATION_ERROR", "Only JPEG, PNG, and WebP images are allowed"),
    };
  }

  if (magicKind === "jpeg" && fmt !== "jpeg") {
    return { ok: false, error: createUploadError("VALIDATION_ERROR", "Image content does not match declared type") };
  }
  if (magicKind === "png" && fmt !== "png") {
    return { ok: false, error: createUploadError("VALIDATION_ERROR", "Image content does not match declared type") };
  }
  if (magicKind === "webp" && fmt !== "webp") {
    return { ok: false, error: createUploadError("VALIDATION_ERROR", "Image content does not match declared type") };
  }

  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) {
    return {
      ok: false,
      error: createUploadError("VALIDATION_ERROR", "Could not read image dimensions"),
    };
  }
  if (w > MAX_IMAGE_DIMENSION_PX || h > MAX_IMAGE_DIMENSION_PX) {
    return {
      ok: false,
      error: createUploadError(
        "VALIDATION_ERROR",
        `Image is too large (${w}×${h}px). Maximum dimension is ${MAX_IMAGE_DIMENSION_PX}px.`
      ),
    };
  }

  return {
    ok: true,
    buffer,
    normalizedMime,
    width: w,
    height: h,
  };
}
