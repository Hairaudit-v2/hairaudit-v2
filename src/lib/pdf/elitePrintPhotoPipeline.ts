import type { SupabaseClient } from "@supabase/supabase-js";
import { inferCanonicalPhotoCategory, photoCategoryGroup } from "@/lib/photos/classification";
import type { CaseEvidenceManifest } from "@/lib/evidence/prepareCaseEvidence";
import { optimizeRasterBufferForPrintPdf } from "@/lib/pdf/optimizeRasterForPrintPdf";
import { pdfEnvConfig } from "@/lib/pdf/pdfEnvConfig";

export type ElitePrintPhotoStats = {
  imageCount: number;
  sourceBytesTotal: number;
  optimizedBytesTotal: number;
  fallbackToSignedUrlCount: number;
  /** Data URLs embedded without Sharp resize/recompress (already within max edge). */
  imagesSkippedReencode: number;
  /** Images run through full Sharp pipeline (resize and/or re-encode). */
  imagesProcessedFull: number;
  /** Dropped by PDF_MAX_IMAGES_PER_SECTION cap. */
  imagesTruncated: number;
};

type Row = { storagePath: string; label: string; categoryKey: string };

type Resolved = {
  categoryKey: string;
  label: string;
  src: string | null;
  /** Bytes read from storage when we downloaded the object (0 if unknown). */
  sourceBytes: number;
  /** Approximate bytes embedded in HTML (data URL payload or same as source for signed-URL fallback). */
  outputBytes: number;
  usedDataUrl: boolean;
  skippedReencode: boolean;
};

function optimizationEnabled(): boolean {
  return pdfEnvConfig.isPrintImageOptimizeEnabled();
}

async function blobToBuffer(data: Blob): Promise<Buffer> {
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

async function signedUrlForPath(supabase: SupabaseClient, bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) {
    console.error("[pdf-print] signed url error:", error?.message ?? "unknown");
    return null;
  }
  return data.signedUrl;
}

async function resolveOneImage(supabase: SupabaseClient, bucket: string, row: Row): Promise<Resolved> {
  const path = row.storagePath;
  if (!path) {
    return {
      categoryKey: row.categoryKey,
      label: row.label,
      src: null,
      sourceBytes: 0,
      outputBytes: 0,
      usedDataUrl: false,
      skippedReencode: false,
    };
  }

  if (!optimizationEnabled()) {
    const url = await signedUrlForPath(supabase, bucket, path);
    return {
      categoryKey: row.categoryKey,
      label: row.label,
      src: url,
      sourceBytes: 0,
      outputBytes: 0,
      usedDataUrl: false,
      skippedReencode: false,
    };
  }

  const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
  if (dlErr || !blob) {
    console.warn("[pdf-print] storage download failed, using signed URL", { path, message: dlErr?.message });
    const url = await signedUrlForPath(supabase, bucket, path);
    return {
      categoryKey: row.categoryKey,
      label: row.label,
      src: url,
      sourceBytes: 0,
      outputBytes: 0,
      usedDataUrl: false,
      skippedReencode: false,
    };
  }

  let buffer: Buffer;
  let sourceBytes: number;
  try {
    buffer = await blobToBuffer(blob);
    sourceBytes = buffer.length;
  } catch (e) {
    console.warn("[pdf-print] blob read failed", (e as Error)?.message);
    const url = await signedUrlForPath(supabase, bucket, path);
    return {
      categoryKey: row.categoryKey,
      label: row.label,
      src: url,
      sourceBytes: 0,
      outputBytes: 0,
      usedDataUrl: false,
      skippedReencode: false,
    };
  }

  const optimized = await optimizeRasterBufferForPrintPdf(buffer);
  if (!optimized) {
    const url = await signedUrlForPath(supabase, bucket, path);
    return {
      categoryKey: row.categoryKey,
      label: row.label,
      src: url,
      sourceBytes,
      outputBytes: sourceBytes,
      usedDataUrl: false,
      skippedReencode: false,
    };
  }

  return {
    categoryKey: row.categoryKey,
    label: row.label,
    src: optimized.dataUrl,
    sourceBytes,
    outputBytes: optimized.bytesOut,
    usedDataUrl: true,
    skippedReencode: Boolean(optimized.skippedReencode),
  };
}

const CHUNK = 4;

async function mapChunked<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    out.push(...(await Promise.all(slice.map(fn))));
  }
  return out;
}

/**
 * Build `photosByCategory` for elite print HTML: optimizes rasters server-side to data URLs
 * when possible, otherwise falls back to signed storage URLs (same as legacy behavior).
 */
export async function buildElitePrintPhotosByCategory(params: {
  supabase: SupabaseClient;
  bucket: string;
  caseId: string;
  manifest: CaseEvidenceManifest | null;
}): Promise<{
  photosByCategory: Record<string, { signedUrl: string | null; label: string }[]>;
  stats: ElitePrintPhotoStats;
}> {
  const { supabase, bucket, caseId, manifest } = params;
  const optOn = optimizationEnabled();
  const pdfInstrumentation = pdfEnvConfig.isInstrumentationEnabled();
  let rows: Row[] = [];

  if (manifest?.prepared_images?.length) {
    for (const item of manifest.prepared_images) {
      const path = String(item.prepared_path ?? "").trim();
      if (!path) continue;
      const canonical = String(item.category ?? "uncategorized");
      const categoryKey = `${photoCategoryGroup(canonical)} - ${canonical.replaceAll("_", " ")}`;
      const label = String(item.category ?? "prepared evidence").replaceAll("_", " ");
      rows.push({ storagePath: path, label, categoryKey });
    }
  } else {
    const { data: uploads, error: upErr } = await supabase
      .from("uploads")
      .select("id, type, storage_path, metadata, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    if (upErr) {
      console.error("[pdf-print] uploads error:", upErr.message);
    }

    const imageUploads = (uploads ?? []).filter((u) => {
      const t = String(u.type ?? "").toLowerCase();
      return (
        t.startsWith("patient_photo:") ||
        t.includes("image") ||
        t.includes("photo") ||
        t.includes("jpg") ||
        t.includes("jpeg") ||
        t.includes("png") ||
        t.includes("webp")
      );
    });

    for (const u of imageUploads) {
      const path = String(u.storage_path ?? "").trim();
      if (!path) continue;
      const canonical = inferCanonicalPhotoCategory(
        u as { type?: string | null; metadata?: Record<string, unknown> | null }
      );
      const categoryKey = `${photoCategoryGroup(canonical)} - ${canonical.replaceAll("_", " ")}`;
      const label =
        String((u as { metadata?: { label?: string } }).metadata?.label ?? "").trim() ||
        String((u as { type?: string }).type ?? "photo");
      rows.push({ storagePath: path, label, categoryKey });
    }
  }

  let imagesTruncated = 0;
  const maxPer = pdfEnvConfig.getMaxImagesPerSection();
  if (maxPer != null) {
    const perCat: Record<string, number> = {};
    const limited: Row[] = [];
    for (const row of rows) {
      const c = row.categoryKey;
      perCat[c] = perCat[c] ?? 0;
      if (perCat[c] >= maxPer) {
        imagesTruncated += 1;
        continue;
      }
      perCat[c] += 1;
      limited.push(row);
    }
    rows = limited;
    if (pdfInstrumentation && imagesTruncated > 0) {
      console.info("[pdf-print] truncated images per category", { imagesTruncated, maxPerSection: maxPer });
    }
  }

  const resolved = await mapChunked(rows, (row) => resolveOneImage(supabase, bucket, row));

  const photosByCategory: Record<string, { signedUrl: string | null; label: string }[]> = {};
  let sourceBytesTotal = 0;
  let optimizedBytesTotal = 0;
  let fallbackToSignedUrlCount = 0;
  let imagesSkippedReencode = 0;
  let imagesProcessedFull = 0;

  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i];
    if (!r?.src) continue;

    if (!r.usedDataUrl && optOn) fallbackToSignedUrlCount += 1;
    if (r.usedDataUrl) {
      if (r.skippedReencode) imagesSkippedReencode += 1;
      else imagesProcessedFull += 1;
    }
    sourceBytesTotal += r.sourceBytes;
    optimizedBytesTotal += r.outputBytes;

    photosByCategory[r.categoryKey] = photosByCategory[r.categoryKey] || [];
    photosByCategory[r.categoryKey].push({ signedUrl: r.src, label: r.label });
  }

  const stats: ElitePrintPhotoStats = {
    imageCount: resolved.filter((r) => r.src).length,
    sourceBytesTotal,
    optimizedBytesTotal,
    fallbackToSignedUrlCount,
    imagesSkippedReencode,
    imagesProcessedFull,
    imagesTruncated,
  };

  return { photosByCategory, stats };
}
