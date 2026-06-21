/**
 * XMLHttpRequest upload helper — fetch does not expose upload progress in all browsers.
 */

export type UploadProgressJson = {
  ok?: boolean;
  error?: string;
  code?: string;
  saved?: unknown[];
  savedCount?: number;
  errors?: Array<{ file?: string; error?: string; code?: string }>;
  requestId?: string;
  durationMs?: number;
};

export function uploadFormDataWithProgress(
  url: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<{ ok: boolean; status: number; json: UploadProgressJson }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      } else if (event.loaded > 0) {
        onProgress(50);
      }
    };

    xhr.onload = () => {
      let json: UploadProgressJson = {};
      try {
        json = JSON.parse(xhr.responseText) as UploadProgressJson;
      } catch {
        json = { error: "Invalid server response" };
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json });
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(formData);
  });
}
