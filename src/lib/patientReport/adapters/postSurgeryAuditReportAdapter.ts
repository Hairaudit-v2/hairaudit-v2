/**
 * HA-PATIENT-REPORT-UI-1B — Standard Post-Surgery Audit → PatientReportViewModel.
 * Pure adapter: no fetches, no clinical recalculation, no donor orientation remapping.
 */

import type { PostSurgeryAuditReport } from "@/lib/reports/postSurgeryAuditReport";
import { buildPatientReportViewModel } from "@/lib/patientReport/buildPatientReportViewModel";
import {
  isEarlyPostSurgeryStage,
  normalizePostSurgeryFindings,
  normalizePostSurgeryPhotos,
  normalizePostSurgeryReportSnapshot,
  normalizePostSurgeryTiming,
  stripInternalIdsFromPatientText,
} from "@/lib/patientReport/normalizePostSurgeryReport";
import {
  nextActionFromRepair,
  outcomeSemanticTone,
  POST_SURGERY_EVIDENCE_LIMITATIONS,
  POST_SURGERY_OUTCOME_TITLES,
  POST_SURGERY_REMAINS_UNCERTAIN,
  POST_SURGERY_REPAIR_LABELS,
  POST_SURGERY_SCORECARD_LABELS,
} from "@/lib/patientReport/postSurgeryPatientCopy";
import { patientSafeEvidenceSuitabilityLabel } from "@/lib/patientReport/healingStageLabels";
import type {
  PatientReportDisclosureItem,
  PatientReportFindingRow,
  PatientReportSection,
  PatientReportTimelineItem,
  PatientReportViewModel,
} from "@/lib/patientReport/types";

export type BuildPostSurgeryAuditPatientReportInput = {
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
  /** Analytics entry context when falling back from donor path. */
  entryContext?: string;
  /** Optional reason for thin/legacy fallback analytics. */
  fallbackReason?: "missing_donor_orientation" | "legacy_post_surgery";
};

function evidenceSuitability(report: PostSurgeryAuditReport, photoCount: number): boolean {
  if (photoCount >= 2) return true;
  if ((report.imageAssessments ?? []).length >= 1) return true;
  if ((report.sections ?? []).filter((s) => s.finding?.trim()).length >= 4) return true;
  return false;
}

function photographsSupportLines(
  normalized: ReturnType<typeof normalizePostSurgeryReportSnapshot>,
  findings: ReturnType<typeof normalizePostSurgeryFindings>
): string[] {
  const lines: string[] = [];
  const push = (text: string) => {
    const cleaned = stripInternalIdsFromPatientText(text);
    if (!cleaned) return;
    if (lines.some((l) => l === cleaned)) return;
    lines.push(cleaned);
  };

  push(normalized.plainEnglishSummary);
  for (const finding of findings.slice(0, 4)) {
    push(finding.observation);
    if (lines.length >= 3) break;
  }
  return lines.slice(0, 3);
}

function buildKeyFindingRows(
  findings: ReturnType<typeof normalizePostSurgeryFindings>
): PatientReportFindingRow[] {
  const preferredOrder = [
    "recipient_area",
    "density_distribution",
    "donor_area",
    "extraction_pattern",
    "procedural_integrity",
    "overall_procedure",
    "long_term_risk",
    "repair_considerations",
  ];
  const byId = new Map(findings.map((f) => [f.sectionId, f]));
  const rows: PatientReportFindingRow[] = [];
  for (const id of preferredOrder) {
    const f = byId.get(id);
    if (!f) continue;
    rows.push({
      domain: f.domain,
      observation: stripInternalIdsFromPatientText(f.observation),
      evidenceStrength: f.evidenceStrength,
    });
  }
  for (const f of findings) {
    if (rows.some((r) => r.domain === f.domain)) continue;
    rows.push({
      domain: f.domain,
      observation: stripInternalIdsFromPatientText(f.observation),
      evidenceStrength: f.evidenceStrength,
    });
  }
  return rows.slice(0, 8);
}

function sectionFinding(
  findings: ReturnType<typeof normalizePostSurgeryFindings>,
  sectionId: string
): string | null {
  const hit = findings.find((f) => f.sectionId === sectionId);
  return hit ? stripInternalIdsFromPatientText(hit.observation) : null;
}

function buildDomainFindingsSection(
  id: string,
  navLabel: string,
  title: string,
  subtitle: string | undefined,
  rows: PatientReportFindingRow[]
): PatientReportSection | null {
  if (rows.length === 0) return null;
  return {
    type: "findings",
    id,
    navLabel,
    title,
    subtitle,
    rows,
  };
}

function buildStageTimeline(input: {
  stageLabel: string;
  timingKnown: boolean;
  timingLimitationCopy: string | null;
  monthsSinceBand: string | null;
  earlyStage: boolean;
}): PatientReportTimelineItem[] {
  if (!input.timingKnown) {
    return [
      {
        id: "timing_unknown",
        title: "Procedure stage",
        body:
          input.timingLimitationCopy ??
          "Procedure timing was not available, so stage-specific interpretation is limited.",
        emphasis: true,
      },
      {
        id: "can_assess",
        title: "What can reasonably be assessed",
        body: "General photographic patterns and questionnaire context can still be discussed, with lower certainty until timing is confirmed.",
      },
      {
        id: "too_early",
        title: "What remains uncertain",
        body: "Stage-specific healing and growth expectations cannot be applied reliably without confirmed procedure timing.",
      },
    ];
  }

  return [
    {
      id: "reported_stage",
      title: "Procedure stage",
      body: input.stageLabel,
      emphasis: true,
    },
    {
      id: "why_timing",
      title: "Why timing matters",
      body: input.earlyStage
        ? "Early after surgery, temporary shedding, redness, and incomplete growth commonly dominate appearance — final density should not be judged yet."
        : "At later follow-up stages, photographic patterns of coverage and donor appearance become more meaningful to discuss — still as orientation, not a measured graft count.",
    },
    {
      id: "can_assess",
      title: "What can reasonably be assessed",
      body: input.earlyStage
        ? "Early healing appearance, photograph completeness, and whether findings deserve staged clinical discussion."
        : "Visible coverage patterns, donor uniformity from available views, and whether findings deserve structured clinic discussion.",
    },
    {
      id: "too_early",
      title: "What remains too early to determine",
      body: input.earlyStage
        ? "Mature density, permanent follicle survival, and long-term donor reserve cannot be determined from early-stage photographs alone."
        : "Exact graft survival, measured density, and remaining donor capacity still require clinical examination beyond photographs.",
    },
  ];
}

function buildNextSteps(
  normalized: ReturnType<typeof normalizePostSurgeryReportSnapshot>,
  earlyStage: boolean
): Array<{ id: string; label: string; analyticsKey: string }> {
  const steps: Array<{ id: string; label: string; analyticsKey: string }> = [];
  const push = (id: string, label: string) => {
    const cleaned = stripInternalIdsFromPatientText(label);
    if (!cleaned) return;
    if (steps.some((s) => s.label === cleaned)) return;
    steps.push({ id, label: cleaned, analyticsKey: id });
  };

  for (const step of normalized.recommendedNextSteps) {
    push(`report_${steps.length}`, step);
    if (steps.length >= 6) break;
  }

  if (earlyStage) {
    push(
      "dated_photos",
      "Continue standardised dated photography before judging the mature result."
    );
  }

  if (
    normalized.repairId === "moderate_consultation" ||
    normalized.repairId === "significant_planning" ||
    normalized.outcomeId === "significant_concerns" ||
    normalized.outcomeId === "donor_preservation_concerns"
  ) {
    push("clinic_discuss", "Discuss the findings with the treating clinic.");
  }

  if (normalized.concernFlags.some((f) => f.severity === "significant")) {
    push(
      "independent",
      "Obtain an independent in-person assessment when further clarity is needed."
    );
  }

  if (steps.length === 0) {
    push("default", "Discuss this summary with your treating clinic.");
  }

  return steps.slice(0, 6);
}

/**
 * Convert a standard Post-Surgery Audit report into the canonical patient VM.
 */
export function buildPostSurgeryAuditPatientReportViewModel(
  input: BuildPostSurgeryAuditPatientReportInput
): PatientReportViewModel {
  const normalized = normalizePostSurgeryReportSnapshot(input.report);
  const findings = normalizePostSurgeryFindings(input.report);
  const photoGroups = normalizePostSurgeryPhotos(input.uploads);
  const timing = normalizePostSurgeryTiming({
    procedureDate: input.procedureDate,
    monthsSinceBand: input.monthsSinceBand,
  });
  const earlyStage = isEarlyPostSurgeryStage(timing.monthsSinceBand);
  const evidenceOk = evidenceSuitability(input.report, photoGroups.reduce((n, g) => n + g.photos.length, 0));
  const nextAction = nextActionFromRepair(normalized.repairId, normalized.outcomeId);
  const tone = outcomeSemanticTone(normalized.outcomeId);
  const outcomeTitle = POST_SURGERY_OUTCOME_TITLES[normalized.outcomeId];

  const keyRows = buildKeyFindingRows(findings);
  const recipientRows: PatientReportFindingRow[] = [];
  const donorRows: PatientReportFindingRow[] = [];
  const densityRows: PatientReportFindingRow[] = [];
  const proceduralRows: PatientReportFindingRow[] = [];

  const recipientText = sectionFinding(findings, "recipient_area");
  if (recipientText) {
    recipientRows.push({
      domain: "Recipient appearance",
      observation: recipientText,
      evidenceStrength: findings.find((f) => f.sectionId === "recipient_area")?.evidenceStrength ?? "moderate",
    });
  }
  const overallText = sectionFinding(findings, "overall_procedure");
  if (overallText && recipientRows.length > 0) {
    recipientRows.push({
      domain: "Overall pattern",
      observation: overallText,
      evidenceStrength: "moderate",
    });
  }

  const donorText = sectionFinding(findings, "donor_area");
  if (donorText) {
    donorRows.push({
      domain: "Donor uniformity",
      observation: donorText,
      evidenceStrength: findings.find((f) => f.sectionId === "donor_area")?.evidenceStrength ?? "moderate",
    });
  }
  const extractionText = sectionFinding(findings, "extraction_pattern");
  if (extractionText) {
    donorRows.push({
      domain: "Extraction distribution",
      observation: extractionText,
      evidenceStrength:
        findings.find((f) => f.sectionId === "extraction_pattern")?.evidenceStrength ?? "moderate",
    });
  }

  const densityText = sectionFinding(findings, "density_distribution");
  if (densityText) {
    densityRows.push({
      domain: "Visible coverage",
      observation: densityText,
      evidenceStrength:
        findings.find((f) => f.sectionId === "density_distribution")?.evidenceStrength ?? "moderate",
    });
    densityRows.push({
      domain: "Photographic limits",
      observation:
        "Visible scalp show-through and uneven coverage can reflect lighting, hair length, styling, and growth stage — not a measured graft density.",
      evidenceStrength: "limited",
    });
  }

  const proceduralText = sectionFinding(findings, "procedural_integrity");
  if (proceduralText) {
    proceduralRows.push({
      domain: "Procedural integrity",
      observation: proceduralText,
      evidenceStrength:
        findings.find((f) => f.sectionId === "procedural_integrity")?.evidenceStrength ?? "moderate",
    });
  }

  const sections: PatientReportSection[] = [
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
        photographsSupport: photographsSupportLines(normalized, findings),
        remainsUncertain: [...POST_SURGERY_REMAINS_UNCERTAIN].slice(0, 5),
        recommendedNextStep:
          normalized.recommendedNextSteps[0] ??
          nextAction.value,
      },
    },
  ];

  if (keyRows.length > 0) {
    sections.push({
      type: "findings",
      id: "findings",
      navLabel: "Findings",
      title: "Key findings",
      subtitle: "Patient-safe observations with evidence strength — not diagnostic scores.",
      rows: keyRows,
    });
  }

  if (photoGroups.length > 0) {
    sections.push({
      type: "photos",
      id: "photographs",
      navLabel: "Photographs",
      title: "Photographic evidence",
      subtitle: "Submitted views used for this review. Tap or click to expand.",
      groups: photoGroups,
    });
  }

  const recipientSection = buildDomainFindingsSection(
    "recipient_area",
    "Recipient area",
    "Recipient-area assessment",
    "Appearance-based observations from available photographs — not a graft-survival measurement.",
    recipientRows
  );
  if (recipientSection) sections.push(recipientSection);

  const donorSection = buildDomainFindingsSection(
    "donor_area",
    "Donor area",
    "Donor-area assessment",
    "Standard donor findings from this Post-Surgery Audit — not a six-state donor-healing orientation.",
    donorRows
  );
  if (donorSection) sections.push(donorSection);

  const densitySection = buildDomainFindingsSection(
    "density_coverage",
    "Findings",
    "Density and coverage",
    "Photographic density estimates are not measured graft density.",
    densityRows
  );
  if (densitySection) sections.push(densitySection);

  const proceduralSection = buildDomainFindingsSection(
    "procedural_integrity",
    "Findings",
    "Procedural integrity",
    "Observations about documentation consistency and visible patterns — not legal findings.",
    proceduralRows
  );
  if (proceduralSection) sections.push(proceduralSection);

  sections.push({
    type: "timeline",
    id: "healing_stage",
    navLabel: "Procedure stage",
    title: "Healing or growth-stage interpretation",
    subtitle: "Timing context from your reported procedure stage.",
    items: buildStageTimeline({
      stageLabel: timing.stageLabel,
      timingKnown: timing.timingKnown,
      timingLimitationCopy: timing.timingLimitationCopy,
      monthsSinceBand: timing.monthsSinceBand,
      earlyStage,
    }),
  });

  sections.push({
    type: "limitations",
    id: "limitations",
    navLabel: "Limitations",
    title: "Evidence limitations",
    items: [...POST_SURGERY_EVIDENCE_LIMITATIONS],
  });

  sections.push({
    type: "recommendations",
    id: "next_steps",
    navLabel: "Next steps",
    title: "Recommended next steps",
    subtitle: "Actions supported by this report — not a treatment plan.",
    steps: buildNextSteps(normalized, earlyStage),
  });

  const supportingItems: PatientReportDisclosureItem[] = [];
  if (normalized.hasScores) {
    supportingItems.push({
      id: "scorecards",
      title: "Procedural assessment scores",
      body: normalized.scorecards
        .map((c) => {
          const label = POST_SURGERY_SCORECARD_LABELS[c.id] ?? c.id.replaceAll("_", " ");
          return `${label}: ${c.displayValue}`;
        })
        .join(" · "),
      expandInPrint: false,
    });
  } else {
    supportingItems.push({
      id: "scorecards",
      title: "Procedural assessment scores",
      body: "Numeric score detail was not available for this report. The narrative findings above remain the primary patient-facing result.",
      expandInPrint: false,
    });
  }

  if (normalized.concernFlags.length > 0) {
    supportingItems.push({
      id: "concerns",
      title: "Areas flagged for discussion",
      body: normalized.concernFlags.map((f) => stripInternalIdsFromPatientText(f.text)).join(" "),
      expandInPrint: false,
    });
  }

  if (normalized.imageAssessments.length > 0) {
    supportingItems.push({
      id: "image_assessments",
      title: "Evidence inventory",
      body: normalized.imageAssessments
        .map((a) => {
          const label = a.imageLabel || a.viewKey;
          return `${label}: ${stripInternalIdsFromPatientText(a.assessment)}`;
        })
        .join(" "),
      expandInPrint: false,
    });
  }

  if (normalized.repairPlanningGuidance.length > 0) {
    supportingItems.push({
      id: "repair_guidance",
      title: "Repair consideration notes",
      body: [
        POST_SURGERY_REPAIR_LABELS[normalized.repairId],
        ...normalized.repairPlanningGuidance.map(stripInternalIdsFromPatientText),
      ].join(" "),
      expandInPrint: false,
    });
  }

  if (normalized.longTermBody) {
    supportingItems.push({
      id: "long_term",
      title: "Long-term preservation context",
      body: stripInternalIdsFromPatientText(normalized.longTermBody),
      expandInPrint: false,
    });
  }

  if (normalized.futureRiskBody) {
    supportingItems.push({
      id: "future_risk",
      title: "Future hair-loss context",
      body: stripInternalIdsFromPatientText(normalized.futureRiskBody),
      expandInPrint: false,
    });
  }

  supportingItems.push({
    id: "disclaimer",
    title: "Clinical disclaimer",
    body: stripInternalIdsFromPatientText(normalized.clinicalDisclaimer),
    expandInPrint: true,
  });

  sections.push({
    type: "disclosure",
    id: "supporting_detail",
    navLabel: "Supporting detail",
    title: "Supporting evidence",
    subtitle: "Secondary detail — expand if you want more context.",
    defaultCollapsed: true,
    items: supportingItems,
  });

  sections.push({
    type: "disclosure",
    id: "methodology",
    navLabel: "Supporting detail",
    title: "Methodology and report record",
    defaultCollapsed: true,
    items: [
      {
        id: "methodology",
        title: "How this review was produced",
        body: [
          "This Post-Surgery Audit uses submitted photographs, questionnaire answers, and independent procedural review.",
          `Primary outcome: ${outcomeTitle}.`,
          `Repair consideration: ${POST_SURGERY_REPAIR_LABELS[normalized.repairId]}.`,
          "HairAudit provides independent review support and does not replace clinical examination or urgent medical care.",
          "Internal identifiers are not shown in this patient report.",
        ].join(" "),
        expandInPrint: true,
      },
    ],
  });

  const statusItems = [
    {
      id: "procedure_stage",
      label: "Procedure stage",
      value: timing.stageLabel,
      tone: timing.timingKnown ? ("info" as const) : ("unavailable" as const),
    },
    {
      id: "evidence",
      label: "Evidence",
      value: patientSafeEvidenceSuitabilityLabel(evidenceOk),
      tone: evidenceOk ? ("compatible" as const) : ("unavailable" as const),
    },
    {
      id: "next_action",
      label: "Next step",
      value: nextAction.value,
      tone: nextAction.tone,
    },
  ];

  const vm: PatientReportViewModel = {
    reportType: "post_surgery",
    reportTitle: "Post-Surgery Audit",
    reportSubtitle: "Independent case review",
    caseStatus: input.statusLabel,
    reportDate: input.reportDate ?? normalized.generatedAt ?? undefined,
    procedureDate: timing.procedureDate ?? undefined,
    reportReference: null,
    backHref: input.backHref ?? "/dashboard/patient",
    downloadHref: input.downloadHref,
    summary: {
      label: "Post-Surgery Audit Summary",
      title: outcomeTitle,
      narrative: stripInternalIdsFromPatientText(normalized.plainEnglishSummary),
      tone,
      reviewStatusLabel: null,
    },
    statusItems,
    sections,
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
              id: "download" as const,
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
      reportType: "post_surgery",
      pathway: "post_surgery",
      entryContext:
        input.entryContext ??
        (input.fallbackReason === "missing_donor_orientation"
          ? "donor_healing"
          : input.fallbackReason === "legacy_post_surgery"
            ? undefined
            : "post_surgery"),
    },
  };

  return buildPatientReportViewModel(vm);
}
