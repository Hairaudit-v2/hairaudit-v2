/**
 * HA-PRE-SURGERY-INTELLIGENCE-2C — Provider-neutral projection contract (expanded).
 * Distinct from HA-PROJECTION-1A–1G longitudinal projected-vs-observed engine.
 */

import type { ClinicalImageAnnotation } from "../types";
import type { PreSurgeryGraftPlan } from "../types";
import type { PreSurgeryProjectionMode } from "../types";
import type { PreSurgeryProjectionEngineVersion } from "../versions";
import type { CanonicalProjectionRequestSnapshot } from "./canonicalRequest";

export type PreSurgeryProjectionInput = {
  caseId: string;
  sourceImageId: string;
  /** Internal storage path or opaque reference — never log signed URLs / PHI. */
  sourceImageRef: string;
  approvedGraftPlanId: string;
  approvedGraftPlan: PreSurgeryGraftPlan;
  approvedAnnotations: ClinicalImageAnnotation[];
  mode: PreSurgeryProjectionMode;
  generationVersion: string;
  engineVersion: PreSurgeryProjectionEngineVersion | string;
  deterministicSeed?: string | null;
  patientSafeProjectionConstraints: string[];
  /** 2C: frozen canonical snapshot + idempotency. */
  canonicalRequest?: CanonicalProjectionRequestSnapshot | null;
  inputChecksum?: string | null;
  idempotencyKey?: string | null;
  abortSignal?: AbortSignal | null;
  /** Overlay variant for local-illustrative only. */
  renderVariant?: "graft_allocation_map" | "proposed_hairline_design";
};

export type PreSurgeryProjectionProviderError = {
  code:
    | "provider_disabled"
    | "provider_misconfigured"
    | "provider_timeout"
    | "provider_auth"
    | "provider_transient"
    | "provider_permanent"
    | "provider_cancelled"
    | "provider_response_invalid"
    | "provider_safety_rejected"
    | string;
  message: string;
  retryable: boolean;
  providerRequestId?: string | null;
  providerResponseId?: string | null;
  httpStatus?: number | null;
};

export type PreSurgeryProjectionResult =
  | {
      ok: true;
      /** Opaque storage path or provider asset id — not a public URL. */
      outputStorageRef: string;
      outputChecksum: string;
      limitations: string[];
      planningAssumptions: string[];
      mode: PreSurgeryProjectionMode;
      providerRequestId?: string | null;
      providerResponseId?: string | null;
      modelVersion?: string | null;
    }
  | ({
      ok: false;
      errorCode: string;
      message: string;
    } & Partial<PreSurgeryProjectionProviderError>);

export type PreSurgeryProjectionProvider = {
  generateProjection(input: PreSurgeryProjectionInput): Promise<PreSurgeryProjectionResult>;
  healthcheck?: () => Promise<{ healthy: boolean; detail: string; latencyMs: number }>;
};
