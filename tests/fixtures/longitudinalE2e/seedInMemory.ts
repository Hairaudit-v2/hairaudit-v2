/**
 * FI-OUTCOME-INTELLIGENCE-1F — In-memory longitudinal fixture builder.
 *
 * Uses canonical ProjectionSnapshotService, LongitudinalCapturePlanService,
 * ProjectionObservationService, ProjectionComparisonService, and engagement
 * decision service. Does not invent clinical / projection / capture policy.
 */

import { randomUUID } from "node:crypto";
import {
  fixtureA_baselinePlusSurgeryDay,
  fixtureB_surgeryDayOnly,
} from "../surgeryDayProjection/fixtures";
import { InMemoryProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotRepository";
import { createProjectionSnapshotService } from "@/lib/projection/projectionSnapshotService";
import { InMemoryProjectionObservationRepository } from "@/lib/projection/projectionObservationRepository";
import { createProjectionObservationService } from "@/lib/projection/projectionObservationService";
import { InMemoryProjectionObservationAuditSink } from "@/lib/projection/projectionObservationAudit";
import { InMemoryProjectionComparisonRepository } from "@/lib/projection/projectionComparisonRepository";
import { createProjectionComparisonService } from "@/lib/projection/projectionComparisonService";
import { InMemoryProjectionComparisonAuditSink } from "@/lib/projection/projectionComparisonAudit";
import { buildLongitudinalOutcomeObservation } from "@/lib/projection/longitudinalOutcomeObservation";
import { InMemoryLongitudinalCapturePlanRepository } from "@/lib/outcomeIntelligence/longitudinalCaptureRepository";
import { createLongitudinalCapturePlanService } from "@/lib/outcomeIntelligence/longitudinalCaptureService";
import { roleToPostopCategoryHint } from "@/lib/outcomeIntelligence/longitudinalCapturePolicy";
import { deriveNextAction } from "@/lib/outcomeIntelligence/longitudinalCaptureDto";
import { LONGITUDINAL_CAPTURE_WORKFLOW } from "@/lib/outcomeIntelligence/longitudinalFollowupUploadAllowance";
import { InMemoryLongitudinalEngagementEventRepository } from "@/lib/outcomeIntelligence/longitudinalEngagementRepository";
import {
  createLongitudinalEngagementService,
  InMemoryEngagementAuditSink,
} from "@/lib/outcomeIntelligence/longitudinalEngagementService";
import type {
  LongitudinalEvidenceRole,
  LongitudinalOutcomeStage,
  ProjectionUploadInput,
} from "@/lib/projection/types";
import { getManifestEntry } from "./manifest";
import {
  captureTimestampForStage,
  procedureDateForDueStage,
} from "./procedureDates";
import type {
  FixtureSeedMode,
  LongitudinalFixtureBundle,
  SeedLongitudinalProjectionFixtureConfig,
} from "./types";

function caseRow(caseId: string, patientId: string) {
  return { id: caseId, patient_id: patientId, user_id: patientId };
}

function stageMonth(stage: LongitudinalOutcomeStage): string {
  return stage.replace("month_", "");
}

function buildUploadForRole(args: {
  role: LongitudinalEvidenceRole;
  stage: LongitudinalOutcomeStage;
  procedureDate: string;
  index: number;
  id?: string;
}): ProjectionUploadInput {
  const category = roleToPostopCategoryHint(args.stage, args.role);
  const captured = captureTimestampForStage({
    procedureDate: args.procedureDate,
    stage: args.stage,
  });
  return {
    id: args.id ?? `upload-${args.role}-${args.index}`,
    type: `patient_photo:${category ?? `postop_month${stageMonth(args.stage)}_front`}`,
    created_at: captured,
    captured_at: captured,
    metadata: {
      capture_workflow: LONGITUDINAL_CAPTURE_WORKFLOW,
      capture_stage: args.stage,
      capture_role: args.role,
      fixture: true,
    },
  };
}

function requiredRolesForFrontal(includeCrown: boolean): LongitudinalEvidenceRole[] {
  const base: LongitudinalEvidenceRole[] = [
    "followup_front",
    "followup_top",
    "followup_recipient_closeup",
  ];
  if (includeCrown) base.push("followup_crown");
  return base;
}

function resolveUploadRoles(args: {
  mode: FixtureSeedMode;
  treatedAreas: string[];
  existingUploadRoles?: LongitudinalEvidenceRole[];
}): LongitudinalEvidenceRole[] {
  if (args.existingUploadRoles) return [...args.existingUploadRoles];
  const crown = args.treatedAreas.some((z) => /crown|vertex/i.test(z));
  const required = requiredRolesForFrontal(crown);
  switch (args.mode) {
    case "seed-to-due":
      return [];
    case "seed-to-incomplete":
      return required.slice(0, Math.max(1, required.length - 1));
    case "seed-to-ready":
    case "seed-to-observed":
      return required;
    default:
      return [];
  }
}

/**
 * Seed a deterministic synthetic longitudinal lineage in memory.
 * Idempotent when called with the same ids — callers should reuse case/patient ids.
 */
export async function seedLongitudinalProjectionFixture(
  config: SeedLongitudinalProjectionFixtureConfig
): Promise<LongitudinalFixtureBundle> {
  const manifest = getManifestEntry(config.fixtureKey);
  const fixtureKey = String(
    config.fixtureKey || manifest?.fixtureKey || "FRONTAL"
  )
    .toUpperCase()
    .replace(/^FI-OI-1F-/, "");

  const mode: FixtureSeedMode =
    config.mode ?? manifest?.mode ?? "seed-to-due";
  const projectionMode =
    config.projectionMode ?? manifest?.projectionMode ?? "baseline_plus";
  const treatedAreas =
    config.treatedAreas ??
    manifest?.treatedAreas ?? ["hairline", "frontal"];
  const focusStage =
    config.focusStage ?? manifest?.focusStage ?? "month_6";
  const anchorStage =
    config.anchorStageForWindow ??
    manifest?.anchorStageForWindow ??
    focusStage;
  const now = config.now ?? "2026-07-28T12:00:00.000Z";
  const procedureDate =
    config.procedureDate ??
    procedureDateForDueStage({ stage: anchorStage, now });

  const caseId = config.caseId ?? randomUUID();
  const patientId = config.patientId ?? randomUUID();
  const ownership = caseRow(caseId, patientId);

  const projectionRepo = new InMemoryProjectionSnapshotRepository();
  const observationRepo = new InMemoryProjectionObservationRepository();
  const comparisonRepo = new InMemoryProjectionComparisonRepository();
  const captureRepo = new InMemoryLongitudinalCapturePlanRepository();
  const engagementRepo = new InMemoryLongitudinalEngagementEventRepository();

  const pair =
    projectionMode === "surgery_day_only"
      ? fixtureB_surgeryDayOnly()
      : fixtureA_baselinePlusSurgeryDay();

  const { reconstruction, projectedOutcome } = pair;
  reconstruction.procedureContext.procedureDate = procedureDate;
  reconstruction.procedureContext.treatedAreas = [...treatedAreas];
  reconstruction.recipient.observedTreatedAreas = [...treatedAreas];

  const snapService = createProjectionSnapshotService({
    repository: projectionRepo,
    loadCaseOwnership: async () => ownership,
  });

  const projectionResult = await snapService.createProjectionSnapshot(
    {
      caseId,
      patientId,
      reconstruction,
      projectedOutcome,
      id: config.projectionId,
      now: `${procedureDate}T18:00:00.000Z`,
    },
    { caseRow: ownership }
  );
  if (!projectionResult.ok) {
    throw new Error(`projection seed failed: ${projectionResult.reason}`);
  }
  const projection = projectionResult.snapshot;

  const uploadRoles = resolveUploadRoles({
    mode,
    treatedAreas,
    existingUploadRoles:
      config.existingUploadRoles ?? manifest?.existingUploadRoles,
  });

  const uploads: ProjectionUploadInput[] = uploadRoles.map((role, i) =>
    buildUploadForRole({
      role,
      stage: focusStage,
      procedureDate,
      index: i,
    })
  );

  const seedReference =
    config.seedReferenceFront ?? manifest?.seedReferenceFront ?? false;
  if (seedReference) {
    uploads.push({
      id: `ref-front-${fixtureKey}`,
      type: "patient_photo:day0_recipient",
      created_at: `${procedureDate}T10:00:00.000Z`,
      captured_at: `${procedureDate}T10:00:00.000Z`,
      metadata: { fixture: true, reference_source: "surgery_day" },
    });
  }

  const captureService = createLongitudinalCapturePlanService({
    capturePlanRepository: captureRepo,
    projectionRepository: projectionRepo,
    observationRepository: observationRepo,
    comparisonRepository: comparisonRepo,
    loadCaseOwnership: async () => ownership,
  });

  const planResult = await captureService.resolveCapturePlan({
    projectionSnapshotId: projection.id,
    caseId,
    patientId,
    uploads,
    ensurePlan: true,
    now,
    caseRow: ownership,
  });
  if (!planResult.ok) {
    throw new Error(`capture plan seed failed: ${planResult.reason}`);
  }
  let plan = planResult.plan;

  let observation = null as LongitudinalFixtureBundle["observation"];
  let comparison = null as LongitudinalFixtureBundle["comparison"];

  const wantObserved =
    mode === "seed-to-observed" ||
    (config.seedComparison ?? manifest?.seedComparison ?? false);

  if (wantObserved) {
    // Ensure required uploads for observation builder.
    const crown = treatedAreas.some((z) => /crown|vertex/i.test(z));
    const obsUploads = requiredRolesForFrontal(crown).map((role, i) =>
      buildUploadForRole({
        role,
        stage: focusStage,
        procedureDate,
        index: 100 + i,
      })
    );
    // Prefer month-banded front/top/donor for observation builder compatibility.
    const month = stageMonth(focusStage);
    const builderUploads: ProjectionUploadInput[] = [
      {
        id: "obs-f",
        type: `patient_photo:postop_month${month}_front`,
        captured_at: captureTimestampForStage({ procedureDate, stage: focusStage }),
      },
      {
        id: "obs-t",
        type: `patient_photo:postop_month${month}_top`,
        captured_at: captureTimestampForStage({ procedureDate, stage: focusStage }),
      },
      {
        id: "obs-d",
        type: `patient_photo:postop_month${month}_donor`,
        captured_at: captureTimestampForStage({ procedureDate, stage: focusStage }),
      },
      ...obsUploads,
    ];

    const built = buildLongitudinalOutcomeObservation({
      projectionSnapshotId: projection.id,
      caseId,
      patientId,
      stage: focusStage,
      observedAt: captureTimestampForStage({ procedureDate, stage: focusStage }),
      uploads: builderUploads,
      caseContext: {
        procedureDate,
        treatedAreas,
      },
      baselineAvailable: projectionMode === "baseline_plus",
    });
    if (!built.ok) {
      throw new Error(`observation build failed: ${built.reason}`);
    }

    const obsService = createProjectionObservationService({
      observationRepository: observationRepo,
      projectionRepository: projectionRepo,
      audit: new InMemoryProjectionObservationAuditSink(),
      loadCaseOwnership: async () => ownership,
    });
    const obsCreated = await obsService.createLongitudinalObservation(
      {
        projectionSnapshotId: projection.id,
        caseId,
        patientId,
        stage: focusStage,
        observation: built.observation,
        id: config.observationId,
        now,
      },
      { caseRow: ownership }
    );
    if (!obsCreated.ok) {
      throw new Error(`observation seed failed: ${obsCreated.reason}`);
    }
    observation = obsCreated.snapshot;

    const cmpService = createProjectionComparisonService({
      comparisonRepository: comparisonRepo,
      observationRepository: observationRepo,
      projectionRepository: projectionRepo,
      audit: new InMemoryProjectionComparisonAuditSink(),
      loadCaseOwnership: async () => ownership,
    });
    const cmpCreated = await cmpService.createProjectionComparison(
      {
        projectionSnapshotId: projection.id,
        observationSnapshotId: observation.id,
        caseId,
        patientId,
        id: config.comparisonId,
        now,
      },
      { caseRow: ownership }
    );
    if (!cmpCreated.ok) {
      throw new Error(`comparison seed failed: ${cmpCreated.reason}`);
    }
    comparison = cmpCreated.snapshot;

    // Re-resolve plan so milestone status becomes observed.
    const refreshed = await captureService.resolveCapturePlan({
      projectionSnapshotId: projection.id,
      caseId,
      patientId,
      uploads: [...uploads, ...builderUploads],
      ensurePlan: false,
      now,
      caseRow: ownership,
    });
    if (refreshed.ok) plan = refreshed.plan;
  }

  let engagementEvent = null as LongitudinalFixtureBundle["engagementEvent"];
  let captureHref: string | null = null;

  const milestone = plan.milestones.find((m) => m.stage === focusStage) ?? null;
  if (milestone) {
    const next = deriveNextAction({
      status: milestone.status,
      stage: milestone.stage,
      caseId: plan.caseId,
      reviewAvailable: milestone.reviewAvailable,
      missingRequiredCount: milestone.missingRequiredEvidenceRoles.length,
    });
    captureHref = next.href;
  }

  const seedEngagement =
    config.seedEngagement ?? manifest?.seedEngagement ?? false;
  if (seedEngagement && milestone) {
    const engService = createLongitudinalEngagementService({
      eventRepository: engagementRepo,
      config: {
        enabled: true,
        emailEnabled: false,
        smsEnabled: false,
        pushEnabled: false,
        persistEvents: true,
        isProduction: false,
      },
      auditSink: new InMemoryEngagementAuditSink(),
      dryRun: false,
    });
    const decision = await engService.decideForMilestone({
      plan,
      milestone,
      now,
    });
    if (decision.ok && decision.event) {
      engagementEvent = decision.event;
      if (decision.event.actionHref) {
        captureHref = decision.event.actionHref;
      }
    }
  }

  return {
    fixtureKey,
    caseId,
    patientId,
    procedureDate,
    now,
    mode,
    projection,
    plan,
    uploads,
    observation,
    comparison,
    engagementEvent,
    captureHref,
    repos: {
      projectionRepo,
      observationRepo,
      comparisonRepo,
      captureRepo,
      engagementRepo,
    },
  };
}

/**
 * Re-seed with identical identity keys — must not duplicate projection when
 * content checksum matches (service idempotency).
 */
export async function reseedLongitudinalProjectionFixture(
  prior: LongitudinalFixtureBundle,
  overrides?: Partial<SeedLongitudinalProjectionFixtureConfig>
): Promise<LongitudinalFixtureBundle> {
  return seedLongitudinalProjectionFixture({
    fixtureKey: prior.fixtureKey,
    mode: prior.mode,
    caseId: prior.caseId,
    patientId: prior.patientId,
    projectionId: prior.projection.id,
    procedureDate: prior.procedureDate,
    now: prior.now,
    ...overrides,
  });
}
