/**
 * HA-PROJECTION-1B — Domain eligibility and deterministic patient-safe projection text.
 *
 * Consumes canonical SurgeryDayProcedureReconstruction only.
 * Omits unsupported domains rather than fabricating generic prose.
 */

import { normalizeRecipientZone } from "./surgeryDayZones";
import { characteristicConfidence } from "./surgeryDayProjectionConfidence";
import type {
  PatientSafeProjectedCharacteristic,
  ProjectionConfidence,
  ProjectedOutcomeDomain,
  SurgeryDayProcedureReconstruction,
} from "./types";

type DraftCharacteristic = Omit<PatientSafeProjectedCharacteristic, "confidence"> & {
  observationConfidence?: "low" | "moderate" | "high";
  requiresBaseline?: boolean;
};

function treatedZones(r: SurgeryDayProcedureReconstruction): string[] {
  const raw = [
    ...r.recipient.observedTreatedAreas,
    ...r.procedureContext.treatedAreas,
  ];
  return [...new Set(raw.map((z) => normalizeRecipientZone(z)).filter((z) => z !== "other"))];
}

function hasFrontalContext(r: SurgeryDayProcedureReconstruction): boolean {
  const zones = treatedZones(r);
  if (zones.some((z) => z === "hairline" || z === "frontal" || z === "forelock" || z === "temples")) {
    return true;
  }
  if (r.recipient.hairlineDesign) return true;
  const blob = [
    r.recipient.recipientPlacement?.observation,
    r.recipient.densityDistribution?.observation,
  ]
    .filter(Boolean)
    .join(" ");
  return /hairline|frontal|temple|forelock|frame/i.test(blob);
}

function hasTransitionEvidence(r: SurgeryDayProcedureReconstruction): boolean {
  if (r.recipient.symmetryAndTransition) return true;
  if (r.recipient.directionAndAngulation) return true;
  const hl = r.recipient.hairlineDesign?.observation ?? "";
  return /irregular|transition|graduat|soft|symmetry|lateral|taper/i.test(hl);
}

function crownAppearsUntreated(r: SurgeryDayProcedureReconstruction): boolean {
  const zones = treatedZones(r);
  if (zones.includes("crown")) return false;
  const rel = r.baseline.treatmentRelationship?.observation ?? "";
  if (/crown appears untreated|crown (?:was )?not|crown (?:does not|didn't)/i.test(rel)) {
    return true;
  }
  // Clear treated-area reconstruction without crown
  return zones.length > 0 && !zones.includes("crown");
}

function templesAppearUntreated(r: SurgeryDayProcedureReconstruction): boolean {
  const zones = treatedZones(r);
  if (zones.includes("temples")) return false;
  const rel = r.baseline.treatmentRelationship?.observation ?? "";
  if (/temple involvement is not clearly|temples? (?:appear )?(?:untreated|not)/i.test(rel)) {
    return true;
  }
  return zones.length > 0 && !zones.includes("temples");
}

function buildFrontalFraming(r: SurgeryDayProcedureReconstruction): DraftCharacteristic | null {
  if (!hasFrontalContext(r)) return null;

  const keys: string[] = [];
  const obsParts: string[] = [];

  if (r.recipient.hairlineDesign) {
    keys.push(r.recipient.hairlineDesign.key);
    obsParts.push(r.recipient.hairlineDesign.observation);
  }
  if (r.recipient.recipientPlacement) {
    keys.push(r.recipient.recipientPlacement.key);
    obsParts.push(r.recipient.recipientPlacement.observation);
  }

  const zones = treatedZones(r);
  const frontalZones = zones.filter((z) =>
    ["hairline", "frontal", "forelock", "temples"].includes(z)
  );
  if (frontalZones.length) {
    obsParts.push(
      `Treated frontal framing appears consistent with involvement of the ${frontalZones.join(", ")} region${frontalZones.length > 1 ? "s" : ""}.`
    );
    keys.push("treatment_extent");
  }

  if (r.baseline.available && r.baseline.treatmentRelationship) {
    keys.push(r.baseline.treatmentRelationship.key);
    obsParts.push(
      "Compared with the verified preoperative baseline, a previously recessed frontal area appears included in the reconstructed treatment pattern."
    );
  }

  if (!obsParts.length || !keys.length) return null;

  const observation = obsParts.join(" ");
  const projection = r.baseline.available
    ? "Based on the observed frontal reconstruction relative to baseline, the procedure appears designed to strengthen the visual frame of the face if transplanted growth and maturation progress normally."
    : "Based on the observed frontal reconstruction, the procedure appears designed to strengthen the visual frame of the face if transplanted growth and maturation progress normally.";

  return {
    domain: "frontal_framing",
    title: "Frontal framing",
    observation,
    projection,
    sourceObservationKeys: [...new Set(keys)],
    limitations: [
      "Final hairline softness after maturation cannot yet be assessed.",
      "No verified statement is made about exact hairline lowering without further longitudinal evidence.",
    ],
    observationConfidence:
      r.recipient.hairlineDesign?.confidence ??
      r.recipient.recipientPlacement?.confidence ??
      "moderate",
  };
}

function buildDensityDistribution(
  r: SurgeryDayProcedureReconstruction
): DraftCharacteristic | null {
  const density = r.recipient.densityDistribution;
  const placement = r.recipient.recipientPlacement;
  if (!density && !placement) return null;

  const keys: string[] = [];
  const obsParts: string[] = [];

  if (density) {
    keys.push(density.key);
    obsParts.push(density.observation);
  } else if (placement) {
    keys.push(placement.key);
    obsParts.push(placement.observation);
  }

  const zones = treatedZones(r);
  if (zones.includes("frontal") || zones.includes("hairline")) {
    obsParts.push(
      "Observed implantation appears more concentrated through the frontal region than posteriorly where both regions are represented in the reconstruction."
    );
  }

  // Graft count as context only — never as success claim.
  // Use provenance entries (not clinicReportedCount alone): 1A may copy patient
  // actualGraftCount into clinicReportedCount when no clinic record exists.
  const clinicProvenance = r.graftEvidence.provenance.find((p) => p.source === "clinic_reported");
  const patientProvenance = r.graftEvidence.provenance.find((p) => p.source === "patient_reported");

  if (clinicProvenance) {
    obsParts.push(
      `Clinic records report approximately ${clinicProvenance.value.toLocaleString("en-US")} grafts across the treated areas.`
    );
    keys.push("graft_evidence_clinic");
  } else if (patientProvenance) {
    obsParts.push(
      `Patient-reported graft count of approximately ${patientProvenance.value.toLocaleString("en-US")} is noted as context only and is not treated as clinic-confirmed.`
    );
    keys.push("graft_evidence_patient");
  }

  if (!obsParts.length || !keys.length) return null;

  return {
    domain: "density_distribution",
    title: "Density distribution",
    observation: obsParts.join(" "),
    projection:
      "If growth progresses normally, the strongest visual density would be expected in the frontal treatment zone rather than in lower-treatment or untreated posterior regions.",
    sourceObservationKeys: [...new Set(keys)],
    limitations: [
      "Exact recipient density cannot be measured from the supplied images.",
      "Reported graft counts are not converted into expected cosmetic success.",
    ],
    observationConfidence: density?.confidence ?? placement?.confidence ?? "low",
  };
}

function buildTransitionCharacteristics(
  r: SurgeryDayProcedureReconstruction
): DraftCharacteristic | null {
  if (!hasTransitionEvidence(r)) return null;

  const keys: string[] = [];
  const obsParts: string[] = [];

  if (r.recipient.symmetryAndTransition) {
    keys.push(r.recipient.symmetryAndTransition.key);
    obsParts.push(r.recipient.symmetryAndTransition.observation);
  }
  if (r.recipient.hairlineDesign) {
    keys.push(r.recipient.hairlineDesign.key);
    const hl = r.recipient.hairlineDesign.observation;
    if (/irregular|soft|transition|graduat/i.test(hl)) {
      obsParts.push(hl);
    }
  }
  if (r.recipient.directionAndAngulation) {
    keys.push(r.recipient.directionAndAngulation.key);
    obsParts.push(r.recipient.directionAndAngulation.observation);
  }

  if (!obsParts.length || !keys.length) return null;

  const graduated =
    /irregular|graduat|soft|transition|taper/i.test(obsParts.join(" ")) ||
    Boolean(r.recipient.symmetryAndTransition);

  return {
    domain: "transition_characteristics",
    title: "Transition characteristics",
    observation: obsParts.join(" "),
    projection: graduated
      ? "The observed transition appears graduated rather than abruptly uniform, which may support a softer visual transition after maturation if growth progresses normally."
      : "Visible transition characteristics are documented from surgery-day evidence; mature soft-edge appearance cannot yet be assessed and would depend on later maturation if growth progresses normally.",
    sourceObservationKeys: [...new Set(keys)],
    limitations: [
      "Final hairline softness after maturation cannot yet be assessed.",
      "Naturalness after full maturation cannot yet be determined from surgery-day images alone.",
    ],
    observationConfidence:
      r.recipient.symmetryAndTransition?.confidence ??
      r.recipient.hairlineDesign?.confidence ??
      "low",
  };
}

function buildNativeHairDependency(
  r: SurgeryDayProcedureReconstruction
): DraftCharacteristic | null {
  if (!r.baseline.available) return null;
  if (!r.baseline.nativeHairPattern && !r.baseline.treatmentRelationship) return null;

  const keys: string[] = [];
  const obsParts: string[] = [];

  if (r.baseline.nativeHairPattern) {
    keys.push(r.baseline.nativeHairPattern.key);
    obsParts.push(r.baseline.nativeHairPattern.observation);
  }
  if (r.baseline.treatmentRelationship) {
    keys.push(r.baseline.treatmentRelationship.key);
    obsParts.push(r.baseline.treatmentRelationship.observation);
  }

  const zones = treatedZones(r);
  const frontalFocus =
    zones.some((z) => z === "hairline" || z === "frontal" || z === "forelock") &&
    !zones.includes("mid_scalp");

  if (frontalFocus) {
    obsParts.push(
      "Existing native hair remains part of the mid-scalp density picture while transplantation appears concentrated anteriorly."
    );
  }

  return {
    domain: "native_hair_dependency",
    title: "Native hair dependency",
    observation: obsParts.join(" "),
    projection:
      "The future visual appearance may therefore remain partly dependent on preservation of native hair in untreated or lower-treatment regions. Native hair may change independently over time.",
    sourceObservationKeys: [...new Set(keys)],
    limitations: [
      "Ultimate native-hair progression cannot yet be determined.",
      "No medication recommendations are made in this projection.",
    ],
    observationConfidence:
      r.baseline.treatmentRelationship?.confidence ??
      r.baseline.nativeHairPattern?.confidence ??
      "moderate",
    requiresBaseline: true,
  };
}

function buildUntreatedOrLowerTreatmentAreas(
  r: SurgeryDayProcedureReconstruction
): DraftCharacteristic | null {
  const zones = treatedZones(r);
  if (!zones.length && !r.baseline.treatmentRelationship) return null;

  const untreatedNotes: string[] = [];
  const keys: string[] = [];

  if (crownAppearsUntreated(r)) {
    untreatedNotes.push(
      "The crown does not appear to have been a primary treatment area in the supplied surgery-day evidence."
    );
    keys.push("treatment_extent");
  }
  if (templesAppearUntreated(r)) {
    untreatedNotes.push(
      "Temple regions do not appear clearly documented as primary treatment areas in the available reconstruction."
    );
    keys.push("treatment_extent");
  }

  const dens = r.recipient.densityDistribution?.observation ?? "";
  if (/posterior|lower|less dens|taper/i.test(dens)) {
    untreatedNotes.push(
      "Lower-density or tapered appearance is noted in posterior or transition regions relative to the frontal field where both are in view."
    );
    if (r.recipient.densityDistribution) keys.push(r.recipient.densityDistribution.key);
  }

  if (r.baseline.treatmentRelationship && /untreated|not documented/i.test(r.baseline.treatmentRelationship.observation)) {
    keys.push(r.baseline.treatmentRelationship.key);
  }

  if (!untreatedNotes.length || !keys.length) return null;

  return {
    domain: "untreated_or_lower_treatment_areas",
    title: "Untreated or lower-treatment areas",
    observation: untreatedNotes.join(" "),
    projection:
      "Those areas should not be assumed to develop the same visual density as the primary frontal treatment zone if growth progresses normally elsewhere.",
    sourceObservationKeys: [...new Set(keys)],
    limitations: [
      "Long-term appearance of untreated regions cannot yet be determined.",
      "Absence of treatment in a zone is inferred from reconstruction evidence and is not a complete clinical treatment map.",
    ],
    observationConfidence: "moderate",
  };
}

const DOMAIN_BUILDERS: Array<
  (r: SurgeryDayProcedureReconstruction) => DraftCharacteristic | null
> = [
  buildFrontalFraming,
  buildDensityDistribution,
  buildTransitionCharacteristics,
  buildNativeHairDependency,
  buildUntreatedOrLowerTreatmentAreas,
];

/**
 * Build eligible projected characteristics from 1A reconstruction.
 * Domains without supporting observations are omitted.
 */
export function buildProjectedCharacteristics(
  reconstruction: SurgeryDayProcedureReconstruction,
  overallProjectionConfidence: ProjectionConfidence
): PatientSafeProjectedCharacteristic[] {
  const out: PatientSafeProjectedCharacteristic[] = [];

  for (const build of DOMAIN_BUILDERS) {
    const draft = build(reconstruction);
    if (!draft) continue;

    const confidence = characteristicConfidence(draft.observationConfidence, overallProjectionConfidence, {
      requiresBaseline: draft.requiresBaseline,
      baselineAvailable: reconstruction.baseline.available,
    });

    out.push({
      domain: draft.domain,
      title: draft.title,
      observation: draft.observation,
      projection: draft.projection,
      confidence,
      sourceObservationKeys: draft.sourceObservationKeys,
      limitations: draft.limitations,
    });
  }

  return out;
}

/** Count domains that would be eligible (for confidence scoring before final texts). */
export function countEligibleDomains(reconstruction: SurgeryDayProcedureReconstruction): number {
  return DOMAIN_BUILDERS.reduce((n, build) => n + (build(reconstruction) ? 1 : 0), 0);
}

export function mapAssessmentType(
  reconstruction: SurgeryDayProcedureReconstruction
): "surgery_day_projection" | "surgery_day_projection_with_baseline" {
  return reconstruction.assessmentType === "surgery_day_reconstruction_with_baseline"
    ? "surgery_day_projection_with_baseline"
    : "surgery_day_projection";
}

export function buildProjectionSummary(
  reconstruction: SurgeryDayProcedureReconstruction,
  domains: ProjectedOutcomeDomain[]
): string {
  const zones = treatedZones(reconstruction);
  const frontalFocus =
    zones.some((z) => z === "hairline" || z === "frontal" || z === "forelock") ||
    domains.includes("frontal_framing");

  const focusClause = frontalFocus
    ? "The procedure appears focused on frontal restoration with a graduated posterior transition where evidence supports that pattern."
    : "The main treated areas and visible implantation pattern are reconstructed from the available surgery-day evidence.";

  const baselineClause = reconstruction.baseline.available
    ? " A verified preoperative baseline was available for comparative context."
    : " No verified preoperative baseline was available, so the extent of change from the patient's original hairline cannot be determined.";

  return (
    "The submitted surgery-day evidence allows HairAudit to reconstruct the main treated areas and visible implantation pattern. " +
    focusClause +
    baselineClause +
    " Any projected characteristics remain conditional on normal healing, graft growth and later maturation; the actual final result cannot yet be assessed."
  );
}

/** Immediate donor wording only — never mature donor outcome claims. */
export function buildImmediateDonorLimitation(
  reconstruction: SurgeryDayProcedureReconstruction
): string | null {
  if (!reconstruction.donor) return null;
  const pattern =
    reconstruction.donor.extractionDistribution?.observation ??
    reconstruction.donor.extractionPattern?.observation;
  if (!pattern) {
    return "Immediate postoperative donor evidence is present but limited; mature donor appearance after healing cannot yet be assessed.";
  }
  return "Immediate postoperative donor evidence shows extraction characteristics across the visible donor region; mature donor appearance after healing cannot yet be assessed.";
}
