/**
 * FI-OUTCOME-INTELLIGENCE-1C — LongitudinalCapturePlanService.
 *
 * Creates/resolves prospective Month 3/6/9/12 capture plans anchored to frozen
 * HA-PROJECTION-1D snapshots. Feeds existing 1E → 1F → 1G lineage.
 *
 * Independent of FI_OUTCOME_COHORT_* governance flags.
 */

import { randomUUID } from "node:crypto";
import type { ProjectionUploadInput } from "@/lib/projection/types";
import type { ProjectionSnapshot } from "@/lib/projection/projectionSnapshotTypes";
import type { ProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotRepository";
import type { ProjectionObservationRepository } from "@/lib/projection/projectionObservationRepository";
import type { ProjectionComparisonRepository } from "@/lib/projection/projectionComparisonRepository";
import { validateCaseOwnership } from "@/lib/projection/projectionSnapshotValidate";
import type { CaseOwnershipRow } from "@/lib/projection/projectionSnapshotService";
import {
  CAPTURE_PHOTOGRAPHY_GUIDANCE,
  buildMilestoneEvidenceRequirements,
  captureInstructionsForRole,
  getCapturePolicy,
  isSupportedCapturePlanVersion,
  isSupportedCaptureProtocolVersion,
  patientMilestoneLabel,
  patientSafeLabelForRole,
  resolveTreatmentCaptureContext,
  whyRequestedForRole,
  type TreatmentCaptureContext,
} from "./longitudinalCapturePolicy";
import {
  buildMilestoneSchedule,
  normalizeProcedureDate,
  todayUtcDate,
} from "./longitudinalCaptureSchedule";
import { assessMilestoneEvidence, toPatientViewDtos } from "./longitudinalCaptureEvidence";
import {
  deriveMilestoneStatus,
  deriveNextAction,
  selectNextPatientMilestone,
} from "./longitudinalCaptureDto";
import type { LongitudinalCapturePlanRepository } from "./longitudinalCaptureRepository";
import {
  CAPTURE_PLAN_VERSION,
  CAPTURE_PROTOCOL_VERSION,
  type CaptureProgrammeHealth,
  type CaptureViewInstruction,
  type CreateCapturePlanInput,
  type CreateCapturePlanResult,
  type LongitudinalCaptureMilestone,
  type LongitudinalCapturePlan,
  type LongitudinalCapturePlanRecord,
  type PatientLongitudinalCaptureDto,
  type PatientLongitudinalMilestoneDto,
  type ResolveCapturePlanResult,
} from "./longitudinalCaptureTypes";

export type LongitudinalCapturePlanServiceDeps = {
  capturePlanRepository: LongitudinalCapturePlanRepository;
  projectionRepository: ProjectionSnapshotRepository;
  observationRepository?: ProjectionObservationRepository;
  comparisonRepository?: ProjectionComparisonRepository;
  /** Optional: whether a 1G review presentation is available for observation. */
  isReviewAvailable?: (args: {
    projectionSnapshotId: string;
    observationSnapshotId: string;
    stage: string;
  }) => Promise<boolean>;
  loadCaseOwnership?: (caseId: string) => Promise<CaseOwnershipRow | null>;
};

export type ResolveCapturePlanInput = {
  projectionSnapshotId: string;
  caseId: string;
  patientId: string;
  uploads?: ProjectionUploadInput[];
  /** Prefer existing plan; create if missing (idempotent). */
  ensurePlan?: boolean;
  now?: string;
  skipOwnershipCheck?: boolean;
  caseRow?: CaseOwnershipRow | null;
};

function procedureDateFromProjection(projection: ProjectionSnapshot): string | null {
  return normalizeProcedureDate(
    projection.reconstructionSnapshot.procedureContext.procedureDate
  );
}

export class LongitudinalCapturePlanService {
  constructor(private readonly deps: LongitudinalCapturePlanServiceDeps) {}

  /**
   * Idempotent create of minimal plan identity for a frozen projection.
   * Does not depend on cohort analytics flags.
   */
  async createCapturePlan(
    input: CreateCapturePlanInput,
    opts?: { caseRow?: CaseOwnershipRow | null; skipOwnershipCheck?: boolean }
  ): Promise<CreateCapturePlanResult> {
    const planVersion = input.planVersion ?? CAPTURE_PLAN_VERSION;
    const protocolVersion = input.protocolVersion ?? CAPTURE_PROTOCOL_VERSION;

    if (!isSupportedCapturePlanVersion(planVersion)) {
      return {
        ok: false,
        code: "UNSUPPORTED_POLICY_VERSION",
        reason: `Unsupported capture plan version: ${planVersion}`,
      };
    }
    if (!isSupportedCaptureProtocolVersion(protocolVersion)) {
      return {
        ok: false,
        code: "UNSUPPORTED_POLICY_VERSION",
        reason: `Unsupported capture protocol version: ${protocolVersion}`,
      };
    }

    const procedureDate = normalizeProcedureDate(input.procedureDate);
    if (!procedureDate) {
      return {
        ok: false,
        code: "INVALID_PROCEDURE_DATE",
        reason: "Procedure date must be a valid calendar date.",
      };
    }

    const projection = await this.deps.projectionRepository.findById(
      input.projectionSnapshotId
    );
    if (!projection) {
      return {
        ok: false,
        code: "PROJECTION_NOT_FOUND",
        reason: "Projection snapshot not found.",
      };
    }

    if (projection.caseId !== input.caseId) {
      return {
        ok: false,
        code: "CASE_MISMATCH",
        reason: "Projection snapshot does not belong to the given case.",
      };
    }

    if (projection.patientId !== input.patientId) {
      return {
        ok: false,
        code: "OWNERSHIP_MISMATCH",
        reason: "Projection patient ownership does not match.",
      };
    }

    if (!opts?.skipOwnershipCheck) {
      const caseRow =
        opts?.caseRow !== undefined
          ? opts.caseRow
          : this.deps.loadCaseOwnership
            ? await this.deps.loadCaseOwnership(input.caseId)
            : null;
      const ownership = validateCaseOwnership({
        caseId: input.caseId,
        patientId: input.patientId,
        caseRow,
      });
      if (!ownership.ok) {
        return {
          ok: false,
          code: "OWNERSHIP_MISMATCH",
          reason: ownership.reason,
        };
      }
    }

    const existing = await this.deps.capturePlanRepository.findByIdempotencyKey({
      projectionSnapshotId: input.projectionSnapshotId,
      capturePolicyVersion: planVersion,
      captureProtocolVersion: protocolVersion,
    });
    if (existing) {
      return { ok: true, created: false, reused: true, record: existing };
    }

    const nowIso =
      input.now ??
      new Date().toISOString();
    const record: LongitudinalCapturePlanRecord = {
      id: input.id ?? randomUUID(),
      projectionSnapshotId: input.projectionSnapshotId,
      caseId: input.caseId,
      patientId: input.patientId,
      procedureDate,
      capturePolicyVersion: planVersion,
      captureProtocolVersion: protocolVersion,
      createdAt: nowIso,
    };

    try {
      const inserted = await this.deps.capturePlanRepository.insert(record);
      return { ok: true, created: true, reused: false, record: inserted };
    } catch {
      // Race: reuse idempotent row
      const raced = await this.deps.capturePlanRepository.findByIdempotencyKey({
        projectionSnapshotId: input.projectionSnapshotId,
        capturePolicyVersion: planVersion,
        captureProtocolVersion: protocolVersion,
      });
      if (raced) {
        return { ok: true, created: false, reused: true, record: raced };
      }
      throw new Error("Failed to insert capture plan.");
    }
  }

  async resolveCapturePlan(
    input: ResolveCapturePlanInput
  ): Promise<ResolveCapturePlanResult> {
    const projection = await this.deps.projectionRepository.findById(
      input.projectionSnapshotId
    );
    if (!projection) {
      return {
        ok: false,
        code: "PROJECTION_NOT_FOUND",
        reason: "Projection snapshot not found.",
      };
    }
    if (projection.caseId !== input.caseId) {
      return {
        ok: false,
        code: "CASE_MISMATCH",
        reason: "Projection snapshot does not belong to the given case.",
      };
    }
    if (projection.patientId !== input.patientId) {
      return {
        ok: false,
        code: "OWNERSHIP_MISMATCH",
        reason: "Projection patient ownership does not match.",
      };
    }

    if (!input.skipOwnershipCheck) {
      const caseRow =
        input.caseRow !== undefined
          ? input.caseRow
          : this.deps.loadCaseOwnership
            ? await this.deps.loadCaseOwnership(input.caseId)
            : null;
      const ownership = validateCaseOwnership({
        caseId: input.caseId,
        patientId: input.patientId,
        caseRow,
      });
      if (!ownership.ok) {
        return {
          ok: false,
          code: "OWNERSHIP_MISMATCH",
          reason: ownership.reason,
        };
      }
    }

    let record =
      (
        await this.deps.capturePlanRepository.findByProjectionSnapshotId(
          input.projectionSnapshotId
        )
      ).find(
        (r) =>
          r.capturePolicyVersion === CAPTURE_PLAN_VERSION &&
          r.captureProtocolVersion === CAPTURE_PROTOCOL_VERSION
      ) ?? null;

    if (!record && input.ensurePlan !== false) {
      const procedureDate =
        procedureDateFromProjection(projection) ??
        normalizeProcedureDate(
          projection.reconstructionSnapshot.procedureContext.procedureDate
        );
      if (!procedureDate) {
        return {
          ok: false,
          code: "INVALID_PROCEDURE_DATE",
          reason: "Frozen projection has no usable procedure date.",
        };
      }
      const created = await this.createCapturePlan(
        {
          projectionSnapshotId: input.projectionSnapshotId,
          caseId: input.caseId,
          patientId: input.patientId,
          procedureDate,
          now: input.now,
        },
        { caseRow: input.caseRow, skipOwnershipCheck: true }
      );
      if (!created.ok) return created;
      record = created.record;
    }

    if (!record) {
      return {
        ok: false,
        code: "PLAN_NOT_FOUND",
        reason: "Capture plan not found for projection.",
      };
    }

    const plan = await this.hydratePlan({
      record,
      projection,
      uploads: input.uploads ?? [],
      now: input.now,
    });

    return { ok: true, plan };
  }

  async toPatientDto(
    plan: LongitudinalCapturePlan
  ): Promise<PatientLongitudinalCaptureDto> {
    const milestones: PatientLongitudinalMilestoneDto[] = plan.milestones.map((m) => {
      const presentSet = new Set(m.presentEvidenceRoles);
      const nextAction = deriveNextAction({
        status: m.status,
        stage: m.stage,
        caseId: plan.caseId,
        reviewAvailable: m.reviewAvailable,
        missingRequiredCount: m.missingRequiredEvidenceRoles.length,
      });
      return {
        stage: m.stage,
        label: patientMilestoneLabel(m.stage),
        targetDate: m.targetDate,
        status: m.status,
        requiredViews: toPatientViewDtos({
          roles: m.requiredEvidenceRoles,
          present: presentSet,
        }),
        recommendedViews: toPatientViewDtos({
          roles: m.recommendedEvidenceRoles,
          present: presentSet,
        }),
        nextAction,
      };
    });

    return {
      planVersion: plan.planVersion,
      protocolVersion: plan.protocolVersion,
      procedureDate: plan.procedureDate,
      milestones,
      nextMilestone: selectNextPatientMilestone(milestones),
      photographyGuidance: [...CAPTURE_PHOTOGRAPHY_GUIDANCE],
    };
  }

  buildCaptureViewInstructions(args: {
    milestone: LongitudinalCaptureMilestone;
    treatment: TreatmentCaptureContext;
    referenceRolesPresent?: Partial<
      Record<
        import("@/lib/projection/types").LongitudinalEvidenceRole,
        "surgery_day" | "preoperative" | "prior_followup"
      >
    >;
  }): CaptureViewInstruction[] {
    void args.treatment;
    const roles = [
      ...args.milestone.requiredEvidenceRoles,
      ...args.milestone.recommendedEvidenceRoles,
    ];
    const requiredSet = new Set(args.milestone.requiredEvidenceRoles);
    return roles.map((role) => {
      const ref = args.referenceRolesPresent?.[role] ?? null;
      return {
        role,
        patientLabel: patientSafeLabelForRole(role),
        required: requiredSet.has(role),
        whyRequested: whyRequestedForRole(role),
        captureInstructions: captureInstructionsForRole(role),
        referenceImageAvailable: Boolean(ref),
        referenceImageSource: ref,
      };
    });
  }

  /**
   * Operational health aggregates — no patient identities, no rankings.
   */
  async getCaptureProgrammeHealth(args?: {
    now?: string;
    uploadsByProjection?: Map<string, ProjectionUploadInput[]>;
  }): Promise<CaptureProgrammeHealth> {
    const records = await this.deps.capturePlanRepository.listAll();
    const health: CaptureProgrammeHealth = {
      totalPlans: records.length,
      totalMilestones: 0,
      future: 0,
      due: 0,
      incomplete: 0,
      ready: 0,
      observed: 0,
      missed: 0,
    };

    for (const record of records) {
      const projection = await this.deps.projectionRepository.findById(
        record.projectionSnapshotId
      );
      if (!projection) continue;
      const plan = await this.hydratePlan({
        record,
        projection,
        uploads: args?.uploadsByProjection?.get(record.projectionSnapshotId) ?? [],
        now: args?.now,
      });
      for (const m of plan.milestones) {
        health.totalMilestones += 1;
        switch (m.status) {
          case "future":
            health.future += 1;
            break;
          case "due":
            health.due += 1;
            break;
          case "evidence_incomplete":
            health.incomplete += 1;
            break;
          case "ready_for_review":
            health.ready += 1;
            break;
          case "observed":
            health.observed += 1;
            break;
          case "missed":
            health.missed += 1;
            break;
        }
      }
    }

    return health;
  }

  private async hydratePlan(args: {
    record: LongitudinalCapturePlanRecord;
    projection: ProjectionSnapshot;
    uploads: ProjectionUploadInput[];
    now?: string;
  }): Promise<LongitudinalCapturePlan> {
    getCapturePolicy(args.record.captureProtocolVersion);

    const treatment = resolveTreatmentCaptureContext(args.projection);
    const schedule = buildMilestoneSchedule({
      procedureDate: args.record.procedureDate,
      protocolVersion: args.record.captureProtocolVersion,
    });
    const nowDate = todayUtcDate(args.now ?? new Date().toISOString());

    const observations = this.deps.observationRepository
      ? await this.deps.observationRepository.listByProjection(
          args.record.projectionSnapshotId
        )
      : [];

    const milestones: LongitudinalCaptureMilestone[] = [];

    for (const slot of schedule) {
      const requirements = buildMilestoneEvidenceRequirements({
        stage: slot.stage,
        treatment,
        protocolVersion: args.record.captureProtocolVersion,
      });

      const evidence = assessMilestoneEvidence({
        stage: slot.stage,
        uploads: args.uploads,
        requirements,
        caseContext: {
          procedureDate: args.record.procedureDate,
          treatedAreas: treatment.treatedAreas,
        },
      });

      const activeObs =
        observations.find(
          (o) =>
            o.stage === slot.stage &&
            o.observationStatus === "active" &&
            o.projectionSnapshotId === args.record.projectionSnapshotId
        ) ?? null;

      const observationSnapshotId = activeObs?.id ?? null;

      let comparisonAvailable = false;
      let reviewAvailable = false;
      if (observationSnapshotId && this.deps.comparisonRepository) {
        const comps = await this.deps.comparisonRepository.listByObservation(
          observationSnapshotId
        );
        comparisonAvailable = comps.some((c) => c.comparisonStatus === "active");
      }
      if (observationSnapshotId && this.deps.isReviewAvailable) {
        reviewAvailable = await this.deps.isReviewAvailable({
          projectionSnapshotId: args.record.projectionSnapshotId,
          observationSnapshotId,
          stage: slot.stage,
        });
      } else if (comparisonAvailable) {
        // 1G is presentation over 1F; treat active comparison as review-ready signal.
        reviewAvailable = true;
      }

      const { status, lateEvidencePresent } = deriveMilestoneStatus({
        nowDate,
        windowStart: slot.windowStart,
        windowEnd: slot.windowEnd,
        requiredSatisfied: evidence.requiredSatisfied,
        anyEvidencePresent: evidence.anyEvidencePresent,
        observationSnapshotId,
      });

      milestones.push({
        stage: slot.stage,
        targetDate: slot.targetDate,
        windowStart: slot.windowStart,
        windowEnd: slot.windowEnd,
        status,
        requiredEvidenceRoles: requirements.required,
        recommendedEvidenceRoles: requirements.recommended,
        presentEvidenceRoles: evidence.presentEvidenceRoles,
        missingRequiredEvidenceRoles: evidence.missingRequiredEvidenceRoles,
        missingRecommendedEvidenceRoles: evidence.missingRecommendedEvidenceRoles,
        observationSnapshotId,
        completedAt: activeObs?.createdAt ?? null,
        lateEvidencePresent,
        comparisonAvailable,
        reviewAvailable,
      });
    }

    return {
      id: args.record.id,
      projectionSnapshotId: args.record.projectionSnapshotId,
      caseId: args.record.caseId,
      patientId: args.record.patientId,
      procedureDate: args.record.procedureDate,
      planVersion: args.record.capturePolicyVersion,
      protocolVersion: args.record.captureProtocolVersion,
      createdAt: args.record.createdAt,
      milestones,
    };
  }
}

export function createLongitudinalCapturePlanService(
  deps: LongitudinalCapturePlanServiceDeps
): LongitudinalCapturePlanService {
  return new LongitudinalCapturePlanService(deps);
}

/** Scan patient DTO for forbidden internal fields (tests / safety). */
export function assertPatientCaptureDtoSafe(
  dto: PatientLongitudinalCaptureDto
): { ok: true } | { ok: false; violations: string[] } {
  const blob = JSON.stringify(dto);
  const violations: string[] = [];
  const forbidden = [
    /"caseId"/i,
    /"patientId"/i,
    /"projectionSnapshotId"/i,
    /"observationSnapshotId"/i,
    /patient_photo:/i,
    /storage\//i,
    /graft survival/i,
    /accuracy/i,
    /"cohort/i,
  ];
  for (const re of forbidden) {
    if (re.test(blob)) violations.push(re.source);
  }
  // Allowlisted nextAction.type values may contain "followup"; forbid raw role/storage keys.
  if (/\bfollowup_(front|left|right|top|crown|donor)/i.test(blob)) {
    violations.push("raw_followup_role");
  }
  // Public view keys are allowlisted short names — ensure no raw role strings in labels
  for (const m of dto.milestones) {
    for (const v of [...m.requiredViews, ...m.recommendedViews]) {
      if (/followup_|postop_month/i.test(v.label) || /followup_/i.test(v.key)) {
        violations.push(`unsafe_view:${v.key}:${v.label}`);
      }
    }
  }
  return violations.length ? { ok: false, violations } : { ok: true };
}
