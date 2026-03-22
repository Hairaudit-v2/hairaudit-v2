import type { SupabaseClient } from "@supabase/supabase-js";

type StorageLike = SupabaseClient["storage"];

type Ok = { arrayBuffer: ArrayBuffer; storagePath: string };
type Err = { error: string };

/**
 * Load PDF bytes from the case-files bucket using the same primary + fallback keys as signed-url.
 */
export async function fetchReportPdfFromStorage(
  storage: StorageLike,
  bucket: string,
  pdfPath: string
): Promise<Ok | Err> {
  const tryPath = async (path: string): Promise<Ok | Err> => {
    const { data, error } = await storage.from(bucket).download(path);
    if (error || !data) return { error: error?.message ?? "download failed" };
    const arrayBuffer = await data.arrayBuffer();
    return { arrayBuffer, storagePath: path };
  };

  const primary = await tryPath(pdfPath);
  if ("arrayBuffer" in primary) return primary;

  const parts = pdfPath.split("/");
  if (parts.length === 2 && parts[1]?.startsWith("v") && parts[1]?.endsWith(".pdf")) {
    const altPath = `cases/${parts[0]}/reports/${parts[1]}`;
    const fallback = await tryPath(altPath);
    if ("arrayBuffer" in fallback) return fallback;
  }

  console.error("[reports/pdf-storage] download failed", { pdfPath, bucket, message: primary.error });
  return { error: primary.error };
}
