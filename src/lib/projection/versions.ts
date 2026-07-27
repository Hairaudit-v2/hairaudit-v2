/**
 * HA-PROJECTION-1D — Semantic version identifiers for reconstruction / projection / lineage.
 *
 * Git commit / build identity may be captured as supplementary evidence elsewhere,
 * but must not replace these contract versions when interpreting historical snapshots.
 */

/** Canonical 1A reconstruction contract version. */
export const RECONSTRUCTION_CONTRACT_VERSION = "ha-projection-1a-v1" as const;

/** Canonical 1B projection engine / contract version. */
export const PROJECTION_ENGINE_VERSION = "ha-projection-1b-v1" as const;

/** Persisted snapshot / lineage schema version (1D). */
export const PROJECTION_SNAPSHOT_SCHEMA_VERSION = "ha-projection-lineage-v1" as const;

export type ReconstructionContractVersion = typeof RECONSTRUCTION_CONTRACT_VERSION;
export type ProjectionEngineVersion = typeof PROJECTION_ENGINE_VERSION;
export type ProjectionSnapshotSchemaVersion = typeof PROJECTION_SNAPSHOT_SCHEMA_VERSION;
