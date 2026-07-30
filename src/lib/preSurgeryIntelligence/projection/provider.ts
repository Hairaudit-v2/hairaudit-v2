/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Provider-neutral pre-surgery illustrative projection.
 * Distinct from HA-PROJECTION-1A–1G longitudinal projected-vs-observed engine.
 */

import type { ClinicalImageAnnotation } from "../types";
import type { PreSurgeryGraftPlan } from "../types";
import type { PreSurgeryProjectionMode } from "../types";
import type { PreSurgeryProjectionEngineVersion } from "../versions";

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
    }
  | {
      ok: false;
      errorCode: string;
      message: string;
    };

export type PreSurgeryProjectionProvider = {
  generateProjection(input: PreSurgeryProjectionInput): Promise<PreSurgeryProjectionResult>;
};
