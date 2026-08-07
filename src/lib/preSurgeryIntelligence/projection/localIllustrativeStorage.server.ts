/**
 * HA-PRE-SURGERY-PROJECTION-REAL-ASSET-1A — Bind local illustrative provider to case-files storage.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCaseFilesBucketNameForReadOnlyUse } from "@/lib/hairaudit/uploadStorage";
import {
  createLocalIllustrativePreSurgeryProjectionProvider,
  type LocalIllustrativeStorageDeps,
} from "./localIllustrativeProvider";

export function parseSourceImageStoragePath(sourceImageRef: string): string | null {
  const ref = sourceImageRef.trim();
  if (ref.startsWith("storage:")) {
    const path = ref.slice("storage:".length).trim();
    return path || null;
  }
  // Opaque image:id — caller must resolve via uploads table before binding.
  return null;
}

export function createLocalIllustrativeStorageDeps(args: {
  admin: SupabaseClient;
  /** Optional map imageId → storage_path when sourceImageRef is image:{id}. */
  resolveImageIdToPath?: (imageId: string) => Promise<string | null>;
}): LocalIllustrativeStorageDeps {
  const bucket = getCaseFilesBucketNameForReadOnlyUse();

  return {
    async loadSourceBytes(sourceImageRef) {
      let path = parseSourceImageStoragePath(sourceImageRef);
      if (!path && sourceImageRef.startsWith("image:") && args.resolveImageIdToPath) {
        path = await args.resolveImageIdToPath(sourceImageRef.slice("image:".length));
      }
      if (!path) {
        throw new Error("Source image storage path could not be resolved");
      }
      const { data, error } = await args.admin.storage.from(bucket).download(path);
      if (error || !data) {
        throw new Error(error?.message ?? "Source image download failed");
      }
      const ab = await data.arrayBuffer();
      return Buffer.from(ab);
    },

    async storeOutput(storagePath, bytes, contentType) {
      const { error } = await args.admin.storage.from(bucket).upload(storagePath, bytes, {
        contentType,
        upsert: true,
      });
      if (error) {
        throw new Error(error.message || "Projection asset upload failed");
      }
    },
  };
}

export function createBoundLocalIllustrativeProvider(args: {
  admin: SupabaseClient;
  resolveImageIdToPath?: (imageId: string) => Promise<string | null>;
}) {
  return createLocalIllustrativePreSurgeryProjectionProvider(
    createLocalIllustrativeStorageDeps(args)
  );
}

export async function downloadCaseFilesObject(
  admin: SupabaseClient,
  storagePath: string
): Promise<Buffer | null> {
  const bucket = getCaseFilesBucketNameForReadOnlyUse();
  const { data, error } = await admin.storage.from(bucket).download(storagePath);
  if (error || !data) return null;
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}
