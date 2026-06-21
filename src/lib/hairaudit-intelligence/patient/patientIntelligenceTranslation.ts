/**
 * HA-INTELLIGENCE-7 — Patient Intelligence Translation Layer.
 *
 * Converts raw clinical intelligence engine outputs into calm, patient-safe
 * observations. This is the ONLY sanctioned bridge between engine fields and a
 * patient surface.
 *
 * Hard rules (enforced by `assertPatientObservationSafe` + tests):
 * - Never expose raw engine fields, enum values, or `classification` strings.
 * - Never expose Norwood labels, confidence percentages, severity bands.
 * - Never expose engine IDs, `clinicianNotes`, `executionMode`, or AI language.
 * - Output is advisory, non-diagnostic, and always defers to a clinician.
 */

import type {
  AsymmetryEstimate,
  CrownProgressionEstimate,
  DiffuseThinningEstimate,
  DonorDensityBand,
  DonorDepletionEstimate,
  DonorReserveRisk,
  GraftSpacingAnomaly,
  HairAuditIntelligenceBundle,
  ImplantationIrregularity,
  MiniaturisationSuspicion,
  NorwoodStageEstimate,
  OverharvestingIndicator,
  PriorTransplantEvidence,
} from "@/lib/hairaudit-intelligence/types";

/** Patient-facing observation areas — calm, non-technical groupings. */
export type PatientIntelligenceArea =
  | "crown_region"
  | "hairline_region"
  | "overall_pattern"
  | "donor_region"
  | "prior_procedure"
  | "graft_placement";

export type PatientIntelligenceObservation = {
  /** Stable key for React keys / dedupe — NOT shown to patient. */
  id: string;
  area: PatientIntelligenceArea;
  /** Short calm heading, e.g. "Crown region". */
  areaLabel: string;
  /** Calm, patient-safe observation sentence. */
  observation: string;
};

export type PatientIntelligenceTranslation = {
  /** Section heading for the patient report. */
  heading: string;
  /** Calm intro line. */
  intro: string;
  observations: PatientIntelligenceObservation[];
  /** Always present — non-diagnostic safety line. */
  disclaimer: string;
  /** True when at least one observation is available. */
  hasObservations: boolean;
};

export const PATIENT_INTELLIGENCE_HEADING = "What we observed from your images";

const PATIENT_INTELLIGENCE_INTRO =
  "These are gentle, non-diagnostic observations drawn from the photos you shared. " +
  "They are starting points for a conversation with a qualified clinician — not conclusions.";

const PATIENT_INTELLIGENCE_DISCLAIMER =
  "These observations are based only on your uploaded images and cannot replace an in-person " +
  "examination. They are not a diagnosis. Please review anything noted here with a qualified clinician.";

const AREA_LABELS: Record<PatientIntelligenceArea, string> = {
  crown_region: "Crown region",
  hairline_region: "Hairline region",
  overall_pattern: "Overall pattern",
  donor_region: "Donor region",
  prior_procedure: "Previous treatment",
  graft_placement: "Placement and balance",
};

// ─── Engine 1: Hair Loss Classification ──────────────────────────────────────

function crownProgressionObservation(value: CrownProgressionEstimate): string | null {
  switch (value) {
    case "early":
      return "Your hair pattern may suggest early changes around the crown region.";
    case "moderate":
      return "Your hair pattern may suggest some progression around the crown region that is worth reviewing.";
    case "advanced":
      return "The crown region may benefit from a closer look with a clinician when you are ready.";
    default:
      return null; // none_observed / not_assessable → stay calm, say nothing
  }
}

function diffuseThinningObservation(value: DiffuseThinningEstimate): string | null {
  switch (value) {
    case "possible":
      return "Some images may suggest gentle, wider thinning across the top rather than a single area.";
    case "likely":
      return "The photos may suggest thinning spread across a wider area, which a clinician can help interpret.";
    default:
      return null;
  }
}

/** Recession pattern is derived from the (never-exposed) Norwood estimate. */
function recessionObservation(value: NorwoodStageEstimate): string | null {
  switch (value) {
    case "II":
      return "Your hairline may show early, gentle changes around the temples.";
    case "III":
    case "III_vertex":
      return "Your hairline pattern may suggest some recession that could be worth discussing with a clinician.";
    case "IV":
    case "V":
    case "VI":
    case "VII":
      return "Your overall hair pattern may benefit from a closer review with a qualified clinician.";
    default:
      return null; // I / indeterminate / not_assessable → stay calm
  }
}

// ─── Engine 2: Donor Intelligence ────────────────────────────────────────────

function donorDensityObservation(value: DonorDensityBand): string | null {
  switch (value) {
    case "moderate":
      return "The donor region appears moderate in the photos and may be worth reviewing before any future procedure.";
    case "appears_limited":
      return "The donor region may benefit from closer review if future procedures are being considered.";
    default:
      return null; // appears_adequate / not_assessable
  }
}

function donorReserveObservation(value: DonorReserveRisk): string | null {
  switch (value) {
    case "moderate":
      return "It may be helpful to review the donor area carefully when planning any future treatment.";
    case "elevated":
      return "The donor region may benefit from closer review if future procedures are being considered.";
    default:
      return null; // low / not_assessable
  }
}

function miniaturisationObservation(value: MiniaturisationSuspicion): string | null {
  switch (value) {
    case "possible":
      return "Some donor-area images may be worth a closer look to understand hair thickness over time.";
    case "elevated_suspicion":
      return "A clinician may wish to take a closer look at the donor area to understand hair thickness.";
    default:
      return null; // none_suggested / not_assessable
  }
}

// ─── Engine 3: Repair Surgery ────────────────────────────────────────────────

function priorProcedureObservation(value: PriorTransplantEvidence): string | null {
  switch (value) {
    case "possible":
    case "likely":
      return "The images may suggest signs of previous treatment in this area, which is helpful context for a clinician.";
    default:
      return null;
  }
}

function overharvestingObservation(value: OverharvestingIndicator): string | null {
  switch (value) {
    case "possible":
    case "likely":
      return "The donor area may benefit from a careful review before any further treatment is planned.";
    default:
      return null;
  }
}

function donorDepletionObservation(value: DonorDepletionEstimate): string | null {
  switch (value) {
    case "possible":
    case "likely":
      return "It may be worth reviewing how much donor hair is available before considering further procedures.";
    default:
      return null;
  }
}

// ─── Engine 4: Procedural Intelligence ───────────────────────────────────────

function implantationObservation(value: ImplantationIrregularity): string | null {
  switch (value) {
    case "moderate":
    case "significant":
      return "Some areas of placement may be worth reviewing with a clinician to understand how they are settling.";
    default:
      return null; // none_suggested / minor / not_assessable
  }
}

function asymmetryObservation(value: AsymmetryEstimate): string | null {
  switch (value) {
    case "moderate":
    case "significant":
      return "The photos may suggest some difference between the two sides that a clinician can help interpret.";
    default:
      return null;
  }
}

function spacingObservation(value: GraftSpacingAnomaly): string | null {
  switch (value) {
    case "possible":
    case "likely":
      return "The spacing between areas of growth may be worth a closer look with a clinician.";
    default:
      return null;
  }
}

// ─── Translator ──────────────────────────────────────────────────────────────

type RawObservation = {
  id: string;
  area: PatientIntelligenceArea;
  text: string | null;
};

/**
 * Translate a full intelligence bundle into calm patient observations.
 * Returns at most one observation per concern, ordered for a calm read.
 */
export function translateIntelligenceForPatient(
  bundle: HairAuditIntelligenceBundle | null | undefined
): PatientIntelligenceTranslation {
  const empty: PatientIntelligenceTranslation = {
    heading: PATIENT_INTELLIGENCE_HEADING,
    intro: PATIENT_INTELLIGENCE_INTRO,
    observations: [],
    disclaimer: PATIENT_INTELLIGENCE_DISCLAIMER,
    hasObservations: false,
  };
  if (!bundle) return empty;

  const hl = bundle.hairLossClassification?.fields;
  const donor = bundle.donorIntelligence?.fields;
  const repair = bundle.repairSurgery?.fields;
  const proc = bundle.proceduralIntelligence?.fields;

  const raw: RawObservation[] = [
    // Hair loss classification
    { id: "crown_progression", area: "crown_region", text: hl ? crownProgressionObservation(hl.crownProgression) : null },
    { id: "recession_pattern", area: "hairline_region", text: hl ? recessionObservation(hl.norwoodStage) : null },
    { id: "diffuse_thinning", area: "overall_pattern", text: hl ? diffuseThinningObservation(hl.diffuseThinningPattern) : null },
    // Donor intelligence
    { id: "donor_density", area: "donor_region", text: donor ? donorDensityObservation(donor.donorDensityBand) : null },
    { id: "donor_reserve", area: "donor_region", text: donor ? donorReserveObservation(donor.donorReserveRisk) : null },
    { id: "miniaturisation", area: "donor_region", text: donor ? miniaturisationObservation(donor.miniaturisationSuspicion) : null },
    // Repair surgery
    { id: "prior_procedure", area: "prior_procedure", text: repair ? priorProcedureObservation(repair.priorTransplantEvidence) : null },
    { id: "overharvesting", area: "donor_region", text: repair ? overharvestingObservation(repair.overharvestingIndicators) : null },
    { id: "donor_depletion", area: "donor_region", text: repair ? donorDepletionObservation(repair.donorDepletion) : null },
    // Procedural intelligence
    { id: "implantation_pattern", area: "graft_placement", text: proc ? implantationObservation(proc.implantationPatternIrregularities) : null },
    { id: "asymmetry", area: "graft_placement", text: proc ? asymmetryObservation(proc.asymmetry) : null },
    { id: "graft_spacing", area: "graft_placement", text: proc ? spacingObservation(proc.graftSpacingAnomalies) : null },
  ];

  // Collapse to one observation per donor-region concern to avoid repetition:
  // keep the first non-null donor observation only.
  const seenDonor = { used: false };
  const observations: PatientIntelligenceObservation[] = [];
  for (const item of raw) {
    if (!item.text) continue;
    if (item.area === "donor_region") {
      if (seenDonor.used) continue;
      seenDonor.used = true;
    }
    const observation = item.text;
    assertPatientObservationSafe(observation);
    observations.push({
      id: item.id,
      area: item.area,
      areaLabel: AREA_LABELS[item.area],
      observation,
    });
  }

  return {
    heading: PATIENT_INTELLIGENCE_HEADING,
    intro: PATIENT_INTELLIGENCE_INTRO,
    observations,
    disclaimer: PATIENT_INTELLIGENCE_DISCLAIMER,
    hasObservations: observations.length > 0,
  };
}

/**
 * Terms that must never reach a patient observation. Guards against regressions
 * where raw engine vocabulary leaks into translated copy.
 */
export const FORBIDDEN_PATIENT_OBSERVATION_TERMS = [
  "norwood",
  "vertex",
  "miniaturisation",
  "miniaturization",
  "overharvest",
  "depletion",
  "retrograde",
  "graft survival",
  "confidence",
  "severity",
  "classifier",
  "clinicianNotes",
  "executionMode",
  "engineId",
  "rule_based",
  "AI",
  "GPT",
  "AuditOS",
  "score",
  "%",
] as const;

/** Throws if a patient observation contains forbidden technical/AI vocabulary. */
export function assertPatientObservationSafe(text: string): void {
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_PATIENT_OBSERVATION_TERMS) {
    // word-boundary-ish match for short tokens like "AI" to avoid false hits
    if (term === "AI") {
      if (/\bAI\b/.test(text)) {
        throw new Error(`Patient observation leaked forbidden term: ${term}`);
      }
      continue;
    }
    if (lower.includes(term.toLowerCase())) {
      throw new Error(`Patient observation leaked forbidden term: ${term}`);
    }
  }
}
