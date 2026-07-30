/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — Deterministic stub projection provider.
 * No external image model; records a constrained planning artifact for tests / offline.
 * Real ImagingOS / transform adapters can implement PreSurgeryProjectionProvider.
 */

import { createHash } from "node:crypto";
import { stableStringifyForChecksum } from "@/lib/projection/canonicalChecksum";
import type { PreSurgeryProjectionProvider, PreSurgeryProjectionInput, PreSurgeryProjectionResult } from "./provider";
import { deriveProjectionModeAllocation, STANDARD_PRE_SURGERY_PROJECTION_ASSUMPTIONS } from "./modes";
import { findUnsafeProjectionLabel } from "./safety";

export function createStubPreSurgeryProjectionProvider(): PreSurgeryProjectionProvider {
  return {
    async generateProjection(input: PreSurgeryProjectionInput): Promise<PreSurgeryProjectionResult> {
      const allocation = deriveProjectionModeAllocation(input.approvedGraftPlan, input.mode);
      const labelViolation = findUnsafeProjectionLabel(allocation.patientSafeLabel);
      if (labelViolation) {
        return { ok: false, errorCode: labelViolation.code, message: labelViolation.message };
      }

      // Never include signed URLs or patient identifiers in checksum payload / logs.
      const checksumPayload = {
        caseId: input.caseId,
        sourceImageId: input.sourceImageId,
        graftPlanId: input.approvedGraftPlanId,
        graftPlanVersion: input.approvedGraftPlan.version,
        mode: input.mode,
        allocation,
        annotationIds: input.approvedAnnotations.map((a) => a.id).sort(),
        generationVersion: input.generationVersion,
        engineVersion: input.engineVersion,
        seed: input.deterministicSeed ?? null,
        constraints: input.patientSafeProjectionConstraints,
      };
      const outputChecksum = createHash("sha256")
        .update(stableStringifyForChecksum(checksumPayload), "utf8")
        .digest("hex");

      return {
        ok: true,
        outputStorageRef: `pre_surgery_projections/${input.caseId}/${input.mode}/${outputChecksum.slice(0, 16)}.stub`,
        outputChecksum,
        limitations: [
          "Illustrative planning aid — not a guaranteed outcome.",
          "Does not predict graft survival, calibre, curl, or colour.",
          "Facial identity and anatomy outside approved recipient zones must remain unchanged.",
          ...input.patientSafeProjectionConstraints,
        ],
        planningAssumptions: [...STANDARD_PRE_SURGERY_PROJECTION_ASSUMPTIONS],
        mode: input.mode,
      };
    },
  };
}
