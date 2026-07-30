/**
 * HA-PATIENT-REPORT-UI-1A — Donor-healing → PatientReportViewModel adapter.
 * Preserves orientation state/labels from HA-DONOR-HEALING-1B; does not remap.
 */

import type { PatientSafeDonorOrientationSlice } from "@/lib/patient/donorHealingOrientationReport";
import type { DonorHealingOrientation } from "@/lib/patient/donorHealingEntry";
import type { PostSurgeryAuditReport } from "@/lib/reports/postSurgeryAuditReport";
import { buildPatientReportViewModel } from "@/lib/patientReport/buildPatientReportViewModel";
import {
  buildHealingStageTimeline,
  orientationSemanticTone,
  patientSafeEvidenceSuitabilityLabel,
  patientSafeHealingStageLabel,
  patientSafeNextActionCategory,
} from "@/lib/patientReport/healingStageLabels";
import { groupUploadsIntoPatientReportPhotos } from "@/lib/patientReport/photoGrouping";
import type {
  PatientReportFindingEvidenceStrength,
  PatientReportFindingRow,
  PatientReportStatusItem,
  PatientReportViewModel,
} from "@/lib/patientReport/types";
import { buildPostSurgeryFallbackViewModel } from "@/lib/patientReport/adapters/postSurgeryFallbackAdapter";
import { DONOR_EVIDENCE_LIMITATIONS } from "@/lib/patientReport/donorPatientCopy";

export type DonorHealingAdapterInput = {
  report: PostSurgeryAuditReport;
  statusLabel?: string;
  reportDate?: string | null;
  procedureDate?: string | null;
  monthsSinceBand?: string | null;
  backHref?: string;
  downloadHref?: string;
  uploads?: Array<{
    id?: string;
    type?: string | null;
    storage_path?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
};

function primaryNextStep(orientation: PatientSafeDonorOrientationSlice): string {
  switch (orientation.state) {
    case "direct_clinical_assessment_recommended":
      return "Seek direct medical care when red-flag symptoms are present, and arrange in-person clinical assessment.";
    case "persistent_irregularity_deserves_review":
      return "Discuss the donor area with your treating clinic, or seek an independent in-person donor assessment.";
    case "insufficient_evidence":
      return "Continue dated photography with clear rear, left, and right donor views before relying on stage-aware orientation.";
    case "too_early_to_assess_homogeneity":
    case "temporary_shedding_may_contribute":
      return "Continue dated photography and discuss progress with your treating clinic at planned follow-up.";
    case "compatible_with_reported_stage":
    default:
      return "Discuss this orientation with your treating clinic as supporting context — not as a diagnosis.";
  }
}

function donorNextSteps(orientation: PatientSafeDonorOrientationSlice, fromReport: string[]): Array<{
  id: string;
  label: string;
  analyticsKey: string;
}> {
  const steps: Array<{ id: string; label: string; analyticsKey: string }> = [];
  const push = (id: string, label: string) => {
    if (!label.trim()) return;
    if (steps.some((s) => s.label === label)) return;
    steps.push({ id, label, analyticsKey: id });
  };

  push("primary", primaryNextStep(orientation));

  if (orientation.state === "insufficient_evidence" || !orientation.evidenceSufficient) {
    push("dated_photos", "Continue dated photography with comparable rear, left, and right donor views.");
  }
  if (
    orientation.state === "persistent_irregularity_deserves_review" ||
    orientation.state === "direct_clinical_assessment_recommended"
  ) {
    push("clinic_discuss", "Discuss the donor area with the treating clinic.");
    push("independent", "Seek independent in-person donor assessment when further clarity is needed.");
  }
  if (orientation.state === "direct_clinical_assessment_recommended") {
    push(
      "avoid_further",
      "Avoid further surgery until donor capacity has been clinically assessed in person."
    );
    push(
      "urgent",
      "Seek direct medical care when red-flag symptoms are present — photograph review does not replace urgent care."
    );
  }

  // Preserve existing report-contract next steps (already patient-sanitized upstream).
  let i = 0;
  for (const step of fromReport) {
    push(`report_${i++}`, step);
    if (steps.length >= 6) break;
  }

  return steps.slice(0, 6);
}

function photographsSupportLines(orientation: PatientSafeDonorOrientationSlice): string[] {
  const lines = [orientation.stageAwareNarrative];
  if (orientation.evidenceSufficient) {
    lines.push("Multi-angle donor views were available to support this structured orientation.");
  } else {
    lines.push("Available photographs provide limited support; additional comparable views would strengthen interpretation.");
  }
  return lines;
}

function remainsUncertainLines(): string[] {
  return [
    "Exact donor density cannot be measured from photographs.",
    "Permanent follicle loss may not be determinable from images alone.",
    "Remaining safe graft capacity cannot be determined from photographs.",
    "Whether extraction exceeded measured donor limits requires clinical examination.",
    "Conclusions that require physical examination remain outside this photo-based orientation.",
  ];
}

function evidenceStrengthFor(
  orientation: PatientSafeDonorOrientationSlice,
  domain: "uniformity" | "patch" | "stage" | "comparability"
): PatientReportFindingEvidenceStrength {
  if (!orientation.evidenceSufficient) return "limited";
  if (orientation.state === "insufficient_evidence") return "limited";
  if (domain === "comparability") {
    return orientation.evidenceSufficient ? "moderate" : "limited";
  }
  if (orientation.state === "compatible_with_reported_stage") return "moderate";
  if (orientation.state === "direct_clinical_assessment_recommended") return "high";
  return "moderate";
}

function buildFindingRows(
  report: PostSurgeryAuditReport,
  orientation: PatientSafeDonorOrientationSlice
): PatientReportFindingRow[] {
  const sectionById = new Map(report.sections.map((s) => [s.id, s]));
  const donorFinding = sectionById.get("donor_area")?.finding;
  const extractionFinding = sectionById.get("extraction_pattern")?.finding;

  return [
    {
      domain: "Donor uniformity",
      observation:
        donorFinding?.trim() ||
        orientation.stageAwareNarrative,
      evidenceStrength: evidenceStrengthFor(orientation, "uniformity"),
    },
    {
      domain: "Patch distribution",
      observation:
        extractionFinding?.trim() ||
        (orientation.state === "persistent_irregularity_deserves_review"
          ? "Submitted views and reported trend suggest irregularity that deserves structured clinical discussion."
          : "Patch distribution is interpreted only as orientation from available views — not a density measurement."),
      evidenceStrength: evidenceStrengthFor(orientation, "patch"),
    },
    {
      domain: "Stage compatibility",
      observation: orientation.label,
      evidenceStrength: evidenceStrengthFor(orientation, "stage"),
    },
    {
      domain: "Photo comparability",
      observation: orientation.evidenceSufficient
        ? "Donor views were suitable for structured photographic review."
        : "Photo comparability is limited; lighting, angle, and missing views reduce certainty.",
      evidenceStrength: evidenceStrengthFor(orientation, "comparability"),
    },
  ];
}

function reviewStatusLabel(orientation: PatientSafeDonorOrientationSlice): string | null {
  if (
    orientation.provenanceSource === "clinician_confirmation" ||
    orientation.provenanceSource === "clinician_correction"
  ) {
    return "Reviewed and confirmed";
  }
  return null;
}

function methodologyBody(orientation: PatientSafeDonorOrientationSlice): string {
  return [
    "This Post-Surgery Audit uses a bounded donor healing orientation based on submitted photographs, reported timing, and questionnaire context.",
    `Orientation label: ${orientation.label}.`,
    orientation.provenanceLabel,
    "HairAudit provides independent review support and does not replace clinical examination or urgent medical care.",
  ].join(" ");
}

/**
 * Convert a post-surgery audit report with donor orientation into the unified VM.
 * When orientation is missing, falls back to the post-surgery summary adapter.
 */
export function buildDonorHealingPatientReportViewModel(
  input: DonorHealingAdapterInput
): PatientReportViewModel {
  const orientation = input.report.donorHealingOrientation ?? null;
  if (!orientation) {
    return buildPostSurgeryFallbackViewModel({
      report: input.report,
      statusLabel: input.statusLabel,
      reportDate: input.reportDate,
      procedureDate: input.procedureDate,
      monthsSinceBand: input.monthsSinceBand,
      backHref: input.backHref,
      downloadHref: input.downloadHref,
      uploads: input.uploads,
      reason: "missing_donor_orientation",
    });
  }

  const stageLabel = patientSafeHealingStageLabel(
    input.monthsSinceBand,
    orientation.stageGroup
  );
  const nextAction = patientSafeNextActionCategory(orientation.state as DonorHealingOrientation);
  const tone = orientationSemanticTone(orientation.state as DonorHealingOrientation);
  const photoGroups = groupUploadsIntoPatientReportPhotos(input.uploads ?? []);

  const scorecardLines = input.report.scorecards
    .map((c) => `${c.id.replaceAll("_", " ")}: ${c.displayValue}`)
    .join(" · ");

  const vm: PatientReportViewModel = {
    reportType: "donor_healing",
    reportTitle: "Post-Surgery Audit",
    reportSubtitle: "Donor healing review",
    caseStatus: input.statusLabel,
    reportDate: input.reportDate ?? input.report.generatedAt ?? undefined,
    procedureDate: input.procedureDate ?? undefined,
    reportReference: null,
    backHref: input.backHref ?? "/dashboard/patient",
    downloadHref: input.downloadHref,
    summary: {
      label: "Donor healing orientation",
      title: orientation.label,
      narrative: orientation.stageAwareNarrative,
      escalationCopy: orientation.escalationCopy,
      tone,
      reviewStatusLabel: reviewStatusLabel(orientation),
    },
    statusItems: [
      {
        id: "healing_stage",
        label: "Healing stage",
        value: stageLabel,
        tone: "info",
      },
      {
        id: "evidence",
        label: "Evidence",
        value: patientSafeEvidenceSuitabilityLabel(orientation.evidenceSufficient),
        tone: orientation.evidenceSufficient ? "compatible" : "unavailable",
      },
      {
        id: "next_action",
        label: "Next step",
        value: nextAction.value,
        tone: nextAction.tone,
      },
    ] satisfies PatientReportStatusItem[],
    sections: [
      {
        type: "orientation",
        id: "orientation",
        navLabel: "Summary",
      },
      {
        type: "narrative",
        id: "what_this_means",
        navLabel: "Summary",
        title: "What this means",
        whatThisMeans: {
          photographsSupport: photographsSupportLines(orientation),
          remainsUncertain: remainsUncertainLines(),
          recommendedNextStep: primaryNextStep(orientation),
        },
      },
      {
        type: "photos",
        id: "photographs",
        navLabel: "Photographs",
        title: "Donor photographs",
        subtitle: "Submitted views used for this orientation. Tap or click to expand.",
        groups: photoGroups,
      },
      {
        type: "findings",
        id: "findings",
        navLabel: "Findings",
        title: "Observed donor features",
        subtitle: "Patient-safe observations with evidence strength — not diagnostic scores.",
        rows: buildFindingRows(input.report, orientation),
      },
      {
        type: "timeline",
        id: "healing_stage",
        navLabel: "Healing stage",
        title: "Healing-stage interpretation",
        subtitle: "Timing context from your reported stage — aligned with existing donor healing contracts.",
        items: buildHealingStageTimeline({
          stageLabel,
          stageGroup: orientation.stageGroup,
          state: orientation.state,
        }),
      },
      {
        type: "limitations",
        id: "limitations",
        navLabel: "Limitations",
        title: "Evidence limitations",
        items: [...DONOR_EVIDENCE_LIMITATIONS],
      },
      {
        type: "recommendations",
        id: "next_steps",
        navLabel: "Next steps",
        title: "Recommended next steps",
        subtitle: "Actions supported by this report — not a treatment plan.",
        steps: donorNextSteps(orientation, input.report.recommendedNextSteps),
      },
      {
        type: "disclosure",
        id: "supporting_detail",
        navLabel: "Supporting detail",
        title: "Supporting evidence",
        subtitle: "Secondary detail — expand if you want more context.",
        defaultCollapsed: true,
        items: [
          {
            id: "scorecards",
            title: "Procedural assessment scores",
            body:
              scorecardLines ||
              "Score detail is available in the full Post-Surgery Audit record.",
            expandInPrint: false,
          },
          {
            id: "concerns",
            title: "Areas flagged for discussion",
            body:
              input.report.concernFlags.length > 0
                ? input.report.concernFlags.map((f) => f.text).join(" ")
                : "No additional concern flags were raised beyond the donor orientation above.",
            expandInPrint: false,
          },
          {
            id: "disclaimer",
            title: "Clinical disclaimer",
            body: input.report.patientSafeSummary.clinicalDisclaimer,
            alwaysVisible: false,
            expandInPrint: true,
          },
        ],
      },
      {
        type: "disclosure",
        id: "methodology",
        navLabel: "Supporting detail",
        title: "Methodology and report record",
        defaultCollapsed: true,
        items: [
          {
            id: "methodology",
            title: "How this orientation was produced",
            body: methodologyBody(orientation),
            expandInPrint: true,
          },
          {
            id: "provenance_summary",
            title: "Review record",
            body: `${orientation.provenanceLabel}. Internal identifiers are not shown in this patient report.`,
            expandInPrint: false,
          },
        ],
      },
    ],
    actions: [
      {
        id: "back",
        kind: "back",
        label: "Back to case",
        href: input.backHref ?? "/dashboard/patient",
      },
      ...(input.downloadHref
        ? [
            {
              id: "download",
              kind: "download" as const,
              label: "Download PDF",
              href: input.downloadHref,
              analyticsKey: "download",
            },
          ]
        : []),
      {
        id: "print",
        kind: "print",
        label: "Print",
        analyticsKey: "print",
      },
    ],
    disclosures: [
      {
        id: "urgent_care",
        title: "Important",
        body: "HairAudit does not replace urgent medical care. Contact your treating clinic, local doctor, or urgent medical service depending on severity.",
        alwaysVisible: true,
        expandInPrint: true,
      },
    ],
    analytics: {
      reportType: "donor_healing",
      entryContext: "donor_healing",
      pathway: "post_surgery",
    },
  };

  return buildPatientReportViewModel(vm);
}
