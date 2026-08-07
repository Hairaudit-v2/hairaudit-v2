/**
 * HA-PRE-SURGERY-OPENAI-IMAGE-PROVIDER-2B — Clinical edit prompt for gpt-image-2.
 * Instructs image-to-image edit of the patient's photo — never a new identity.
 */

import type { PreSurgeryGraftPlan, PreSurgeryProjectionMode, ProjectionModeAssumptions } from "../types";
import { deriveProjectionModeAllocation } from "./modes";
import { ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER } from "./artifactTypes";

export const OPENAI_EDIT_PROMPT_VERSION = "ha-openai-projected-outcome-prompt-v2" as const;

export function buildOpenAiProjectedOutcomeEditPrompt(input: {
  plan: PreSurgeryGraftPlan;
  mode: PreSurgeryProjectionMode;
  zonesIncluded: string[];
  assumptions?: ProjectionModeAssumptions | null;
}): { prompt: string; promptVersion: typeof OPENAI_EDIT_PROMPT_VERSION; assumptions: ProjectionModeAssumptions } {
  const allocation = deriveProjectionModeAllocation(input.plan, input.mode);
  const assumptions = input.assumptions ?? allocation.assumptions;
  const zones = (input.zonesIncluded.length ? input.zonesIncluded : allocation.zoneGraftTargets.filter((z) => z.grafts > 0).map((z) => z.zone))
    .map((z) => z.replaceAll("_", " "))
    .join(", ");

  const densityPhrase =
    input.mode === "conservative"
      ? "conservative, lighter visible coverage with realistic scalp show-through"
      : input.mode === "planned"
        ? "clinically expected planned density — not helmet hair"
        : "upper illustrative boundary still constrained by the graft plan — still natural, not overfilled";

  const prompt = [
    "Edit THIS exact patient photograph in place. Do not generate a new face, body, pose, lighting, or background.",
    "Add plausible natural-looking transplanted hair ONLY inside the masked recipient region (transparent mask areas).",
    "Absolutely preserve: facial identity and proportions; eyes, brows, nose, ears, lips, facial hair; skin tone and pores; expression; forehead below the approved hairline; clothing; background logos.",
    "Do not invent donor-area improvement. Do not remove scars or unrelated features. Do not change native buzzed hair outside the treatment mask.",
    "Keep hair length short and cropped to match native sides — never longer swept or styled hair.",
    "Hair must look like individual short follicles with realistic scalp show-through — never solid coloured fills, planning blocks, opaque zone overlays, wigs, or helmet density.",
    "Hairline: soft irregular leading edge with micro- and macro-irregularity; finer single-hair appearance at the front; gradual density transition behind the hairline; no hard horizontal fill line.",
    "Never produce a rectangular or block-shaped transplant patch. Transition density must fade naturally into native scalp and temporal fringes.",
    "Match direction and angulation to the patient's visible native hair. Match colour, calibre and texture to this patient.",
    `Mode: ${input.mode} (${densityPhrase}).`,
    `Recipient zones (plan v${input.plan.version}): ${zones || "approved recipient zones only"}.`,
    `Assumptions: ~${assumptions.graftCount} grafts; survival ${assumptions.assumedGraftSurvivalRangePct.min}–${assumptions.assumedGraftSurvivalRangePct.max}%; ~${assumptions.hairsPerGraftAssumption} hairs/graft; projected density ~${assumptions.projectedDensityRange.minPerCm2}–${assumptions.projectedDensityRange.maxPerCm2}/cm².`,
    "Output a photorealistic edit of the same photograph with transplanted hair added only in the mask.",
    ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER,
  ].join(" ");

  return { prompt, promptVersion: OPENAI_EDIT_PROMPT_VERSION, assumptions };
}
