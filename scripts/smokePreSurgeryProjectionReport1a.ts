/**
 * HA-PRE-SURGERY-PROJECTION-REPORT-1A — Synthetic HTML smoke fixtures (no PHI).
 * Run: pnpm exec tsx scripts/smokePreSurgeryProjectionReport1a.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { seedAiGraftPlan, createClinicianPlanRevision } from "../src/lib/preSurgeryIntelligence/graftPlanSeed";
import { buildClinicianReportSlice } from "../src/lib/preSurgeryIntelligence/reportIntegration";
import { PRE_SURGERY_PROJECTION_PATIENT_LABELS } from "../src/lib/preSurgeryIntelligence/types";
import type { PreSurgeryIllustrativeProjection } from "../src/lib/preSurgeryIntelligence/types";
import { generatePreSurgeryPlanningReport } from "../src/lib/reports/preSurgeryPlanningReport";
import { renderPreSurgeryPlanningReportHtml } from "../src/lib/reports/PreSurgeryPlanningReportHtml";
import {
  buildPreSurgeryClinicalEvidenceGalleryLabelsEn,
  buildPreSurgeryReportHtmlLabelsEn,
  PRE_SURGERY_OUTCOME_LABELS_EN,
} from "../src/lib/reports/preSurgeryReportLabels";

const CASE_ID = "00000000-0000-4000-8000-0000000000b1";
const OUT = path.join("tmp", "pre-surgery-projection-report-1a");

function approvedPlan() {
  const plan = seedAiGraftPlan({
    caseId: CASE_ID,
    createdBy: "clin",
    norwood: "III",
    evidenceImageIds: ["img-1"],
    id: "plan-v1",
  });
  return createClinicianPlanRevision(
    plan,
    {
      status: "approved",
      approvedBy: "clin",
      approvedAt: "2026-08-06T02:00:00.000Z",
      zones: plan.zones.map((z) =>
        z.zone === "crown"
          ? { ...z, priority: "defer" as const, minimumGrafts: 0, targetGrafts: 0, maximumGrafts: 0 }
          : { ...z, evidenceImageIds: ["img-1"] }
      ),
    },
    "clin",
    { id: "plan-approved" }
  );
}

function projection(
  plan: ReturnType<typeof approvedPlan>,
  overrides: Partial<PreSurgeryIllustrativeProjection> = {}
): PreSurgeryIllustrativeProjection {
  return {
    id: "proj-smoke-1",
    caseId: CASE_ID,
    graftPlanId: plan.id,
    graftPlanVersion: plan.version,
    sourceImageId: "img-1",
    mode: "planned",
    patientSafeLabel: PRE_SURGERY_PROJECTION_PATIENT_LABELS.planned,
    patientSafeDisclaimer:
      "Illustrative planned projection based on the current clinical plan. Not a guarantee of density, growth, survival, or final appearance.",
    status: "approved",
    engineVersion: "ha-pre-surgery-projection-v2",
    generationVersion: "ha-pre-surgery-projection-v2",
    safetyLabelVersion: "ha-pre-surgery-projection-safety-label-v1",
    deterministicSeed: null,
    storagePath: `pre_surgery_projections/${CASE_ID}/planned/smoke.stub`,
    validationPass: [
      { check: "treatment_zone_compliance", passed: true, detail: "ok" },
      { check: "deferred_zone_compliance", passed: true, detail: "ok" },
      { check: "graft_range_plausibility", passed: true, detail: "ok" },
    ],
    limitations: ["Illustrative planning aid — not a guaranteed outcome."],
    planningAssumptions: ["Projection is constrained to the clinician-approved graft plan."],
    requestedBy: "clin",
    requestedAt: "2026-08-06T02:00:00.000Z",
    generatedAt: "2026-08-06T02:05:00.000Z",
    approvedBy: "clin",
    approvedAt: "2026-08-06T02:10:00.000Z",
    approvedRole: "auditor",
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    inputChecksum: "smoke-input",
    outputChecksum: "smoke-output",
    patientSharingEnabled: true,
    projectionVersion: 1,
    ...overrides,
  };
}

function render(label: string, slice: ReturnType<typeof buildClinicianReportSlice>, media: {
  sourceImageUrl: string | null;
  projectedImageUrl: string | null;
}) {
  const report = generatePreSurgeryPlanningReport({
    caseId: CASE_ID,
    summary: {
      forensic_audit: {
        overall_score: 74,
        key_findings: [{ title: "Visible frontal recession with planning considerations" }],
        photo_observations: [],
      },
    },
    clinicianReportSlice: slice,
  });
  const html = renderPreSurgeryPlanningReportHtml({
    report,
    caseId: CASE_ID,
    generatedAtDisplay: "2026-08-06",
    labels: buildPreSurgeryReportHtmlLabelsEn(
      PRE_SURGERY_OUTCOME_LABELS_EN[report.planningOutcomeId] ?? report.planningOutcomeId
    ),
    clinicalEvidenceLabels: buildPreSurgeryClinicalEvidenceGalleryLabelsEn(),
    illustrativeProjectionMedia: media,
  });
  writeFileSync(path.join(OUT, `${label}.html`), html, "utf8");
  writeFileSync(
    path.join(OUT, `${label}-meta.json`),
    JSON.stringify(
      {
        reportId: report.reportId,
        inclusionState: report.illustrativeProjectedResult?.inclusionState ?? null,
        showImagery: report.illustrativeProjectedResult?.showImagery ?? false,
        projectionSnapshotId: report.illustrativeProjectedResult?.projectionSnapshotId ?? null,
        mode: report.illustrativeProjectedResult?.mode ?? null,
        deferredZones: report.illustrativeProjectedResult?.deferredZones ?? [],
        graftRange: report.graftEstimateRange,
      },
      null,
      2
    ),
    "utf8"
  );
  return report;
}

mkdirSync(OUT, { recursive: true });
const plan = approvedPlan();

const approvedSlice = buildClinicianReportSlice({
  observations: [],
  graftPlans: [plan],
  projections: [projection(plan)],
  caseId: CASE_ID,
  pathway: "pre_surgery",
  planningOutcomeId: "suitable_with_long_term_planning",
});
render("A-approved-projection", approvedSlice, {
  sourceImageUrl:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect fill='#cbd5e1' width='400' height='300'/><text x='20' y='150' font-size='18'>Source photo (synthetic)</text></svg>`
    ),
  projectedImageUrl:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect fill='#e0f2fe' width='400' height='300'/><text x='20' y='150' font-size='18'>Illustrative projection (synthetic)</text></svg>`
    ),
});

const draftSlice = buildClinicianReportSlice({
  observations: [],
  graftPlans: [plan],
  projections: [projection(plan, { status: "generated", patientSharingEnabled: false })],
  caseId: CASE_ID,
  pathway: "pre_surgery",
  planningOutcomeId: "suitable_with_long_term_planning",
});
render("B-draft-omitted", draftSlice, { sourceImageUrl: null, projectedImageUrl: null });

const noneSlice = buildClinicianReportSlice({
  observations: [],
  graftPlans: [plan],
  projections: [],
  caseId: CASE_ID,
  pathway: "pre_surgery",
  planningOutcomeId: "suitable_with_long_term_planning",
});
render("C-no-projection", noneSlice, { sourceImageUrl: null, projectedImageUrl: null });

render("D-asset-fallback", approvedSlice, { sourceImageUrl: null, projectedImageUrl: null });

writeFileSync(
  path.join(OUT, "evidence-readme.txt"),
  [
    "HA-PRE-SURGERY-PROJECTION-REPORT-1A synthetic HTML fixtures",
    "A — approved planned mode with side-by-side synthetic imagery",
    "B — draft/generated projection omitted from patient report",
    "C — no projection available; controlled omit copy",
    "D — approved metadata with controlled media fallback (no broken img placeholders)",
    "These HTML files are print-ready smoke artifacts (open in browser → Print to PDF).",
  ].join("\n"),
  "utf8"
);

console.log(`Wrote fixtures to ${OUT}`);
