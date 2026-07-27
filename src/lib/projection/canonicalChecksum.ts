/**
 * HA-PROJECTION-1D — Deterministic canonical JSON + checksum helpers.
 *
 * Checksum contract:
 * - Same logical object → same checksum
 * - Field ordering differences → same checksum (keys sorted recursively)
 * - Material content change → different checksum
 * - Volatile fields (generated_at, request IDs, temporary/signed URLs) are stripped
 *   before hashing when present as known volatile key names
 */

import { createHash } from "node:crypto";

/** Known volatile keys excluded from checksum payloads. */
export const VOLATILE_CHECKSUM_KEYS = new Set([
  "generated_at",
  "generatedAt",
  "request_id",
  "requestId",
  "signed_url",
  "signedUrl",
  "temporary_url",
  "temporaryUrl",
  "temp_url",
  "tempUrl",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Deep-clone with:
 * - recursive key sort for objects
 * - volatile key stripping
 * - array order preserved (semantic order)
 */
export function canonicalizeForChecksum(value: unknown, stripVolatile = true): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeForChecksum(item, stripVolatile));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const keys = Object.keys(value).sort();
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (stripVolatile && VOLATILE_CHECKSUM_KEYS.has(key)) continue;
    out[key] = canonicalizeForChecksum(value[key], stripVolatile);
  }
  return out;
}

/** Stable JSON string for hashing (UTF-8). */
export function stableStringifyForChecksum(value: unknown, stripVolatile = true): string {
  return JSON.stringify(canonicalizeForChecksum(value, stripVolatile));
}

/** SHA-256 hex digest of the canonical form. */
export function checksumCanonical(value: unknown, stripVolatile = true): string {
  const payload = stableStringifyForChecksum(value, stripVolatile);
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export type ProjectionChecksumBundle = {
  reconstructionInputChecksum: string;
  projectionInputChecksum: string;
  projectionOutputChecksum: string;
};

/**
 * Compute the three checksums required for a projection snapshot.
 * - reconstruction: frozen 1A output
 * - projection input: same 1A reconstruction (input to 1B)
 * - projection output: frozen 1B outcome
 */
export function computeProjectionChecksums(args: {
  reconstruction: unknown;
  projectedOutcome: unknown;
}): ProjectionChecksumBundle {
  const reconstructionInputChecksum = checksumCanonical(args.reconstruction);
  return {
    reconstructionInputChecksum,
    projectionInputChecksum: reconstructionInputChecksum,
    projectionOutputChecksum: checksumCanonical(args.projectedOutcome),
  };
}
