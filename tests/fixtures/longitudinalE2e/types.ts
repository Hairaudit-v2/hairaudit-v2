/**
 * FI-OUTCOME-INTELLIGENCE-1F — Fixture types.
 */

import type {
  LongitudinalEvidenceRole,
  LongitudinalOutcomeStage,
} from "@/lib/projection/types";
import type { ProjectionSnapshot } from "@/lib/projection/projectionSnapshotTypes";
import type { ProjectionObservationSnapshot } from "@/lib/projection/projectionObservationTypes";
import type { ProjectionComparisonSnapshot } from "@/lib/projection/projectionComparisonTypes";
import type { LongitudinalCapturePlan } from "@/lib/outcomeIntelligence/longitudinalCaptureTypes";
import type { LongitudinalEngagementEventRecord } from "@/lib/outcomeIntelligence/longitudinalEngagementTypes";
import type { InMemoryProjectionSnapshotRepository } from "@/lib/projection/projectionSnapshotRepository";
import type { InMemoryProjectionObservationRepository } from "@/lib/projection/projectionObservationRepository";
import type { InMemoryProjectionComparisonRepository } from "@/lib/projection/projectionComparisonRepository";
import type { InMemoryLongitudinalCapturePlanRepository } from "@/lib/outcomeIntelligence/longitudinalCaptureRepository";
import type { InMemoryLongitudinalEngagementEventRepository } from "@/lib/outcomeIntelligence/longitudinalEngagementRepository";
import type { ProjectionUploadInput } from "@/lib/projection/types";
import type { LongitudinalE2eFixtureKey } from "./constants";

export type FixtureSeedMode =
  | "seed-to-due"
  | "seed-to-incomplete"
  | "seed-to-ready"
  | "seed-to-observed";

export type FixtureProjectionMode =
  | "baseline_plus"
  | "surgery_day_only";

export type LongitudinalFixtureManifestEntry = {
  fixtureKey: LongitudinalE2eFixtureKey;
  displayName: string;
  projectionMode: FixtureProjectionMode;
  treatedAreas: string[];
  focusStage: LongitudinalOutcomeStage;
  /** When set, procedure date is chosen so this stage is within window (e.g. month_9 due while month_6 missed). */
  anchorStageForWindow?: LongitudinalOutcomeStage;
  mode: FixtureSeedMode;
  /** Roles already present as uploads (incomplete / resume / replace). */
  existingUploadRoles?: LongitudinalEvidenceRole[];
  /** Seed a prior reference image (e.g. surgery-day front). */
  seedReferenceFront?: boolean;
  /** Run engagement decision for focus stage. */
  seedEngagement?: boolean;
  /** Create observation + comparison (observed / full-loop). */
  seedComparison?: boolean;
  notes?: string;
};

export type SeedLongitudinalProjectionFixtureConfig = {
  fixtureKey: string;
  mode?: FixtureSeedMode;
  projectionMode?: FixtureProjectionMode;
  treatedAreas?: string[];
  focusStage?: LongitudinalOutcomeStage;
  anchorStageForWindow?: LongitudinalOutcomeStage;
  existingUploadRoles?: LongitudinalEvidenceRole[];
  seedReferenceFront?: boolean;
  seedEngagement?: boolean;
  seedComparison?: boolean;
  /** Override clock (ISO). Defaults to fixed test now or real now for DB. */
  now?: string;
  procedureDate?: string;
  caseId?: string;
  patientId?: string;
  projectionId?: string;
  observationId?: string;
  comparisonId?: string;
};

export type LongitudinalFixtureBundle = {
  fixtureKey: string;
  caseId: string;
  patientId: string;
  procedureDate: string;
  now: string;
  mode: FixtureSeedMode;
  projection: ProjectionSnapshot;
  plan: LongitudinalCapturePlan;
  uploads: ProjectionUploadInput[];
  observation: ProjectionObservationSnapshot | null;
  comparison: ProjectionComparisonSnapshot | null;
  engagementEvent: LongitudinalEngagementEventRecord | null;
  /** Canonical deep-link from engagement or 1C nextAction. */
  captureHref: string | null;
  repos: {
    projectionRepo: InMemoryProjectionSnapshotRepository;
    observationRepo: InMemoryProjectionObservationRepository;
    comparisonRepo: InMemoryProjectionComparisonRepository;
    captureRepo: InMemoryLongitudinalCapturePlanRepository;
    engagementRepo: InMemoryLongitudinalEngagementEventRepository;
  };
};

export type LongitudinalE2eCatalogEntry = {
  fixtureKey: string;
  externalCaseId: string;
  email: string;
  password: string;
  caseId: string;
  patientId: string;
  projectionSnapshotId: string;
  observationSnapshotId: string | null;
  comparisonSnapshotId: string | null;
  focusStage: LongitudinalOutcomeStage;
  captureHref: string | null;
  mode: FixtureSeedMode;
};

export type LongitudinalE2eCatalog = {
  entries: LongitudinalE2eCatalogEntry[];
  byKey: Record<string, LongitudinalE2eCatalogEntry>;
};
