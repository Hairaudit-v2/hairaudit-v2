/**
 * HA-PROJECTION-1D — Integrity verification for frozen projection snapshots.
 *
 * Re-canonicalises stored payloads, recomputes checksums, compares to frozen values.
 * Fail closed on mismatch. Never auto-repairs checksums.
 */

import { computeProjectionChecksums } from "./canonicalChecksum";
import type { ProjectionSnapshot } from "./projectionSnapshotTypes";

export type ProjectionSnapshotIntegrityResult =
  | { ok: true; snapshotId: string }
  | {
      ok: false;
      snapshotId: string;
      reason: string;
      expected: {
        reconstructionInputChecksum: string;
        projectionInputChecksum: string;
        projectionOutputChecksum: string;
      };
      actual: {
        reconstructionInputChecksum: string;
        projectionInputChecksum: string;
        projectionOutputChecksum: string;
      };
    };

export function verifyProjectionSnapshotIntegrity(
  snapshot: ProjectionSnapshot
): ProjectionSnapshotIntegrityResult {
  const actual = computeProjectionChecksums({
    reconstruction: snapshot.reconstructionSnapshot,
    projectedOutcome: snapshot.projectionSnapshot,
  });

  const expected = {
    reconstructionInputChecksum: snapshot.reconstructionInputChecksum,
    projectionInputChecksum: snapshot.projectionInputChecksum,
    projectionOutputChecksum: snapshot.projectionOutputChecksum,
  };

  if (
    actual.reconstructionInputChecksum !== expected.reconstructionInputChecksum ||
    actual.projectionInputChecksum !== expected.projectionInputChecksum ||
    actual.projectionOutputChecksum !== expected.projectionOutputChecksum
  ) {
    return {
      ok: false,
      snapshotId: snapshot.id,
      reason: "Projection snapshot checksum mismatch — integrity verification failed.",
      expected,
      actual,
    };
  }

  return { ok: true, snapshotId: snapshot.id };
}
