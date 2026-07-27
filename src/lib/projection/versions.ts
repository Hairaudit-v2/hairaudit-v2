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

/** Canonical 1E longitudinal observation contract version. */
export const OBSERVATION_SCHEMA_VERSION = "ha-projection-observation-v1" as const;

/**
 * Lineage contract version for observation ↔ projection attachment.
 * Reuses the 1D lineage identifier — observations attach to frozen projection snapshots.
 */
export const OBSERVATION_LINEAGE_VERSION = "ha-projection-lineage-v1" as const;

/** Canonical 1F projected-vs-observed comparison contract version. */
export const COMPARISON_SCHEMA_VERSION = "ha-projection-comparison-v1" as const;

export type ReconstructionContractVersion = typeof RECONSTRUCTION_CONTRACT_VERSION;
export type ProjectionEngineVersion = typeof PROJECTION_ENGINE_VERSION;
export type ProjectionSnapshotSchemaVersion = typeof PROJECTION_SNAPSHOT_SCHEMA_VERSION;
export type ObservationSchemaVersion = typeof OBSERVATION_SCHEMA_VERSION;
export type ObservationLineageVersion = typeof OBSERVATION_LINEAGE_VERSION;
export type ComparisonSchemaVersion = typeof COMPARISON_SCHEMA_VERSION;
