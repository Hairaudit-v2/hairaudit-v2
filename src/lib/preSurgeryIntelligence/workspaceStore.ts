/**
 * HA-PRE-SURGERY-INTELLIGENCE-2A — In-memory workspace store for domain logic / tests.
 * Server persistence uses Supabase tables (see migration); this mirrors the contract.
 */

import type {
  ClinicalImageAnnotation,
  ClinicalImageReview,
  ClinicalImageReviewCorrection,
  ClinicalObservation,
  PreSurgeryAuditEvent,
  PreSurgeryGraftPlan,
  PreSurgeryIllustrativeProjection,
} from "./types";

export type PreSurgeryIntelligenceWorkspaceState = {
  caseId: string;
  imageReviews: ClinicalImageReview[];
  imageCorrections: ClinicalImageReviewCorrection[];
  annotations: ClinicalImageAnnotation[];
  observations: ClinicalObservation[];
  graftPlans: PreSurgeryGraftPlan[];
  projections: PreSurgeryIllustrativeProjection[];
  auditEvents: PreSurgeryAuditEvent[];
};

export function createEmptyWorkspace(caseId: string): PreSurgeryIntelligenceWorkspaceState {
  return {
    caseId,
    imageReviews: [],
    imageCorrections: [],
    annotations: [],
    observations: [],
    graftPlans: [],
    projections: [],
    auditEvents: [],
  };
}

/** Process-local store keyed by caseId (tests / local stub). */
const memory = new Map<string, PreSurgeryIntelligenceWorkspaceState>();

export function getMemoryWorkspace(caseId: string): PreSurgeryIntelligenceWorkspaceState {
  let state = memory.get(caseId);
  if (!state) {
    state = createEmptyWorkspace(caseId);
    memory.set(caseId, state);
  }
  return state;
}

export function resetMemoryWorkspace(caseId?: string): void {
  if (caseId) memory.delete(caseId);
  else memory.clear();
}

export function saveMemoryWorkspace(state: PreSurgeryIntelligenceWorkspaceState): void {
  memory.set(state.caseId, state);
}
