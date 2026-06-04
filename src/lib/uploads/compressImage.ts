// HairAudit Mobile Surgery Upload Portal — Stage 3 client-side image compression.
//
// Phone cameras routinely produce 6–12 MB images, which exceed the portal's
// per-request budget (Vercel ~4.5 MB) and waste bandwidth in a surgery room. This
// helper downsizes large images in the browser BEFORE upload using only the native
// canvas API — no third-party dependencies.
//
// Safety / quality rules:
//  * Only attempts to compress decodable raster images. If the browser cannot decode
//    the file (e.g. some HEIC on desktop), it returns the ORIGINAL file untouched so
//    we never break HEIC / Android camera uploads.
//  * Keeps enough resolution + quality for audit review (default longest edge 2400px,
//    JPEG quality 0.85).
//  * PNG inputs stay PNG (lossless) to preserve diagrams/markings; everything else is
//    encoded as JPEG.
//  * If the compressed result is not actually smaller, the original is kept.

export type CompressImageOptions = {
  /** Longest-edge cap in pixels. Suggested 2200–2600 for audit-grade photos. */
  maxEdge?: number;
  /** JPEG quality 0–1. Suggested 0.82–0.9. */
  quality?: number;
  /** Skip work entirely when the file is already comfortably small. */
  skipBelowBytes?: number;
};

const DEFAULTS: Required<CompressImageOptions> = {
  maxEdge: 2400,
  quality: 0.85,
  skipBelowBytes: 1_200_000, // ~1.2 MB
};

function canCompress(file: File): boolean {
  if (typeof window === "undefined") return false;
  if (typeof document === "undefined") return false;
  return file.type.startsWith("image/");
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  // Prefer createImageBitmap (fast, off-main-thread where supported).
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path (e.g. some browsers/codecs).
    }
  }
  return await new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function dimensionsOf(src: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  if ("width" in src && "height" in src) {
    return { w: (src as { width: number }).width, h: (src as { height: number }).height };
  }
  return { w: 0, h: 0 };
}

function renamed(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "photo"}.${ext}`;
}

// ---------------------------------------------------------------------------
// Stage 3.1 — lightweight (non-AI) quality signal + upload metadata
// ---------------------------------------------------------------------------
// Below this shortest-edge threshold an image is flagged as possibly too low
// resolution for reliable audit review. This NEVER blocks upload — it is purely a
// warning surfaced to the uploader and the reviewer.
export const LOW_RES_MIN_EDGE_PX = 900;
export const LOW_RES_WARNING =
  "This image may be too low resolution for reliable audit review.";

/** Client-derived metadata captured at selection time, attached to the upload. */
export type PreparedImageMeta = {
  /** Original selected filename. */
  originalFilename: string;
  /** Size of the originally selected file, in bytes. */
  originalSizeBytes: number;
  /** Size of the file actually uploaded (compressed when applicable), in bytes. */
  compressedSizeBytes: number;
  /** Original capture width in px (null if it could not be read). */
  width: number | null;
  /** Original capture height in px (null if it could not be read). */
  height: number | null;
  /** True when a smaller, re-encoded copy was adopted for upload. */
  compressionApplied: boolean;
  /** Non-null when the original looked too low-resolution for reliable review. */
  qualityWarning: string | null;
};

export type PreparedImage = {
  file: File;
  meta: PreparedImageMeta;
};

function baseMeta(file: File): PreparedImageMeta {
  return {
    originalFilename: file.name || "photo",
    originalSizeBytes: file.size,
    compressedSizeBytes: file.size,
    width: null,
    height: null,
    compressionApplied: false,
    qualityWarning: null,
  };
}

/**
 * Decode (for dimensions + a low-res signal), then compress when worthwhile, and
 * return BOTH the upload-ready File and the captured metadata. Always resolves —
 * undecodable inputs (e.g. HEIC on some platforms) keep the original file and yield
 * null dimensions with no warning, so uploads never fail on metadata extraction.
 */
export async function prepareImageForUpload(
  file: File,
  options?: CompressImageOptions
): Promise<PreparedImage> {
  const opts = { ...DEFAULTS, ...(options ?? {}) };
  const meta = baseMeta(file);

  if (!canCompress(file)) return { file, meta };

  const source = await decode(file);
  if (!source) return { file, meta }; // Undecodable — keep original, no dimensions.

  try {
    const { w, h } = dimensionsOf(source);
    if (w && h) {
      meta.width = w;
      meta.height = h;
      if (Math.min(w, h) < LOW_RES_MIN_EDGE_PX) {
        meta.qualityWarning = LOW_RES_WARNING;
      }
    }
    if (!w || !h) return { file, meta };

    const longest = Math.max(w, h);
    const scale = longest > opts.maxEdge ? opts.maxEdge / longest : 1;

    // Already small and no resize needed → don't re-encode (avoids quality loss).
    if (scale === 1 && file.size <= opts.skipBelowBytes) return { file, meta };

    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { file, meta };
    ctx.drawImage(source as CanvasImageSource, 0, 0, targetW, targetH);

    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const outExt = outType === "image/png" ? "png" : "jpg";

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, outType === "image/jpeg" ? opts.quality : undefined)
    );

    if (!blob || blob.size >= file.size) return { file, meta };

    const out = new File([blob], renamed(file.name || "photo", outExt), {
      type: outType,
      lastModified: Date.now(),
    });
    meta.compressionApplied = true;
    meta.compressedSizeBytes = out.size;
    return { file: out, meta };
  } catch {
    return { file, meta };
  } finally {
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
      source.close();
    }
  }
}

/**
 * Compress a single image file for upload. Always resolves to a File — the original
 * is returned unchanged when compression is impossible, unnecessary, or unhelpful.
 * Thin wrapper over prepareImageForUpload for callers that only need the File.
 */
export async function compressImageForUpload(
  file: File,
  options?: CompressImageOptions
): Promise<File> {
  return (await prepareImageForUpload(file, options)).file;
}
