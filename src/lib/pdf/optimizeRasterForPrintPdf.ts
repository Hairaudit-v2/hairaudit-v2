import sharp, { type Metadata } from "sharp";
import { pdfEnvConfig } from "@/lib/pdf/pdfEnvConfig";

export type PrintRasterStats = {
  bytesIn: number;
  bytesOut: number;
  format: "jpeg" | "png" | "webp" | "gif";
  /** True when original dimensions were already within max edge and buffer was passed through without re-encode. */
  skippedReencode?: boolean;
};

function readJpegQualityOverride(): number | null {
  return pdfEnvConfig.getPrintJpegQualityOverride();
}

/**
 * JPEG quality from longest edge before resize (harsher compression for very large sources).
 */
function adaptiveJpegQuality(maxDim: number): number {
  if (maxDim > 1500) return 77;
  if (maxDim >= 800) return 82;
  return 87;
}

function passthroughMimeAndFormat(meta: Metadata): { mime: string; format: PrintRasterStats["format"] } {
  const f = String(meta.format ?? "").toLowerCase();
  const hasAlpha = Boolean(meta.hasAlpha);
  if (hasAlpha || f === "png") return { mime: "image/png", format: "png" };
  if (f === "webp") return { mime: "image/webp", format: "webp" };
  if (f === "gif") return { mime: "image/gif", format: "gif" };
  return { mime: "image/jpeg", format: "jpeg" };
}

/**
 * Downscale and re-encode rasters for embedding in Playwright-generated audit PDFs.
 * Skips resize/recompression when longest edge is already ≤ PDF_PRINT_IMAGE_MAX_EDGE (reduces CPU).
 */
export async function optimizeRasterBufferForPrintPdf(buffer: Buffer): Promise<(PrintRasterStats & { dataUrl: string }) | null> {
  const bytesIn = buffer.length;
  if (bytesIn === 0) return null;

  try {
    const maxEdge = pdfEnvConfig.getPrintImageMaxEdge();
    const meta = await sharp(buffer).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const maxDim = Math.max(w, h);
    const hasAlpha = Boolean(meta.hasAlpha);

    const overrideQ = readJpegQualityOverride();
    const jpegQ = overrideQ ?? (maxDim > 0 ? adaptiveJpegQuality(maxDim) : 82);

    if (maxDim > 0 && maxDim <= maxEdge) {
      const { mime, format: fmt } = passthroughMimeAndFormat(meta);
      const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      return {
        dataUrl,
        bytesIn,
        bytesOut: bytesIn,
        format: fmt,
        skippedReencode: true,
      };
    }

    let pipeline = sharp(buffer).rotate();
    pipeline = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    });

    let out: Buffer;
    let format: "jpeg" | "png";
    if (hasAlpha) {
      out = await pipeline.png({ compressionLevel: 9, effort: 7 }).toBuffer();
      format = "png";
    } else {
      out = await pipeline.jpeg({ quality: jpegQ, mozjpeg: true }).toBuffer();
      format = "jpeg";
    }

    const dataUrl = `data:image/${format};base64,${out.toString("base64")}`;
    return { dataUrl, bytesIn, bytesOut: out.length, format, skippedReencode: false };
  } catch (e) {
    console.warn("[pdf-print] raster optimize failed", (e as Error)?.message ?? e);
    return null;
  }
}
