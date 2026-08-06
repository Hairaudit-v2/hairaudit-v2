/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Load clinician workspace + build report slice for report freeze.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreSurgeryPlanningOutcomeId } from "@/lib/reports/preSurgeryPlanningReport";
import { buildClinicianReportSlice } from "./reportIntegration";
import { loadWorkspaceBundle, insertAuditEvent } from "./repository.server";
import { createAuditEvent } from "./auditTimeline";
import {
  buildProjectionReportInclusionAuditMetadata,
  type IllustrativeProjectedResultSection,
} from "./reportProjectionInclusion";
import {
  decideReportProjectionInclusionAllowed,
  resolveProjectionActivationControls,
} from "./projection/activationControls";
import { resolveProjectionProviderConfig } from "./projection/config";

export async function loadClinicianReportSliceForCase(input: {
  admin: SupabaseClient;
  caseId: string;
  planningOutcomeId: PreSurgeryPlanningOutcomeId;
  stabilisationPriorityBand?: string | null;
  restorationSuitabilityBand?: string | null;
  graftEstimateRange?: { min: number; max: number } | null;
  pinnedProjectionId?: string | null;
  reportId?: string;
  reportVersion?: number;
  actorId?: string | null;
  now?: string;
}): Promise<ReturnType<typeof buildClinicianReportSlice>> {
  const bundle = await loadWorkspaceBundle(input.admin, input.caseId);

  const { data: uploads } = await input.admin
    .from("uploads")
    .select("id, storage_path")
    .eq("case_id", input.caseId);
  const sourceStoragePathByImageId: Record<string, string | null> = {};
  for (const u of uploads ?? []) {
    sourceStoragePathByImageId[String(u.id)] = u.storage_path ? String(u.storage_path) : null;
  }

  const controls = resolveProjectionActivationControls();
  const providerCfg = resolveProjectionProviderConfig();
  const inclusionActivationAllowed = decideReportProjectionInclusionAllowed({
    controls,
    providerKind: providerCfg.kind,
    projectionStale: false,
  }).allowed;

  const slice = buildClinicianReportSlice({
    observations: bundle.observations,
    graftPlans: bundle.graftPlans,
    projections: bundle.projections,
    imageReviews: bundle.imageReviews,
    caseId: input.caseId,
    pathway: "pre_surgery",
    planningOutcomeId: input.planningOutcomeId,
    stabilisationPriorityBand: input.stabilisationPriorityBand,
    restorationSuitabilityBand: input.restorationSuitabilityBand,
    graftEstimateRange: input.graftEstimateRange,
    pinnedProjectionId: input.pinnedProjectionId,
    sourceStoragePathByImageId,
    inclusionActivationAllowed,
    now: input.now,
  });

  if (input.reportId != null && input.reportVersion != null && slice.illustrativeProjectedResult) {
    await recordProjectionReportInclusionEvent({
      admin: input.admin,
      caseId: input.caseId,
      reportId: input.reportId,
      reportVersion: input.reportVersion,
      section: slice.illustrativeProjectedResult,
      actorId: input.actorId ?? null,
    });
  }

  return slice;
}

export async function recordProjectionReportInclusionEvent(input: {
  admin: SupabaseClient;
  caseId: string;
  reportId: string;
  reportVersion: number;
  section: IllustrativeProjectedResultSection;
  actorId?: string | null;
}): Promise<void> {
  const eventType =
    input.section.showImagery && input.section.inclusionState === "approved_for_inclusion"
      ? "projection_included_in_report"
      : "projection_omitted_from_report";
  try {
    await insertAuditEvent(
      input.admin,
      createAuditEvent({
        caseId: input.caseId,
        eventType,
        actorId: input.actorId ?? null,
        metadata: buildProjectionReportInclusionAuditMetadata({
          reportId: input.reportId,
          reportVersion: input.reportVersion,
          section: input.section,
        }),
      })
    );
  } catch {
    // Audit write must not block report freeze.
  }
}
