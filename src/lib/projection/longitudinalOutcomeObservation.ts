/**
 * HA-PROJECTION-1E — Deterministic builder for LongitudinalOutcomeObservation.
 *
 * Answers only: "What can HairAudit observe at this follow-up stage?"
 * No projection comparison, success scoring, or prediction logic.
 */

import {
  assessLongitudinalEvidence,
  isCrownRelevant,
  resolveLongitudinalEvidenceRole,
  resolveLongitudinalOutcomeStage,
  type LongitudinalEvidenceAssessment,
} from "./longitudinalEvidence";
import {
  deriveObservationConfidence,
  extractLongitudinalObservationConfidenceFactors,
} from "./longitudinalObservationConfidence";
import {
  STAGE_AWARE_OBSERVATION_TEMPLATES,
  assertPatientSafeLongitudinalObservation,
  sanitizeLongitudinalObservationText,
} from "./longitudinalObservationSafety";
import type {
  LongitudinalEvidenceContext,
  LongitudinalEvidenceRole,
  LongitudinalObservedFeature,
  LongitudinalObservedFeatureSource,
  LongitudinalOutcomeObservation,
  LongitudinalOutcomeStage,
  ObservationConfidence,
  ProjectionUploadInput,
  SurgeryDayProcedureReconstruction,
} from "./types";

export type BuildLongitudinalOutcomeObservationInput = {
  projectionSnapshotId: string;
  caseId: string;
  patientId: string;
  stage: LongitudinalOutcomeStage;
  observedAt: string;
  uploads: ProjectionUploadInput[];
  caseContext?: LongitudinalEvidenceContext;
  /** Frozen 1A reconstruction from the linked projection (treatment-aware evidence). */
  reconstruction?: SurgeryDayProcedureReconstruction | null;
  /** Optional structured observations already available (forensic / auditor / patient). */
  structuredObservations?: Array<{
    key: string;
    label: string;
    observation: string;
    confidence?: ObservationConfidence;
    evidenceRoles?: LongitudinalEvidenceRole[];
    source?: LongitudinalObservedFeatureSource;
  }>;
  imageQuality?: ObservationConfidence;
  baselineAvailable?: boolean;
};

export type BuildLongitudinalOutcomeObservationResult =
  | { ok: true; observation: LongitudinalOutcomeObservation }
  | { ok: false; reason: string; observation: null };

function feature(
  key: string,
  label: string,
  observation: string,
  confidence: ObservationConfidence,
  evidenceRoles: LongitudinalEvidenceRole[],
  source: LongitudinalObservedFeatureSource = "rule"
): LongitudinalObservedFeature | null {
  const safe = sanitizeLongitudinalObservationText(observation);
  if (!safe) return null;
  return { key, label, observation: safe, confidence, evidenceRoles, source };
}

function collectTexts(o: LongitudinalOutcomeObservation): string[] {
  const texts: string[] = [...o.limitations, ...o.evidence.limitations];
  const push = (f: LongitudinalObservedFeature | null | undefined) => {
    if (f) texts.push(f.label, f.observation);
  };
  push(o.recipient.frontalAppearance);
  push(o.recipient.densityAppearance);
  push(o.recipient.transitionAppearance);
  push(o.recipient.directionalAppearance);
  push(o.recipient.crownAppearance);
  if (o.donor) {
    push(o.donor.donorAppearance);
    push(o.donor.visibleDepletionPattern);
    push(o.donor.visibleScarring);
  }
  push(o.nativeHair.visibleNativeHairStatus);
  push(o.nativeHair.treatedVsUntreatedRelationship);
  push(o.healing.visibleHealingStatus);
  for (const c of o.healing.visibleConcerns) push(c);
  for (const ov of o.overallObservations) push(ov);
  return texts;
}

function frontalTemplate(stage: LongitudinalOutcomeStage): string {
  switch (stage) {
    case "month_3":
      return STAGE_AWARE_OBSERVATION_TEMPLATES.month_3.frontalSparse;
    case "month_6":
      return STAGE_AWARE_OBSERVATION_TEMPLATES.month_6.frontalDeveloping;
    case "month_9":
      return STAGE_AWARE_OBSERVATION_TEMPLATES.month_9.frontalMaturing;
    case "month_12":
      return STAGE_AWARE_OBSERVATION_TEMPLATES.month_12.frontalMature;
  }
}

function densityTemplate(stage: LongitudinalOutcomeStage): string {
  switch (stage) {
    case "month_3":
      return STAGE_AWARE_OBSERVATION_TEMPLATES.month_3.densityDeveloping;
    case "month_6":
      return STAGE_AWARE_OBSERVATION_TEMPLATES.month_6.densityDeveloping;
    case "month_9":
      return STAGE_AWARE_OBSERVATION_TEMPLATES.month_9.densityMaturing;
    case "month_12":
      return STAGE_AWARE_OBSERVATION_TEMPLATES.month_12.densityMature;
  }
}

function donorTemplate(stage: LongitudinalOutcomeStage): string {
  switch (stage) {
    case "month_3":
      return STAGE_AWARE_OBSERVATION_TEMPLATES.month_3.donorVariation;
    case "month_6":
      return STAGE_AWARE_OBSERVATION_TEMPLATES.month_6.donorVariation;
    case "month_9":
      return STAGE_AWARE_OBSERVATION_TEMPLATES.month_9.donorAppearance;
    case "month_12":
      return STAGE_AWARE_OBSERVATION_TEMPLATES.month_12.donorAppearance;
  }
}

function pickStructured(
  structured: BuildLongitudinalOutcomeObservationInput["structuredObservations"],
  keys: string[]
): (NonNullable<BuildLongitudinalOutcomeObservationInput["structuredObservations"]>[number]) | null {
  if (!structured?.length) return null;
  for (const key of keys) {
    const hit = structured.find((s) => s.key === key || s.key.endsWith(`.${key}`));
    if (hit) return hit;
  }
  return null;
}

function fromStructured(
  s: ReturnType<typeof pickStructured>,
  fallbackRoles: LongitudinalEvidenceRole[],
  fallbackConfidence: ObservationConfidence
): LongitudinalObservedFeature | null {
  if (!s) return null;
  return feature(
    s.key,
    s.label,
    s.observation,
    s.confidence ?? fallbackConfidence,
    s.evidenceRoles?.length ? s.evidenceRoles : fallbackRoles,
    s.source ?? "mixed"
  );
}

/**
 * Collect uploads usable for the requested exact stage.
 */
export function collectStageEvidence(
  uploads: ProjectionUploadInput[],
  stage: LongitudinalOutcomeStage,
  caseContext: LongitudinalEvidenceContext = {}
): {
  presentRoles: LongitudinalEvidenceRole[];
  usableUploads: ProjectionUploadInput[];
  rejected: Array<{ uploadId: string | null; reason: string }>;
  weakestStageConfidence: ObservationConfidence;
} {
  const presentRoles: LongitudinalEvidenceRole[] = [];
  const usableUploads: ProjectionUploadInput[] = [];
  const rejected: Array<{ uploadId: string | null; reason: string }> = [];
  let weakest: ObservationConfidence = "high";

  for (const upload of uploads) {
    const roleResolved = resolveLongitudinalEvidenceRole(upload, caseContext);
    if (!roleResolved.role) continue;

    const stageResolved = resolveLongitudinalOutcomeStage(upload, caseContext);
    if (!stageResolved.usableForExactStage || stageResolved.stage !== stage) {
      rejected.push({
        uploadId: upload.id ?? null,
        reason:
          stageResolved.conflictReason ??
          `Upload not usable for exact stage ${stage}.`,
      });
      continue;
    }

    presentRoles.push(roleResolved.role);
    usableUploads.push(upload);
    if (stageResolved.stageConfidence === "low") weakest = "low";
    else if (stageResolved.stageConfidence === "moderate" && weakest === "high") {
      weakest = "moderate";
    }
  }

  return {
    presentRoles: [...new Set(presentRoles)],
    usableUploads,
    rejected,
    weakestStageConfidence: presentRoles.length ? weakest : "low",
  };
}

function buildRecipientFeatures(args: {
  stage: LongitudinalOutcomeStage;
  present: LongitudinalEvidenceRole[];
  confidence: ObservationConfidence;
  crownRelevant: boolean;
  structured?: BuildLongitudinalOutcomeObservationInput["structuredObservations"];
}): LongitudinalOutcomeObservation["recipient"] {
  const frontRoles: LongitudinalEvidenceRole[] = args.present.includes("followup_front")
    ? ["followup_front"]
    : args.present.slice(0, 1);

  const frontal =
    fromStructured(
      pickStructured(args.structured, ["frontal_appearance", "frontalAppearance"]),
      frontRoles,
      args.confidence
    ) ??
    (args.present.includes("followup_front")
      ? feature(
          "frontal_appearance",
          "Frontal appearance",
          frontalTemplate(args.stage),
          args.confidence,
          ["followup_front"]
        )
      : null);

  const density =
    fromStructured(
      pickStructured(args.structured, ["density_appearance", "densityAppearance"]),
      frontRoles,
      args.confidence
    ) ??
    (args.present.some((r) =>
      r === "followup_front" || r === "followup_top" || r === "followup_recipient_closeup"
    )
      ? feature(
          "density_appearance",
          "Density appearance",
          densityTemplate(args.stage),
          args.confidence,
          args.present.filter((r) =>
            ["followup_front", "followup_top", "followup_recipient_closeup"].includes(r)
          ) as LongitudinalEvidenceRole[]
        )
      : null);

  const transition =
    fromStructured(
      pickStructured(args.structured, ["transition_appearance", "transitionAppearance"]),
      frontRoles,
      args.confidence
    ) ??
    (args.present.includes("followup_front") || args.present.includes("followup_recipient_closeup")
      ? feature(
          "transition_appearance",
          "Transition appearance",
          "Visible transition characteristics are recorded where the submitted views allow observation.",
          args.confidence === "high" ? "moderate" : args.confidence,
          args.present.filter((r) =>
            ["followup_front", "followup_recipient_closeup", "followup_left", "followup_right"].includes(
              r
            )
          ) as LongitudinalEvidenceRole[]
        )
      : null);

  const directional =
    fromStructured(
      pickStructured(args.structured, ["directional_appearance", "directionalAppearance"]),
      frontRoles,
      args.confidence
    ) ??
    (args.present.includes("followup_top") || args.present.includes("followup_crown")
      ? feature(
          "directional_appearance",
          "Directional appearance",
          "Visible hair direction is recorded where top or crown follow-up evidence is available.",
          args.confidence === "high" ? "moderate" : args.confidence,
          args.present.filter((r) =>
            ["followup_top", "followup_crown", "followup_front"].includes(r)
          ) as LongitudinalEvidenceRole[]
        )
      : null);

  const crown =
    args.crownRelevant && args.present.includes("followup_crown")
      ? fromStructured(
          pickStructured(args.structured, ["crown_appearance", "crownAppearance"]),
          ["followup_crown"],
          args.confidence
        ) ??
        feature(
          "crown_appearance",
          "Crown appearance",
          "Visible crown appearance is recorded from the submitted follow-up crown view.",
          args.confidence,
          ["followup_crown"]
        )
      : fromStructured(
          pickStructured(args.structured, ["crown_appearance", "crownAppearance"]),
          ["followup_crown"],
          args.confidence
        );

  return {
    frontalAppearance: frontal,
    densityAppearance: density,
    transitionAppearance: transition,
    directionalAppearance: directional,
    crownAppearance: crown,
  };
}

function buildDonorFeatures(args: {
  stage: LongitudinalOutcomeStage;
  present: LongitudinalEvidenceRole[];
  confidence: ObservationConfidence;
  structured?: BuildLongitudinalOutcomeObservationInput["structuredObservations"];
}): LongitudinalOutcomeObservation["donor"] {
  const hasDonor =
    args.present.includes("followup_donor_rear") ||
    args.present.includes("followup_donor_closeup");
  if (!hasDonor) return null;

  const donorRoles = args.present.filter((r) =>
    r === "followup_donor_rear" || r === "followup_donor_closeup"
  ) as LongitudinalEvidenceRole[];

  const donorText = donorTemplate(args.stage);

  // Stage-aware: never claim permanent damage from early-stage images
  const scarringText =
    args.stage === "month_3" || args.stage === "month_6"
      ? "Visible donor variation or textural change may be present; permanent scarring cannot yet be determined from early-stage images alone."
      : "Visible scarring appearance is recorded where donor follow-up evidence allows observation.";

  return {
    donorAppearance:
      fromStructured(
        pickStructured(args.structured, ["donor_appearance", "donorAppearance"]),
        donorRoles,
        args.confidence
      ) ??
      feature("donor_appearance", "Donor appearance", donorText, args.confidence, donorRoles),
    visibleDepletionPattern:
      fromStructured(
        pickStructured(args.structured, [
          "visible_depletion_pattern",
          "visibleDepletionPattern",
        ]),
        donorRoles,
        args.confidence
      ) ??
      feature(
        "visible_depletion_pattern",
        "Visible depletion pattern",
        "Visible donor homogeneity or patchiness is recorded where the submitted views allow observation. Exact remaining donor density cannot be measured from these images alone.",
        args.confidence === "high" ? "moderate" : args.confidence,
        donorRoles
      ),
    visibleScarring:
      fromStructured(
        pickStructured(args.structured, ["visible_scarring", "visibleScarring"]),
        donorRoles,
        args.confidence
      ) ??
      feature(
        "visible_scarring",
        "Visible scarring",
        scarringText,
        args.confidence === "high" ? "moderate" : "low",
        donorRoles
      ),
  };
}

function buildNativeHairFeatures(args: {
  confidence: ObservationConfidence;
  present: LongitudinalEvidenceRole[];
  baselineAvailable: boolean;
  structured?: BuildLongitudinalOutcomeObservationInput["structuredObservations"];
}): LongitudinalOutcomeObservation["nativeHair"] {
  const roles = args.present.filter((r) =>
    ["followup_front", "followup_top", "followup_left", "followup_right"].includes(r)
  ) as LongitudinalEvidenceRole[];

  if (!roles.length && !args.structured?.length) {
    return { visibleNativeHairStatus: null, treatedVsUntreatedRelationship: null };
  }

  return {
    visibleNativeHairStatus:
      fromStructured(
        pickStructured(args.structured, [
          "native_hair_status",
          "visible_native_hair_status",
          "visibleNativeHairStatus",
        ]),
        roles,
        args.confidence
      ) ??
      (roles.length
        ? feature(
            "native_hair_status",
            "Visible native hair status",
            args.baselineAvailable
              ? "Visible native hair is recorded in untreated or surrounding regions where the submitted views allow observation."
              : "Visible native hair status is recorded from follow-up views where distinguishable; baseline comparison is limited.",
            args.confidence,
            roles
          )
        : null),
    treatedVsUntreatedRelationship:
      fromStructured(
        pickStructured(args.structured, [
          "treated_vs_untreated",
          "treatedVsUntreatedRelationship",
        ]),
        roles,
        args.confidence
      ) ??
      (roles.length
        ? feature(
            "treated_vs_untreated_relationship",
            "Treated vs untreated relationship",
            "The visible relationship between treated and untreated regions is recorded descriptively where image evidence allows. Progression is not diagnosed in this observation.",
            args.confidence === "high" ? "moderate" : args.confidence,
            roles
          )
        : null),
  };
}

function buildHealingFeatures(args: {
  stage: LongitudinalOutcomeStage;
  confidence: ObservationConfidence;
  present: LongitudinalEvidenceRole[];
  structured?: BuildLongitudinalOutcomeObservationInput["structuredObservations"];
}): LongitudinalOutcomeObservation["healing"] {
  const roles = args.present.slice(0, 3);
  const healingStructured = pickStructured(args.structured, [
    "visible_healing_status",
    "visibleHealingStatus",
  ]);

  const status =
    fromStructured(healingStructured, roles, args.confidence) ??
    (args.stage === "month_3"
      ? feature(
          "visible_healing_status",
          "Visible healing status",
          "Early follow-up healing appearance is recorded where visible in the submitted images. Image limitations may restrict assessment.",
          args.confidence,
          roles.length ? roles : ["followup_front"]
        )
      : feature(
          "visible_healing_status",
          "Visible healing status",
          "Visible healing appearance at this follow-up stage is recorded where the submitted views allow observation.",
          args.confidence,
          roles.length ? roles : ["followup_front"]
        ));

  const concerns: LongitudinalObservedFeature[] = [];
  for (const s of args.structured ?? []) {
    if (/concern|redness|crust|inflam|scar/i.test(s.key) || /concern/i.test(s.label)) {
      const f = fromStructured(s, s.evidenceRoles ?? roles, s.confidence ?? args.confidence);
      if (f) concerns.push(f);
    }
  }

  return { visibleHealingStatus: status, visibleConcerns: concerns };
}

/**
 * Build a patient-safe longitudinal outcome observation.
 */
export function buildLongitudinalOutcomeObservation(
  input: BuildLongitudinalOutcomeObservationInput
): BuildLongitudinalOutcomeObservationResult {
  if (!input.projectionSnapshotId?.trim()) {
    return { ok: false, reason: "projectionSnapshotId is required.", observation: null };
  }
  if (!input.caseId?.trim() || !input.patientId?.trim()) {
    return { ok: false, reason: "caseId and patientId are required.", observation: null };
  }
  if (!LONGITUDINAL_STAGES_SET.has(input.stage)) {
    return { ok: false, reason: `Unsupported stage: ${String(input.stage)}`, observation: null };
  }

  const treatedAreas =
    input.caseContext?.treatedAreas ??
    input.reconstruction?.recipient.observedTreatedAreas ??
    input.reconstruction?.procedureContext.treatedAreas ??
    [];

  const caseContext: LongitudinalEvidenceContext = {
    ...input.caseContext,
    treatedAreas,
    declaredStage: input.caseContext?.declaredStage ?? input.stage,
  };

  const collected = collectStageEvidence(input.uploads, input.stage, caseContext);
  const assessment: LongitudinalEvidenceAssessment = assessLongitudinalEvidence({
    stage: input.stage,
    presentRoles: collected.presentRoles,
    treatedAreas,
    stageConfidence: collected.weakestStageConfidence,
  });

  const factors = extractLongitudinalObservationConfidenceFactors({
    assessment,
    stageProvenance: collected.weakestStageConfidence,
    imageQuality: input.imageQuality,
    baselineAvailable: input.baselineAvailable ?? input.reconstruction?.baseline.available,
  });
  const observationConfidence = deriveObservationConfidence(factors);

  const limitations = [
    ...assessment.limitations,
    ...collected.rejected
      .slice(0, 5)
      .map((r) => r.reason)
      .filter(Boolean),
  ];

  if (!assessment.sufficient) {
    limitations.push(
      "Minimum follow-up evidence is incomplete; observation confidence remains limited."
    );
  }

  if (!isCrownRelevant(treatedAreas) && collected.presentRoles.includes("followup_crown")) {
    // Crown present but not treated — still allow observation, note it
    limitations.push(
      "Crown follow-up evidence is present though crown was not identified as a treated area."
    );
  }

  const observation: LongitudinalOutcomeObservation = {
    projectionSnapshotId: input.projectionSnapshotId,
    caseId: input.caseId,
    patientId: input.patientId,
    stage: input.stage,
    observedAt: input.observedAt,
    evidence: {
      confidence: observationConfidence,
      presentRoles: assessment.presentRoles,
      limitations: [...assessment.limitations],
    },
    recipient: buildRecipientFeatures({
      stage: input.stage,
      present: assessment.presentRoles,
      confidence: observationConfidence,
      crownRelevant: assessment.crownRelevant,
      structured: input.structuredObservations,
    }),
    donor: buildDonorFeatures({
      stage: input.stage,
      present: assessment.presentRoles,
      confidence: observationConfidence,
      structured: input.structuredObservations,
    }),
    nativeHair: buildNativeHairFeatures({
      confidence: observationConfidence,
      present: assessment.presentRoles,
      baselineAvailable: Boolean(
        input.baselineAvailable ?? input.reconstruction?.baseline.available
      ),
      structured: input.structuredObservations,
    }),
    healing: buildHealingFeatures({
      stage: input.stage,
      confidence: observationConfidence,
      present: assessment.presentRoles,
      structured: input.structuredObservations,
    }),
    overallObservations: [],
    limitations: [...new Set(limitations.map((l) => sanitizeLongitudinalObservationText(l) ?? l))],
  };

  // Overall observations from leftover structured keys
  for (const s of input.structuredObservations ?? []) {
    if (
      /frontal|density|transition|direction|crown|donor|native|healing|concern/i.test(s.key)
    ) {
      continue;
    }
    const f = feature(
      s.key,
      s.label,
      s.observation,
      s.confidence ?? observationConfidence,
      s.evidenceRoles ?? assessment.presentRoles,
      s.source ?? "mixed"
    );
    if (f) observation.overallObservations.push(f);
  }

  const safety = assertPatientSafeLongitudinalObservation(collectTexts(observation));
  if (!safety.ok) {
    return {
      ok: false,
      reason: `Observation failed patient-safe checks: ${safety.violations
        .map((v) => v.pattern)
        .slice(0, 3)
        .join("; ")}`,
      observation: null,
    };
  }

  return { ok: true, observation };
}

const LONGITUDINAL_STAGES_SET = new Set<string>([
  "month_3",
  "month_6",
  "month_9",
  "month_12",
]);
