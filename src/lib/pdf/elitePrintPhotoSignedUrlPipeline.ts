import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaseEvidenceManifest } from "@/lib/evidence/evidenceManifest";
import { inferCanonicalPhotoCategory, photoCategoryGroup } from "@/lib/photos/classification";

export type ElitePrintPhotoStats = {
  imageCount: number;
  sourceBytesTotal: number;
  optimizedBytesTotal: number;
  fallbackToSignedUrlCount: number;
  imagesSkippedReencode: number;
  imagesProcessedFull: number;
  imagesTruncated: number;
};

type Row = { storagePath: string; label: string; categoryKey: string };

async function signedUrlForPath(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) {
    console.error("[pdf-print] signed url error:", error?.message ?? "unknown");
    return null;
  }
  return data.signedUrl;
}

const CHUNK = 8;

async function mapChunked<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    out.push(...(await Promise.all(slice.map(fn))));
  }
  return out;
}

export async function buildElitePrintPhotosByCategorySignedUrl(params: {
  supabase: SupabaseClient;
  bucket: string;
  caseId: string;
  manifest: CaseEvidenceManifest | null;
  maxImagesPerSection?: number | null;
}): Promise<{
  photosByCategory: Record<string, { signedUrl: string | null; label: string }[]>;
  stats: ElitePrintPhotoStats;
}> {
  const { supabase, bucket, caseId, manifest, maxImagesPerSection = null } = params;
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
  if (maxImagesPerSection != null) {
    const perCat: Record<string, number> = {};
    const limited: Row[] = [];
    for (const row of rows) {
      const c = row.categoryKey;
      perCat[c] = perCat[c] ?? 0;
      if (perCat[c] >= maxImagesPerSection) {
        imagesTruncated += 1;
        continue;
      }
      perCat[c] += 1;
      limited.push(row);
    }
    rows = limited;
  }

  const resolved = await mapChunked(rows, async (row) => ({
    categoryKey: row.categoryKey,
    label: row.label,
    signedUrl: await signedUrlForPath(supabase, bucket, row.storagePath),
  }));

  const photosByCategory: Record<string, { signedUrl: string | null; label: string }[]> = {};
  for (const r of resolved) {
    if (!r.signedUrl) continue;
    photosByCategory[r.categoryKey] = photosByCategory[r.categoryKey] || [];
    photosByCategory[r.categoryKey].push({
      signedUrl: r.signedUrl,
      label: r.label,
    });
  }

  return {
    photosByCategory,
    stats: {
      imageCount: resolved.filter((r) => r.signedUrl).length,
      sourceBytesTotal: 0,
      optimizedBytesTotal: 0,
      fallbackToSignedUrlCount: resolved.filter((r) => r.signedUrl).length,
      imagesSkippedReencode: 0,
      imagesProcessedFull: 0,
      imagesTruncated,
    },
  };
}
