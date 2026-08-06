/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Server-side media resolution for report/PDF.
 * Never regenerates projection imagery; never exposes permanent public URLs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { storagePathBelongsToCase } from "@/lib/uploads/caseFilesPath";
import type { IllustrativeProjectedResultSection } from "./reportProjectionInclusion";
import type { PreSurgeryIllustrativeProjection } from "./types";
import { loadWorkspaceBundle } from "./repository.server";

async function signedUrlForCasePath(
  supabase: SupabaseClient,
  bucket: string,
  path: string | null | undefined,
  caseId: string,
  expiresSec = 60 * 10
): Promise<string | null> {
  const p = String(path ?? "").trim();
  if (!p) return null;
  if (!storagePathBelongsToCase(caseId, p)) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(p, expiresSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Resolve storage paths for an illustrative projection already frozen into a report section.
 * Verifies case ownership via workspace load; fails closed on mismatch.
 */
export async function resolveIllustrativeProjectionMediaPaths(input: {
  admin: SupabaseClient;
  caseId: string;
  section: IllustrativeProjectedResultSection | null | undefined;
  /** Optional upload id → path map when source is a case upload. */
  uploadPathById?: Record<string, string | null>;
}): Promise<{
  sourceStoragePath: string | null;
  projectedStoragePath: string | null;
  projection: PreSurgeryIllustrativeProjection | null;
}> {
  const section = input.section;
  if (!section?.showImagery || !section.projectionSnapshotId) {
    return { sourceStoragePath: null, projectedStoragePath: null, projection: null };
  }

  const bundle = await loadWorkspaceBundle(input.admin, input.caseId);
  const projection =
    bundle.projections.find((p) => p.id === section.projectionSnapshotId) ?? null;

  if (!projection || projection.caseId !== input.caseId) {
    return { sourceStoragePath: null, projectedStoragePath: null, projection: null };
  }

  // Prefer frozen snapshot identity — reject if report pin doesn't match loaded row.
  if (section.inputChecksum && projection.inputChecksum !== section.inputChecksum) {
    return { sourceStoragePath: null, projectedStoragePath: null, projection: null };
  }

  const projectedStoragePath =
    projection.storagePath && storagePathBelongsToCase(input.caseId, projection.storagePath)
      ? projection.storagePath
      : null;

  const sourceFromUpload =
    input.uploadPathById?.[projection.sourceImageId] ??
    section.media?.sourceStoragePath ??
    null;
  const sourceStoragePath =
    sourceFromUpload && storagePathBelongsToCase(input.caseId, sourceFromUpload)
      ? sourceFromUpload
      : null;

  return { sourceStoragePath, projectedStoragePath, projection };
}

export async function signIllustrativeProjectionMedia(input: {
  admin: SupabaseClient;
  bucket: string;
  caseId: string;
  section: IllustrativeProjectedResultSection | null | undefined;
  uploadPathById?: Record<string, string | null>;
}): Promise<{ sourceImageUrl: string | null; projectedImageUrl: string | null }> {
  const paths = await resolveIllustrativeProjectionMediaPaths(input);
  const [sourceImageUrl, projectedImageUrl] = await Promise.all([
    signedUrlForCasePath(input.admin, input.bucket, paths.sourceStoragePath, input.caseId),
    signedUrlForCasePath(input.admin, input.bucket, paths.projectedStoragePath, input.caseId),
  ]);
  return { sourceImageUrl, projectedImageUrl };
}
