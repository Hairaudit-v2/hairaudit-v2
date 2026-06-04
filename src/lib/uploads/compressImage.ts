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

/**
 * Compress a single image file for upload. Always resolves to a File — the original
 * is returned unchanged when compression is impossible, unnecessary, or unhelpful.
 */
export async function compressImageForUpload(
  file: File,
  options?: CompressImageOptions
): Promise<File> {
  const opts = { ...DEFAULTS, ...(options ?? {}) };

  if (!canCompress(file)) return file;

  const source = await decode(file);
  if (!source) return file; // Undecodable (e.g. HEIC on some platforms) — keep original.

  try {
    const { w, h } = dimensionsOf(source);
    if (!w || !h) return file;

    const longest = Math.max(w, h);
    const scale = longest > opts.maxEdge ? opts.maxEdge / longest : 1;

    // Already small and no resize needed → don't re-encode (avoids quality loss).
    if (scale === 1 && file.size <= opts.skipBelowBytes) return file;

    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(source as CanvasImageSource, 0, 0, targetW, targetH);

    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const outExt = outType === "image/png" ? "png" : "jpg";

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, outType === "image/jpeg" ? opts.quality : undefined)
    );

    if (!blob) return file;
    // Only adopt the compressed version when it's genuinely smaller.
    if (blob.size >= file.size) return file;

    return new File([blob], renamed(file.name || "photo", outExt), {
      type: outType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
      source.close();
    }
  }
}
