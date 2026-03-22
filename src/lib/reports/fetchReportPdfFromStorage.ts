import type { SupabaseClient } from "@supabase/supabase-js";

type StorageLike = SupabaseClient["storage"];

type Ok = { blob: Blob; storagePath: string };
type Err = { error: string };

/**
 * Load PDF from the case-files bucket using the same primary + fallback keys as signed-url.
 * Returns a Blob so callers can stream the body without an extra full-file ArrayBuffer copy.
 */
export async function fetchReportPdfFromStorage(
  storage: StorageLike,
  bucket: string,
  pdfPath: string
): Promise<Ok | Err> {
  const tryPath = async (path: string): Promise<Ok | Err> => {
    const { data, error } = await storage.from(bucket).download(path);
    if (error || !data) return { error: error?.message ?? "download failed" };
    return { blob: data, storagePath: path };
  };

  const primary = await tryPath(pdfPath);
  if ("blob" in primary) return primary;

  const parts = pdfPath.split("/");
  if (parts.length === 2 && parts[1]?.startsWith("v") && parts[1]?.endsWith(".pdf")) {
    const altPath = `cases/${parts[0]}/reports/${parts[1]}`;
    const fallback = await tryPath(altPath);
    if ("blob" in fallback) return fallback;
  }

  const errMsg = "error" in primary ? primary.error : "download failed";
  console.error("[reports/pdf-storage] download failed", { pdfPath, bucket, message: errMsg });
  return { error: errMsg };
}
