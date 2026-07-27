/**
 * HA-PROJECTION-1F — Domain comparison, stage assessability, treatment-aware rules.
 * Run: pnpm exec tsx --test tests/projectionComparison.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { fixtureA_baselinePlusSurgeryDay } from "./fixtures/surgeryDayProjection/fixtures";
import {
  buildProjectionObservedComparison,
  computeComparisonChecksum,
  resolveProjectionContentChecksum,
} from "@/lib/projection/projectionComparison";
import {
  STAGE_DOMAIN_ASSESSABILITY,
  compareProjectedDomain,
  deriveComparisonConfidence,
  deriveOverallComparisonStatus,
  getDomainAssessability,
} from "@/lib/projection";
import { buildLongitudinalOutcomeObservation } from "@/lib/projection/longitudinalOutcomeObservation";
import type {
  LongitudinalOutcomeObservation,
  LongitudinalOutcomeStage,
  PatientSafeProjectedCharacteristic,
  ProjectionComparisonStatus,
  SurgeryDayProjectedOutcome,
} from "@/lib/projection/types";
import type { ProjectionSnapshot } from "@/lib/projection/projectionSnapshotTypes";
import type { ProjectionObservationSnapshot } from "@/lib/projection/projectionObservationTypes";
import { computeObservationChecksum } from "@/lib/projection/projectionObservationService";
import {
  COMPARISON_SCHEMA_VERSION,
  OBSERVATION_SCHEMA_VERSION,
  OBSERVATION_LINEAGE_VERSION,
} from "@/lib/projection/versions";

const CASE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PATIENT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PROJECTION_ID = "11111111-1111-1111-1111-111111111111";
const OBSERVATION_ID = "22222222-2222-2222-2222-222222222222";
const PROCEDURE = "2025-01-15T00:00:00.000Z";

function makeObservationPayload(
  stage: LongitudinalOutcomeStage,
  structured?: Array<{
    key: string;
    label: string;
    observation: string;
    confidence?: "low" | "moderate" | "high";
  }>,
  opts?: { roles?: "minimal" | "full" }
): LongitudinalOutcomeObservation {
  const month = stage.replace("month_", "");
  const capture =
    stage === "month_3"
      ? "2025-04-15T00:00:00.000Z"
      : stage === "month_6"
        ? "2025-07-15T00:00:00.000Z"
        : stage === "month_9"
          ? "2025-10-15T00:00:00.000Z"
          : "2026-01-15T00:00:00.000Z";

  const uploads =
    opts?.roles === "minimal"
      ? [
          {
            id: "d",
            type: `patient_photo:postop_month${month}_donor`,
            captured_at: capture,
          },
        ]
      : [
          {
            id: "f",
            type: `patient_photo:postop_month${month}_front`,
            captured_at: capture,
          },
          {
            id: "t",
            type: `patient_photo:postop_month${month}_top`,
            captured_at: capture,
          },
          {
            id: "d",
            type: `patient_photo:postop_month${month}_donor`,
            captured_at: capture,
          },
        ];

  const built = buildLongitudinalOutcomeObservation({
    projectionSnapshotId: PROJECTION_ID,
    caseId: CASE_ID,
    patientId: PATIENT_ID,
    stage,
    observedAt: capture,
    uploads,
    caseContext: {
      procedureDate: PROCEDURE,
      treatedAreas: ["frontal", "hairline", "temples"],
    },
    structuredObservations: structured,
    baselineAvailable: true,
  });
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error(built.reason);
  return built.observation;
}

function makeProjectionSnapshot(
  overrides?: Partial<SurgeryDayProjectedOutcome>
): ProjectionSnapshot {
  const { reconstruction, projectedOutcome } = fixtureA_baselinePlusSurgeryDay();
  const outcome = { ...projectedOutcome, ...overrides };
  return {
    id: PROJECTION_ID,
    caseId: CASE_ID,
    patientId: PATIENT_ID,
    procedureId: CASE_ID,
    projectionType: outcome.assessmentType,
    projectionStatus: "active",
    reconstructionVersion: "ha-projection-1a-v1",
    projectionEngineVersion: "ha-projection-1b-v1",
    snapshotSchemaVersion: "ha-projection-lineage-v1",
    reportTemplateVersion: 1,
    reconstructionInputChecksum: "recon-checksum",
    projectionInputChecksum: "proj-in-checksum",
    projectionOutputChecksum: "proj-out-checksum",
    reconstructionSnapshot: reconstruction,
    projectionSnapshot: outcome,
    confidenceSummary: {
      reconstructionConfidence: reconstruction.evidence.confidence,
      projectionConfidence: outcome.projectionConfidence,
      characteristicCount: outcome.projectedCharacteristics.length,
      limitationCount: outcome.limitations.length,
    },
    evidenceSummary: {
      presentRoles: reconstruction.evidence.presentRoles,
      baselineAvailable: reconstruction.baseline.available,
      assessmentType: outcome.assessmentType,
      reconstructionAssessmentType: reconstruction.assessmentType,
    },
    createdAt: "2025-01-20T00:00:00.000Z",
    createdBy: null,
    supersedesProjectionId: null,
    supersededByProjectionId: null,
    lineageRootId: PROJECTION_ID,
    supersessionReasonCode: null,
    sourceReportId: null,
    sourceAssessmentId: null,
  };
}

function makeObservationSnapshot(
  observation: LongitudinalOutcomeObservation,
  id = OBSERVATION_ID
): ProjectionObservationSnapshot {
  return {
    id,
    projectionSnapshotId: PROJECTION_ID,
    caseId: CASE_ID,
    patientId: PATIENT_ID,
    stage: observation.stage,
    observedAt: observation.observedAt,
    observationStatus: "active",
    observationSchemaVersion: OBSERVATION_SCHEMA_VERSION,
    observationLineageVersion: OBSERVATION_LINEAGE_VERSION,
    observationChecksum: computeObservationChecksum(observation),
    observationPayload: observation,
    createdAt: observation.observedAt,
    createdBy: null,
    supersedesObservationId: null,
    supersededByObservationId: null,
    supersessionReasonCode: null,
    sourceReportId: null,
    sourceAuditId: null,
  };
}

function domainChar(
  projection: ProjectionSnapshot,
  domain: PatientSafeProjectedCharacteristic["domain"]
): PatientSafeProjectedCharacteristic {
  const hit = projection.projectionSnapshot.projectedCharacteristics.find(
    (c) => c.domain === domain
  );
  assert.ok(hit, `missing domain ${domain}`);
  return hit!;
}

describe("HA-PROJECTION-1F stage assessability", () => {
  it("5. month3 immature density → not_yet_assessable", () => {
    assert.equal(
      getDomainAssessability("month_3", "density_distribution"),
      "not_yet_assessable"
    );
    const projection = makeProjectionSnapshot();
    const observation = makeObservationPayload("month_3", [
      {
        key: "density_appearance",
        label: "Density appearance",
        observation: "Frontal density appears stronger than posterior transition.",
      },
    ]);
    const result = compareProjectedDomain({
      characteristic: domainChar(projection, "density_distribution"),
      observation,
      reconstruction: projection.reconstructionSnapshot,
    });
    assert.equal(result.status, "not_yet_assessable");
  });

  it("6. month6 density can be partially assessable", () => {
    assert.equal(getDomainAssessability("month_6", "density_distribution"), "partial");
    const projection = makeProjectionSnapshot();
    const observation = makeObservationPayload("month_6", [
      {
        key: "density_appearance",
        label: "Density appearance",
        observation: "Frontal density appears stronger than posterior transition.",
        confidence: "moderate",
      },
    ]);
    const result = compareProjectedDomain({
      characteristic: domainChar(projection, "density_distribution"),
      observation,
      reconstruction: projection.reconstructionSnapshot,
    });
    assert.notEqual(result.status, "not_yet_assessable");
    assert.ok(
      result.status === "consistent" || result.status === "partially_consistent"
    );
  });

  it("7. month12 supported domain assessable", () => {
    assert.equal(getDomainAssessability("month_12", "frontal_framing"), "assessable");
    const projection = makeProjectionSnapshot();
    const observation = makeObservationPayload("month_12", [
      {
        key: "frontal_appearance",
        label: "Frontal appearance",
        observation:
          "Visible frontal coverage is established and remains the dominant visual treatment area.",
        confidence: "high",
      },
    ]);
    const result = compareProjectedDomain({
      characteristic: domainChar(projection, "frontal_framing"),
      observation,
      reconstruction: projection.reconstructionSnapshot,
    });
    assert.equal(result.status, "consistent");
  });

  it("8. stage rules are domain-specific", () => {
    assert.equal(
      STAGE_DOMAIN_ASSESSABILITY.month_3.density_distribution,
      "not_yet_assessable"
    );
    assert.equal(
      STAGE_DOMAIN_ASSESSABILITY.month_3.untreated_or_lower_treatment_areas,
      "assessable"
    );
    assert.notEqual(
      STAGE_DOMAIN_ASSESSABILITY.month_3.frontal_framing,
      STAGE_DOMAIN_ASSESSABILITY.month_3.density_distribution
    );
  });
});

describe("HA-PROJECTION-1F domain comparison", () => {
  it("9. frontal matching pattern → consistent", () => {
    const projection = makeProjectionSnapshot();
    const observation = makeObservationPayload("month_12", [
      {
        key: "frontal_appearance",
        label: "Frontal appearance",
        observation:
          "Visible frontal coverage is established and remains the dominant visual treatment area.",
      },
    ]);
    const result = compareProjectedDomain({
      characteristic: domainChar(projection, "frontal_framing"),
      observation,
      reconstruction: projection.reconstructionSnapshot,
    });
    assert.equal(result.status, "consistent");
  });

  it("10. frontal mixed evidence → partially_consistent", () => {
    const projection = makeProjectionSnapshot();
    const observation = makeObservationPayload("month_12", [
      {
        key: "frontal_appearance",
        label: "Frontal appearance",
        observation:
          "Frontal coverage is visible but uneven and less dominant than adjacent untreated native hair.",
      },
    ]);
    const result = compareProjectedDomain({
      characteristic: domainChar(projection, "frontal_framing"),
      observation,
      reconstruction: projection.reconstructionSnapshot,
    });
    assert.ok(
      result.status === "partially_consistent" || result.status === "divergent",
      result.status
    );
  });

  it("11. mature clear opposing density pattern → divergent", () => {
    const projection = makeProjectionSnapshot();
    const observation = makeObservationPayload("month_12", [
      {
        key: "density_appearance",
        label: "Density appearance",
        observation: "Posterior appearance is visually denser than the frontal region.",
        confidence: "high",
      },
    ]);
    const result = compareProjectedDomain({
      characteristic: domainChar(projection, "density_distribution"),
      observation,
      reconstruction: projection.reconstructionSnapshot,
    });
    assert.equal(result.status, "divergent");
  });

  it("12. missing domain evidence → insufficient_evidence", () => {
    const projection = makeProjectionSnapshot();
    // Donor-only evidence at month 12: stage ok, recipient views missing
    const observation = makeObservationPayload("month_12", undefined, {
      roles: "minimal",
    });
    // Force empty frontal feature while keeping stage mature
    observation.recipient.frontalAppearance = null;
    observation.recipient.densityAppearance = null;
    observation.recipient.transitionAppearance = null;

    const result = compareProjectedDomain({
      characteristic: domainChar(projection, "frontal_framing"),
      observation,
      reconstruction: projection.reconstructionSnapshot,
    });
    assert.equal(result.status, "insufficient_evidence");
  });

  it("13. omitted projection domain → no comparison generated", () => {
    const { projectedOutcome } = fixtureA_baselinePlusSurgeryDay();
    const withoutNative: SurgeryDayProjectedOutcome = {
      ...projectedOutcome,
      projectedCharacteristics: projectedOutcome.projectedCharacteristics.filter(
        (c) => c.domain !== "native_hair_dependency"
      ),
    };
    const projection = makeProjectionSnapshot(withoutNative);
    const observation = makeObservationPayload("month_12", [
      {
        key: "visible_native_hair_status",
        label: "Native hair",
        observation: "Native mid-scalp continues to contribute visibly to the overall density picture.",
      },
    ]);
    const built = buildProjectionObservedComparison({
      projection,
      observation: makeObservationSnapshot(observation),
      generatedAt: "2026-01-20T00:00:00.000Z",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(
      built.comparison.domains.some((d) => d.domain === "native_hair_dependency"),
      false
    );
  });
});

describe("HA-PROJECTION-1F treatment-aware comparison", () => {
  it("14-15. untreated crown does not count as divergence; remains consistent with scope", () => {
    const projection = makeProjectionSnapshot();
    assert.ok(
      projection.projectionSnapshot.projectedCharacteristics.some(
        (c) => c.domain === "untreated_or_lower_treatment_areas"
      )
    );
    const observation = makeObservationPayload("month_12", [
      {
        key: "crown_appearance",
        label: "Crown appearance",
        observation:
          "Crown remains visibly lower density than frontal treatment zone.",
      },
    ]);
    // Ensure crown feature is present even if builder skipped untreated crown
    observation.recipient.crownAppearance = {
      key: "crown_appearance",
      label: "Crown appearance",
      observation: "Crown remains visibly lower density than frontal treatment zone.",
      confidence: "moderate",
      evidenceRoles: ["followup_crown"],
      source: "rule",
    };
    observation.evidence.presentRoles = [
      ...new Set([...observation.evidence.presentRoles, "followup_crown" as const]),
    ];

    const result = compareProjectedDomain({
      characteristic: domainChar(projection, "untreated_or_lower_treatment_areas"),
      observation,
      reconstruction: projection.reconstructionSnapshot,
    });
    assert.equal(result.status, "consistent");
  });

  it("16. unprojected temples ignored (no invented temple domain)", () => {
    const projection = makeProjectionSnapshot();
    const observation = makeObservationPayload("month_12", [
      {
        key: "frontal_appearance",
        label: "Frontal appearance",
        observation:
          "Visible frontal coverage is established and remains the dominant visual treatment area.",
      },
    ]);
    const built = buildProjectionObservedComparison({
      projection,
      observation: makeObservationSnapshot(observation),
      generatedAt: "2026-01-20T00:00:00.000Z",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    // No standalone temples domain exists in 1B vocabulary
    assert.equal(
      built.comparison.domains.every((d) =>
        [
          "frontal_framing",
          "density_distribution",
          "transition_characteristics",
          "native_hair_dependency",
          "untreated_or_lower_treatment_areas",
        ].includes(d.domain)
      ),
      true
    );
  });
});

describe("HA-PROJECTION-1F native hair", () => {
  it("17. projected native-hair dependency + observed contribution → consistent", () => {
    const projection = makeProjectionSnapshot();
    assert.ok(
      projection.projectionSnapshot.projectedCharacteristics.some(
        (c) => c.domain === "native_hair_dependency"
      )
    );
    const observation = makeObservationPayload("month_12", [
      {
        key: "visible_native_hair_status",
        label: "Native hair status",
        observation:
          "Native mid-scalp continues to contribute visibly to the overall density picture.",
      },
      {
        key: "treated_vs_untreated_relationship",
        label: "Treated vs untreated",
        observation:
          "Native mid-scalp continues to contribute visibly beside the treated frontal zone.",
      },
    ]);
    const result = compareProjectedDomain({
      characteristic: domainChar(projection, "native_hair_dependency"),
      observation,
      reconstruction: projection.reconstructionSnapshot,
    });
    assert.equal(result.status, "consistent");
  });

  it("18. no 1B native-hair domain → no native comparison", () => {
    const { projectedOutcome } = fixtureA_baselinePlusSurgeryDay();
    const withoutNative: SurgeryDayProjectedOutcome = {
      ...projectedOutcome,
      projectedCharacteristics: projectedOutcome.projectedCharacteristics.filter(
        (c) => c.domain !== "native_hair_dependency"
      ),
    };
    const projection = makeProjectionSnapshot(withoutNative);
    const observation = makeObservationPayload("month_6");
    const built = buildProjectionObservedComparison({
      projection,
      observation: makeObservationSnapshot(observation),
      generatedAt: "2025-07-20T00:00:00.000Z",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(
      built.comparison.domains.some((d) => d.domain === "native_hair_dependency"),
      false
    );
  });

  it("19. native change is descriptive, not treatment failure", () => {
    const projection = makeProjectionSnapshot();
    const observation = makeObservationPayload("month_12", [
      {
        key: "visible_native_hair_status",
        label: "Native hair status",
        observation: "Native mid-scalp is no longer visibly contributing.",
      },
    ]);
    const result = compareProjectedDomain({
      characteristic: domainChar(projection, "native_hair_dependency"),
      observation,
      reconstruction: projection.reconstructionSnapshot,
    });
    assert.ok(
      result.status === "divergent" || result.status === "partially_consistent"
    );
    assert.doesNotMatch(result.rationale, /failure|successful|worse than/i);
  });
});

describe("HA-PROJECTION-1F confidence", () => {
  it("27. mature stage + strong evidence → high comparison confidence possible", () => {
    const conf = deriveComparisonConfidence({
      stage: "month_12",
      domainAssessability: "assessable",
      projectionConfidence: "high",
      observationConfidence: "high",
      evidenceComplete: true,
      directDomainMatch: true,
      limitationCount: 1,
      status: "consistent",
    });
    assert.equal(conf, "high");
  });

  it("28. early stage reduces confidence", () => {
    const conf = deriveComparisonConfidence({
      stage: "month_3",
      domainAssessability: "limited",
      projectionConfidence: "high",
      observationConfidence: "high",
      evidenceComplete: true,
      directDomainMatch: true,
      limitationCount: 0,
      status: "partially_consistent",
    });
    assert.equal(conf, "low");
  });

  it("29. weak observation evidence reduces confidence", () => {
    const conf = deriveComparisonConfidence({
      stage: "month_12",
      domainAssessability: "assessable",
      projectionConfidence: "high",
      observationConfidence: "low",
      evidenceComplete: true,
      directDomainMatch: true,
      limitationCount: 1,
      status: "consistent",
    });
    assert.equal(conf, "low");
  });

  it("30. projection confidence does not equal comparison confidence", () => {
    const projection = makeProjectionSnapshot();
    const observation = makeObservationPayload("month_3", [
      {
        key: "frontal_appearance",
        label: "Frontal appearance",
        observation: "Early visible growth is present through the frontal region.",
        confidence: "moderate",
      },
    ]);
    const result = compareProjectedDomain({
      characteristic: domainChar(projection, "frontal_framing"),
      observation,
      reconstruction: projection.reconstructionSnapshot,
    });
    // Comparison confidence is independently capped by stage
    assert.equal(result.confidence, "low");
    assert.notEqual(result.confidence, domainChar(projection, "frontal_framing").confidence);
  });
});

describe("HA-PROJECTION-1F overall status + lineage gate", () => {
  it("derives overall status without numeric score", () => {
    const domains = [
      {
        domain: "frontal_framing" as const,
        projectedCharacteristic: "p",
        observedCharacteristic: "o",
        status: "consistent" as ProjectionComparisonStatus,
        confidence: "high" as const,
        rationale: "r",
        limitations: [],
        projectionSourceKeys: [],
        observationSourceKeys: [],
      },
      {
        domain: "density_distribution" as const,
        projectedCharacteristic: "p",
        observedCharacteristic: "o",
        status: "partially_consistent" as ProjectionComparisonStatus,
        confidence: "moderate" as const,
        rationale: "r",
        limitations: [],
        projectionSourceKeys: [],
        observationSourceKeys: [],
      },
    ];
    assert.equal(deriveOverallComparisonStatus(domains), "partially_consistent");
  });

  it("lineage mismatch rejected at engine", () => {
    const projection = makeProjectionSnapshot();
    const observation = makeObservationPayload("month_6");
    const snap = makeObservationSnapshot(observation);
    snap.projectionSnapshotId = "99999999-9999-9999-9999-999999999999";
    const built = buildProjectionObservedComparison({
      projection,
      observation: snap,
    });
    assert.equal(built.ok, false);
    if (built.ok) return;
    assert.equal(built.code, "LINEAGE_MISMATCH");
  });

  it("checksum covers identities + version, not generatedAt alone", () => {
    const projection = makeProjectionSnapshot();
    const observation = makeObservationPayload("month_12", [
      {
        key: "frontal_appearance",
        label: "Frontal appearance",
        observation:
          "Visible frontal coverage is established and remains the dominant visual treatment area.",
      },
    ]);
    const a = buildProjectionObservedComparison({
      projection,
      observation: makeObservationSnapshot(observation),
      generatedAt: "2026-01-20T00:00:00.000Z",
    });
    const b = buildProjectionObservedComparison({
      projection,
      observation: makeObservationSnapshot(observation),
      generatedAt: "2026-02-01T00:00:00.000Z",
    });
    assert.equal(a.ok && b.ok, true);
    if (!a.ok || !b.ok) return;
    const ca = computeComparisonChecksum(a.comparison, {
      projectionChecksum: resolveProjectionContentChecksum(projection),
      observationChecksum: makeObservationSnapshot(observation).observationChecksum,
    });
    const cb = computeComparisonChecksum(b.comparison, {
      projectionChecksum: resolveProjectionContentChecksum(projection),
      observationChecksum: makeObservationSnapshot(observation).observationChecksum,
    });
    assert.equal(ca, cb);
    assert.equal(a.comparison.comparisonVersion, COMPARISON_SCHEMA_VERSION);
  });
});
