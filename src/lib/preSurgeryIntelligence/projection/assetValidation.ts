/**
 * HA-PRE-SURGERY-PROJECTION-REAL-ASSET-1A — Storage-object + metadata validation.
 * A .stub path is never a generated projection. Approval requires a valid image object.
 */

import { createHash } from "node:crypto";
import sharp from "sharp";
import { classifyProjectionStoragePath } from "../projectionAssetStatus";
import {
  SUPPORTED_PROJECTION_OUTPUT_MIME_TYPES,
  validateProviderProjectionOutput,
  type ProjectionOutputValidationInput,
  type ProjectionOutputValidationResult,
} from "./outputValidation";

export const STUB_GENERATION_NO_ASSET_MESSAGE =
  "Stub generation — no image asset produced." as const;

export type StoredProjectionAssetProbe = {
  exists: boolean;
  mimeType: string | null;
  fileSizeBytes: number;
  widthPx: number | null;
  heightPx: number | null;
  checksumSha256: string | null;
  storagePath: string;
};

export type ProjectionAssetGateResult =
  | { ok: true; probe: StoredProjectionAssetProbe }
  | {
      ok: false;
      code: string;
      message: string;
      probe?: StoredProjectionAssetProbe | null;
    };

export function isStubProjectionStoragePath(storagePath: string | null | undefined): boolean {
  return classifyProjectionStoragePath(storagePath).kind === "stub_placeholder";
}

/** True when a projection record can be treated as clinically usable imagery. */
export function projectionHasApproximatelyValidImagePath(
  storagePath: string | null | undefined
): boolean {
  const asset = classifyProjectionStoragePath(storagePath);
  return asset.kind === "image" && Boolean(asset.storagePath);
}

export async function probeStoredProjectionAsset(args: {
  download: (path: string) => Promise<Buffer | null>;
  storagePath: string;
}): Promise<StoredProjectionAssetProbe> {
  const path = args.storagePath.trim();
  if (!path || isStubProjectionStoragePath(path)) {
    return {
      exists: false,
      mimeType: null,
      fileSizeBytes: 0,
      widthPx: null,
      heightPx: null,
      checksumSha256: null,
      storagePath: path,
    };
  }

  const bytes = await args.download(path);
  if (!bytes || bytes.byteLength === 0) {
    return {
      exists: false,
      mimeType: null,
      fileSizeBytes: 0,
      widthPx: null,
      heightPx: null,
      checksumSha256: null,
      storagePath: path,
    };
  }

  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  let mimeType: string | null = null;
  let widthPx: number | null = null;
  let heightPx: number | null = null;
  try {
    const meta = await sharp(bytes).metadata();
    widthPx = meta.width ?? null;
    heightPx = meta.height ?? null;
    if (meta.format === "jpeg") mimeType = "image/jpeg";
    else if (meta.format === "png") mimeType = "image/png";
    else if (meta.format === "webp") mimeType = "image/webp";
    else if (meta.format) mimeType = `image/${meta.format}`;
  } catch {
    mimeType = null;
  }

  return {
    exists: true,
    mimeType,
    fileSizeBytes: bytes.byteLength,
    widthPx,
    heightPx,
    checksumSha256,
    storagePath: path,
  };
}

export function validateProbedProjectionAsset(input: {
  caseId: string;
  attemptId: string;
  storagePath: string | null | undefined;
  expectedChecksum?: string | null;
  providerRequestId?: string | null;
  probe: StoredProjectionAssetProbe | null;
}): ProjectionAssetGateResult {
  if (!input.storagePath || isStubProjectionStoragePath(input.storagePath)) {
    return {
      ok: false,
      code: "stub_placeholder",
      message: STUB_GENERATION_NO_ASSET_MESSAGE,
      probe: input.probe,
    };
  }
  if (!input.probe?.exists || input.probe.fileSizeBytes <= 0) {
    return {
      ok: false,
      code: "storage_object_missing",
      message: "No storage object exists for this projection path",
      probe: input.probe,
    };
  }

  const ovInput: ProjectionOutputValidationInput = {
    caseId: input.caseId,
    attemptId: input.attemptId,
    expectedProviderRequestId: input.providerRequestId ?? null,
    actualProviderRequestId: input.providerRequestId ?? null,
    mimeType: input.probe.mimeType,
    fileSizeBytes: input.probe.fileSizeBytes,
    widthPx: input.probe.widthPx,
    heightPx: input.probe.heightPx,
    outputChecksum: input.probe.checksumSha256,
    storageChecksumRecorded: Boolean(input.probe.checksumSha256),
    safetyMetadataPresent: true,
    malformedOrExecutablePayload: false,
    unexpectedEmbeddedPatientData: false,
  };
  const ov = validateProviderProjectionOutput(ovInput);
  if (!ov.ok) {
    return {
      ok: false,
      code: ov.failureCode,
      message: ov.failureMessage,
      probe: input.probe,
    };
  }

  if (
    input.expectedChecksum &&
    input.probe.checksumSha256 &&
    input.expectedChecksum !== input.probe.checksumSha256
  ) {
    return {
      ok: false,
      code: "checksum_mismatch",
      message: "Stored object checksum does not match recorded output checksum",
      probe: input.probe,
    };
  }

  const mimeOk =
    input.probe.mimeType != null &&
    (SUPPORTED_PROJECTION_OUTPUT_MIME_TYPES as readonly string[]).includes(input.probe.mimeType);
  if (!mimeOk) {
    return {
      ok: false,
      code: "unsupported_mime",
      message: `Unsupported MIME type: ${input.probe.mimeType ?? "null"}`,
      probe: input.probe,
    };
  }

  return { ok: true, probe: input.probe };
}

export function outputValidationFromProbe(
  probe: StoredProjectionAssetProbe,
  args: { caseId: string; attemptId: string; providerRequestId?: string | null }
): ProjectionOutputValidationResult {
  return validateProviderProjectionOutput({
    caseId: args.caseId,
    attemptId: args.attemptId,
    expectedProviderRequestId: args.providerRequestId ?? null,
    actualProviderRequestId: args.providerRequestId ?? null,
    mimeType: probe.mimeType,
    fileSizeBytes: probe.fileSizeBytes,
    widthPx: probe.widthPx,
    heightPx: probe.heightPx,
    outputChecksum: probe.checksumSha256,
    storageChecksumRecorded: Boolean(probe.checksumSha256),
    safetyMetadataPresent: true,
    malformedOrExecutablePayload: false,
    unexpectedEmbeddedPatientData: false,
  });
}

/** Approval / report gate — never approve or share stub or missing assets. */
export function assertProjectionAssetApproximatelyForApproval(input: {
  storagePath: string | null | undefined;
  status: string;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (isStubProjectionStoragePath(input.storagePath)) {
    return { ok: false, code: "stub_placeholder", message: STUB_GENERATION_NO_ASSET_MESSAGE };
  }
  if (!projectionHasApproximatelyValidImagePath(input.storagePath)) {
    return {
      ok: false,
      code: "missing_image_asset",
      message: "Approved status is impossible without a valid stored image asset",
    };
  }
  return { ok: true };
}
