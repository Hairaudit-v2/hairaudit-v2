/**
 * HA-PROJECTION-1F — Stage assessability + domain-specific comparison rules.
 *
 * Status comes from structured semantic signals, not raw string equality,
 * embeddings, lexical overlap, or sentiment.
 */

import type {
  LongitudinalEvidenceRole,
  LongitudinalObservedFeature,
  LongitudinalOutcomeObservation,
  LongitudinalOutcomeStage,
  PatientSafeProjectedCharacteristic,
  ProjectionComparisonStatus,
  ProjectionDomainComparison,
  ProjectedOutcomeDomain,
  SurgeryDayProcedureReconstruction,
  SurgeryDayProjectedOutcome,
} from "./types";
import { normalizeRecipientZone, uniqueNormalizedZones } from "./surgeryDayZones";
import { deriveComparisonConfidence } from "./projectionComparisonConfidence";

/** How fairly a domain can be assessed at a given follow-up stage. */
export type DomainAssessability =
  | "not_yet_assessable"
  | "limited"
  | "partial"
  | "assessable";

/**
 * Explicit stage × domain assessability matrix.
 * Documented in HA-PROJECTION-1F evidence.
 */
export const STAGE_DOMAIN_ASSESSABILITY: Record<
  LongitudinalOutcomeStage,
  Record<ProjectedOutcomeDomain, DomainAssessability>
> = {
  month_3: {
    frontal_framing: "limited",
    density_distribution: "not_yet_assessable",
    transition_characteristics: "not_yet_assessable",
    native_hair_dependency: "partial",
    untreated_or_lower_treatment_areas: "assessable",
  },
  month_6: {
    frontal_framing: "partial",
    density_distribution: "partial",
    transition_characteristics: "partial",
    native_hair_dependency: "assessable",
    untreated_or_lower_treatment_areas: "assessable",
  },
  month_9: {
    frontal_framing: "assessable",
    density_distribution: "assessable",
    transition_characteristics: "assessable",
    native_hair_dependency: "assessable",
    untreated_or_lower_treatment_areas: "assessable",
  },
  month_12: {
    frontal_framing: "assessable",
    density_distribution: "assessable",
    transition_characteristics: "assessable",
    native_hair_dependency: "assessable",
    untreated_or_lower_treatment_areas: "assessable",
  },
};

export function getDomainAssessability(
  stage: LongitudinalOutcomeStage,
  domain: ProjectedOutcomeDomain
): DomainAssessability {
  return STAGE_DOMAIN_ASSESSABILITY[stage][domain];
}

/* -------------------------------------------------------------------------- */
/* Observation feature mapping                                                */
/* -------------------------------------------------------------------------- */

export type DomainObservationBundle = {
  features: LongitudinalObservedFeature[];
  sourceKeys: string[];
  presentRoles: LongitudinalEvidenceRole[];
};

/**
 * Map 1B domains → corresponding 1E observation features.
 * Does not invent domains absent from the frozen projection.
 */
export function collectObservationForDomain(
  observation: LongitudinalOutcomeObservation,
  domain: ProjectedOutcomeDomain
): DomainObservationBundle {
  const features: LongitudinalObservedFeature[] = [];
  const push = (f: LongitudinalObservedFeature | null | undefined) => {
    if (f) features.push(f);
  };

  switch (domain) {
    case "frontal_framing":
      push(observation.recipient.frontalAppearance);
      break;
    case "density_distribution":
      push(observation.recipient.densityAppearance);
      break;
    case "transition_characteristics":
      push(observation.recipient.transitionAppearance);
      break;
    case "native_hair_dependency":
      push(observation.nativeHair.visibleNativeHairStatus);
      push(observation.nativeHair.treatedVsUntreatedRelationship);
      break;
    case "untreated_or_lower_treatment_areas":
      push(observation.recipient.crownAppearance);
      push(observation.recipient.densityAppearance);
      for (const ov of observation.overallObservations) push(ov);
      break;
  }

  const sourceKeys = features.map((f) => f.key);
  const presentRoles = [
    ...new Set(features.flatMap((f) => f.evidenceRoles)),
  ] as LongitudinalEvidenceRole[];

  return { features, sourceKeys, presentRoles };
}

function requiredRolesForDomain(
  domain: ProjectedOutcomeDomain
): LongitudinalEvidenceRole[] {
  switch (domain) {
    case "frontal_framing":
      return ["followup_front"];
    case "density_distribution":
      return ["followup_front", "followup_top", "followup_recipient_closeup"];
    case "transition_characteristics":
      return ["followup_front", "followup_recipient_closeup"];
    case "native_hair_dependency":
      return ["followup_front", "followup_top"];
    case "untreated_or_lower_treatment_areas":
      return ["followup_crown", "followup_top", "followup_front"];
  }
}

export function hasAdequateEvidenceForDomain(
  observation: LongitudinalOutcomeObservation,
  domain: ProjectedOutcomeDomain,
  bundle: DomainObservationBundle
): boolean {
  if (!bundle.features.length) return false;
  const present = new Set(observation.evidence.presentRoles);
  const required = requiredRolesForDomain(domain);
  return required.some((r) => present.has(r));
}

/* -------------------------------------------------------------------------- */
/* Semantic signals (structured rules — not string similarity)                */
/* -------------------------------------------------------------------------- */

export type FrontalSignal =
  | "frontal_dominant"
  | "frontal_present_mixed"
  | "frontal_not_dominant"
  | "unclear";

export type DensitySignal =
  | "anterior_stronger"
  | "posterior_stronger"
  | "even_or_unclear";

export type TransitionSignal =
  | "graduated_soft"
  | "abrupt_linear"
  | "unclear";

export type NativeSignal =
  | "native_contributing"
  | "native_not_contributing"
  | "unclear";

export type UntreatedSignal =
  | "untreated_lower_than_treated"
  | "untreated_matching_or_higher"
  | "scope_noted"
  | "unclear";

function joinTexts(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function extractFrontalSignal(text: string): FrontalSignal {
  const t = text.toLowerCase();
  if (
    /less dominant|uneven|weaker than|not (the )?dominant|adjacent untreated native/.test(
      t
    )
  ) {
    return "frontal_not_dominant";
  }
  if (
    /dominant|strongest visual|strengthen the visual frame|framing effect|primary.*frontal|frontal coverage is (visibly )?established|remains the dominant/.test(
      t
    )
  ) {
    return "frontal_dominant";
  }
  if (/frontal|framing|coverage is visible|visible frontal/.test(t)) {
    return "frontal_present_mixed";
  }
  return "unclear";
}

export function extractDensitySignal(text: string): DensitySignal {
  const t = text.toLowerCase();
  if (
    /posterior.*(denser|stronger|higher)|visually denser than the frontal|denser than the frontal/.test(
      t
    )
  ) {
    return "posterior_stronger";
  }
  if (
    /strongest.*(?:frontal|anterior)|frontal.*(?:stronger|denser)|anteriorly rather than posteriorly|denser through the frontal|frontal density appears stronger/.test(
      t
    )
  ) {
    return "anterior_stronger";
  }
  return "even_or_unclear";
}

export function extractTransitionSignal(text: string): TransitionSignal {
  const t = text.toLowerCase();
  if (/abrupt|uniformly linear|straight edge|hard edge|uniform linear/.test(t)) {
    return "abrupt_linear";
  }
  if (
    /graduat|soft(?:er)? visual transition|irregular and progressively blended|progressively blended|soft and graduated|appears irregular/.test(
      t
    )
  ) {
    return "graduated_soft";
  }
  return "unclear";
}

export function extractNativeSignal(text: string): NativeSignal {
  const t = text.toLowerCase();
  if (
    /no longer visibly contributing|no longer contributing|native.*(?:absent|not visible|gone)/.test(
      t
    )
  ) {
    return "native_not_contributing";
  }
  if (
    /partly dependent|continues to contribute|native.*contribut|remains part of|mid-scalp continues|preservation of native/.test(
      t
    )
  ) {
    return "native_contributing";
  }
  return "unclear";
}

export function extractUntreatedSignal(text: string): UntreatedSignal {
  const t = text.toLowerCase();
  if (
    /crown.*(?:lower density|lower than|less dens)|remains visibly lower|should not be assumed to develop the same|not (a )?primary treatment/.test(
      t
    )
  ) {
    if (/not (a )?primary treatment|should not be assumed/.test(t)) {
      return "scope_noted";
    }
    return "untreated_lower_than_treated";
  }
  if (/crown.*(?:matching|equal|denser than frontal|stronger than frontal)/.test(t)) {
    return "untreated_matching_or_higher";
  }
  if (/untreated|lower-treatment|lower treatment|crown/.test(t)) {
    return "scope_noted";
  }
  return "unclear";
}

function compareFrontal(
  projected: FrontalSignal,
  observed: FrontalSignal
): ProjectionComparisonStatus {
  if (projected === "unclear" || observed === "unclear") {
    return observed === "unclear" ? "insufficient_evidence" : "partially_consistent";
  }
  if (projected === observed) return "consistent";
  if (
    (projected === "frontal_dominant" && observed === "frontal_present_mixed") ||
    (projected === "frontal_present_mixed" && observed === "frontal_dominant")
  ) {
    return "partially_consistent";
  }
  if (
    (projected === "frontal_dominant" && observed === "frontal_not_dominant") ||
    (projected === "frontal_not_dominant" && observed === "frontal_dominant")
  ) {
    return "divergent";
  }
  return "partially_consistent";
}

function compareDensity(
  projected: DensitySignal,
  observed: DensitySignal
): ProjectionComparisonStatus {
  if (projected === "even_or_unclear" || observed === "even_or_unclear") {
    return observed === "even_or_unclear"
      ? "partially_consistent"
      : "partially_consistent";
  }
  if (projected === observed) return "consistent";
  if (
    (projected === "anterior_stronger" && observed === "posterior_stronger") ||
    (projected === "posterior_stronger" && observed === "anterior_stronger")
  ) {
    return "divergent";
  }
  return "partially_consistent";
}

function compareTransition(
  projected: TransitionSignal,
  observed: TransitionSignal
): ProjectionComparisonStatus {
  if (projected === "unclear" || observed === "unclear") {
    return "partially_consistent";
  }
  if (projected === observed) return "consistent";
  if (
    (projected === "graduated_soft" && observed === "abrupt_linear") ||
    (projected === "abrupt_linear" && observed === "graduated_soft")
  ) {
    return "divergent";
  }
  return "partially_consistent";
}

function compareNative(
  projected: NativeSignal,
  observed: NativeSignal
): ProjectionComparisonStatus {
  if (projected === "unclear" || observed === "unclear") {
    return observed === "unclear" ? "insufficient_evidence" : "partially_consistent";
  }
  if (projected === observed) return "consistent";
  if (
    (projected === "native_contributing" && observed === "native_not_contributing") ||
    (projected === "native_not_contributing" && observed === "native_contributing")
  ) {
    return "divergent";
  }
  return "partially_consistent";
}

function compareUntreated(
  projected: UntreatedSignal,
  observed: UntreatedSignal,
  crownTreated: boolean
): ProjectionComparisonStatus {
  // Untreated crown with lower observed density is scope-consistent, not divergence
  if (!crownTreated) {
    if (
      observed === "untreated_lower_than_treated" ||
      observed === "scope_noted" ||
      projected === "scope_noted"
    ) {
      return "consistent";
    }
    if (observed === "untreated_matching_or_higher") {
      // Unexpected density in untreated zone — descriptive partial, not procedural failure
      return "partially_consistent";
    }
  }
  if (projected === observed) return "consistent";
  if (projected === "unclear" || observed === "unclear") {
    return "partially_consistent";
  }
  return "partially_consistent";
}

function applyAssessabilityCap(
  status: ProjectionComparisonStatus,
  assessability: DomainAssessability
): ProjectionComparisonStatus {
  if (assessability === "not_yet_assessable") return "not_yet_assessable";
  // Limited (e.g. month-3 frontal): never apply mature divergent judgement
  if (assessability === "limited" && status === "divergent") {
    return "partially_consistent";
  }
  return status;
}

function treatedZonesFromReconstruction(
  reconstruction: SurgeryDayProcedureReconstruction | null | undefined
): string[] {
  if (!reconstruction) return [];
  const raw = [
    ...reconstruction.procedureContext.treatedAreas,
    ...reconstruction.recipient.observedTreatedAreas,
  ];
  return uniqueNormalizedZones(
    raw.map((r) => ({
      normalized: normalizeRecipientZone(r),
      raw: r,
      source: "areas_treated" as const,
    }))
  );
}

function crownWasTreated(
  reconstruction: SurgeryDayProcedureReconstruction | null | undefined
): boolean {
  return treatedZonesFromReconstruction(reconstruction).includes("crown");
}

function templesWereProjected(
  projected: PatientSafeProjectedCharacteristic
): boolean {
  const t = joinTexts([projected.observation, projected.projection]);
  return /temple/.test(t);
}

function buildRationale(args: {
  domain: ProjectedOutcomeDomain;
  status: ProjectionComparisonStatus;
  stage: LongitudinalOutcomeStage;
  projectedText: string;
  observedText: string | null;
}): string {
  const stageLabel = args.stage.replace("month_", "month ");
  const observed = args.observedText?.trim() || "no comparable observation was available";

  switch (args.status) {
    case "not_yet_assessable":
      return `At ${stageLabel}, ${args.domain.replace(/_/g, " ")} cannot yet be fairly compared with the original surgery-day projection.`;
    case "insufficient_evidence":
      return `The follow-up stage may support comparison for ${args.domain.replace(/_/g, " ")}, but the submitted evidence is inadequate to evaluate this domain.`;
    case "consistent":
      return `The original projection described: "${truncate(args.projectedText, 160)}" At ${stageLabel}, the submitted evidence shows: "${truncate(observed, 160)}" These characteristics broadly align.`;
    case "partially_consistent":
      return `The original projection described: "${truncate(args.projectedText, 140)}" At ${stageLabel}, the submitted evidence shows: "${truncate(observed, 140)}" Some features align while others remain mixed or incomplete.`;
    case "divergent":
      return `The original projection described: "${truncate(args.projectedText, 140)}" At ${stageLabel}, the submitted evidence shows: "${truncate(observed, 140)}" The observed pattern differs materially from the projected characteristic.`;
  }
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1).trimEnd()}…`;
}

/**
 * Compare a single projected domain against linked observation features.
 */
export function compareProjectedDomain(args: {
  characteristic: PatientSafeProjectedCharacteristic;
  observation: LongitudinalOutcomeObservation;
  reconstruction?: SurgeryDayProcedureReconstruction | null;
}): ProjectionDomainComparison {
  const { characteristic, observation } = args;
  const domain = characteristic.domain;
  const stage = observation.stage;
  const assessability = getDomainAssessability(stage, domain);
  const bundle = collectObservationForDomain(observation, domain);
  const projectedText = characteristic.projection;
  const observedText =
    bundle.features.map((f) => f.observation).join(" ").trim() || null;

  const limitations: string[] = [
    ...characteristic.limitations,
    ...observation.evidence.limitations.slice(0, 2),
  ];

  if (assessability === "not_yet_assessable") {
    return finalizeDomain({
      domain,
      projectedText,
      observedText,
      status: "not_yet_assessable",
      assessability,
      stage,
      characteristic,
      observation,
      bundle,
      limitations: [
        ...limitations,
        `Stage ${stage} is too early for a mature comparison of ${domain.replace(/_/g, " ")}.`,
      ],
    });
  }

  if (!hasAdequateEvidenceForDomain(observation, domain, bundle) || !observedText) {
    return finalizeDomain({
      domain,
      projectedText,
      observedText,
      status: "insufficient_evidence",
      assessability,
      stage,
      characteristic,
      observation,
      bundle,
      limitations: [
        ...limitations,
        "Submitted follow-up views are inadequate to evaluate this projected domain.",
      ],
    });
  }

  // Temples not part of projected characteristic → do not invent temple comparison noise
  if (
    domain === "untreated_or_lower_treatment_areas" &&
    !templesWereProjected(characteristic)
  ) {
    // Still allow crown/untreated comparison; temple-only observations ignored below via signals
  }

  let status: ProjectionComparisonStatus = "partially_consistent";

  switch (domain) {
    case "frontal_framing": {
      const p = extractFrontalSignal(joinTexts([characteristic.observation, projectedText]));
      const o = extractFrontalSignal(observedText);
      status = compareFrontal(p, o);
      break;
    }
    case "density_distribution": {
      const p = extractDensitySignal(joinTexts([characteristic.observation, projectedText]));
      const o = extractDensitySignal(observedText);
      status = compareDensity(p, o);
      break;
    }
    case "transition_characteristics": {
      const p = extractTransitionSignal(
        joinTexts([characteristic.observation, projectedText])
      );
      const o = extractTransitionSignal(observedText);
      status = compareTransition(p, o);
      break;
    }
    case "native_hair_dependency": {
      const p = extractNativeSignal(joinTexts([characteristic.observation, projectedText]));
      const o = extractNativeSignal(observedText);
      status = compareNative(p, o);
      // Native change is descriptive — never framed as treatment failure in rationale
      break;
    }
    case "untreated_or_lower_treatment_areas": {
      const p = extractUntreatedSignal(
        joinTexts([characteristic.observation, projectedText])
      );
      const o = extractUntreatedSignal(observedText);
      status = compareUntreated(p, o, crownWasTreated(args.reconstruction));
      break;
    }
  }

  status = applyAssessabilityCap(status, assessability);

  return finalizeDomain({
    domain,
    projectedText,
    observedText,
    status,
    assessability,
    stage,
    characteristic,
    observation,
    bundle,
    limitations,
  });
}

function finalizeDomain(args: {
  domain: ProjectedOutcomeDomain;
  projectedText: string;
  observedText: string | null;
  status: ProjectionComparisonStatus;
  assessability: DomainAssessability;
  stage: LongitudinalOutcomeStage;
  characteristic: PatientSafeProjectedCharacteristic;
  observation: LongitudinalOutcomeObservation;
  bundle: DomainObservationBundle;
  limitations: string[];
}): ProjectionDomainComparison {
  const obsConf =
    args.bundle.features.reduce<"low" | "moderate" | "high" | null>((acc, f) => {
      if (!acc) return f.confidence;
      if (f.confidence === "low" || acc === "low") return "low";
      if (f.confidence === "moderate" || acc === "moderate") return "moderate";
      return "high";
    }, null) ?? args.observation.evidence.confidence;

  const confidence = deriveComparisonConfidence({
    stage: args.stage,
    domainAssessability: args.assessability,
    projectionConfidence: args.characteristic.confidence,
    observationConfidence: obsConf,
    evidenceComplete: Boolean(args.observedText) && args.bundle.features.length > 0,
    directDomainMatch: args.bundle.sourceKeys.length > 0,
    limitationCount: args.limitations.length,
    status: args.status,
  });

  const rationale = buildRationale({
    domain: args.domain,
    status: args.status,
    stage: args.stage,
    projectedText: args.projectedText,
    observedText: args.observedText,
  });

  return {
    domain: args.domain,
    projectedCharacteristic: args.projectedText,
    observedCharacteristic: args.observedText,
    status: args.status,
    confidence,
    rationale,
    limitations: [...new Set(args.limitations.map((l) => l.trim()).filter(Boolean))],
    projectionSourceKeys: [...args.characteristic.sourceObservationKeys],
    observationSourceKeys: [...args.bundle.sourceKeys],
  };
}

/**
 * Derive overall status from domain statuses.
 *
 * Weighting:
 * - If no domains stage-assessable → not_yet_assessable
 * - If assessable but all insufficient → insufficient_evidence
 * - If any material high/moderate-confidence divergent domains dominate → divergent
 * - Single divergent among otherwise consistent → partially_consistent
 * - Mix of consistent + partially_consistent → partially_consistent
 * - All comparable domains consistent → consistent
 */
export function deriveOverallComparisonStatus(
  domains: ProjectionDomainComparison[]
): ProjectionComparisonStatus {
  if (!domains.length) return "insufficient_evidence";

  const nonDeferred = domains.filter((d) => d.status !== "not_yet_assessable");
  if (!nonDeferred.length) return "not_yet_assessable";

  const comparable = nonDeferred.filter((d) => d.status !== "insufficient_evidence");
  if (!comparable.length) return "insufficient_evidence";

  const divergent = comparable.filter((d) => d.status === "divergent");
  const consistent = comparable.filter((d) => d.status === "consistent");
  const partial = comparable.filter((d) => d.status === "partially_consistent");

  if (divergent.length) {
    const materialDivergent = divergent.filter((d) => d.confidence !== "low");
    if (
      materialDivergent.length >= 2 ||
      materialDivergent.length >= Math.ceil(comparable.length / 2)
    ) {
      return "divergent";
    }
    return "partially_consistent";
  }

  if (consistent.length === comparable.length) return "consistent";
  if (partial.length || consistent.length) return "partially_consistent";
  return "partially_consistent";
}

export function buildComparisonSummary(args: {
  stage: LongitudinalOutcomeStage;
  overallStatus: ProjectionComparisonStatus;
  domains: ProjectionDomainComparison[];
}): string {
  const stageLabel =
    args.stage === "month_3"
      ? "3-month"
      : args.stage === "month_6"
        ? "6-month"
        : args.stage === "month_9"
          ? "9-month"
          : "12-month";

  const consistentDomains = args.domains
    .filter((d) => d.status === "consistent")
    .map((d) => d.domain.replace(/_/g, " "));
  const partialDomains = args.domains
    .filter((d) => d.status === "partially_consistent")
    .map((d) => d.domain.replace(/_/g, " "));
  const notYet = args.domains
    .filter((d) => d.status === "not_yet_assessable")
    .map((d) => d.domain.replace(/_/g, " "));

  if (args.overallStatus === "not_yet_assessable") {
    return `At this ${stageLabel} stage, projected characteristics cannot yet be fairly compared with the submitted follow-up evidence for the available domains.`;
  }
  if (args.overallStatus === "insufficient_evidence") {
    return `The ${stageLabel} stage may support comparison, but the submitted follow-up evidence is inadequate to evaluate the projected domains.`;
  }

  const parts: string[] = [];
  if (args.stage === "month_3" || args.stage === "month_6") {
    parts.push(
      `At this stage, some projected characteristics can be compared with the submitted follow-up evidence.`
    );
  } else {
    parts.push(
      `The submitted ${stageLabel} evidence can be compared with the original surgery-day projection across the available domains.`
    );
  }

  if (consistentDomains.length) {
    parts.push(
      `${capitalize(consistentDomains.join(" and "))} appear${consistentDomains.length === 1 ? "s" : ""} broadly consistent with the original projection.`
    );
  }
  if (partialDomains.length) {
    parts.push(
      `${capitalize(partialDomains.join(" and "))} remain${partialDomains.length === 1 ? "s" : ""} only partially assessable or mixed.`
    );
  }
  if (notYet.length && (args.stage === "month_3" || args.stage === "month_6")) {
    parts.push(
      `${capitalize(notYet.join(" and "))} ${notYet.length === 1 ? "is" : "are"} not yet assessable at this stage.`
    );
  }
  if (args.overallStatus === "divergent") {
    parts.push(
      "One or more projected characteristics differ materially from what is visible in the submitted follow-up evidence."
    );
  }

  return parts.join(" ");
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Domains present in frozen 1B outcome — omit anything not projected. */
export function listComparableProjectedDomains(
  projectedOutcome: SurgeryDayProjectedOutcome
): PatientSafeProjectedCharacteristic[] {
  return projectedOutcome.projectedCharacteristics.filter((c) =>
    Boolean(c?.domain && c.projection)
  );
}
