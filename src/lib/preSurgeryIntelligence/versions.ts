/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Semantic version identifiers.
 */

/** Image review / role-correction contract. */
export const PRE_SURGERY_IMAGE_REVIEW_VERSION = "ha-pre-surgery-image-review-v1" as const;

/** Structured observation review contract. */
export const PRE_SURGERY_OBSERVATION_VERSION = "ha-pre-surgery-observation-v1" as const;

/** Annotation geometry / schema contract. */
export const PRE_SURGERY_ANNOTATION_VERSION = "ha-pre-surgery-annotation-v1" as const;

/** Editable graft plan schema. */
export const PRE_SURGERY_GRAFT_PLAN_VERSION = "ha-pre-surgery-graft-plan-v1" as const;

/** Pre-surgery illustrative projection engine. */
export const PRE_SURGERY_PROJECTION_ENGINE_VERSION = "ha-pre-surgery-projection-v1" as const;

/** Persistence / audit event schema. */
export const PRE_SURGERY_INTELLIGENCE_SCHEMA_VERSION = "ha-pre-surgery-intelligence-v1" as const;

export type PreSurgeryImageReviewVersion = typeof PRE_SURGERY_IMAGE_REVIEW_VERSION;
export type PreSurgeryObservationVersion = typeof PRE_SURGERY_OBSERVATION_VERSION;
export type PreSurgeryAnnotationVersion = typeof PRE_SURGERY_ANNOTATION_VERSION;
export type PreSurgeryGraftPlanVersion = typeof PRE_SURGERY_GRAFT_PLAN_VERSION;
export type PreSurgeryProjectionEngineVersion = typeof PRE_SURGERY_PROJECTION_ENGINE_VERSION;
export type PreSurgeryIntelligenceSchemaVersion = typeof PRE_SURGERY_INTELLIGENCE_SCHEMA_VERSION;
