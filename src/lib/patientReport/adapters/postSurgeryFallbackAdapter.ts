/**
 * HA-PATIENT-REPORT-UI-1A — Fallback adapter for post-surgery reports
 * without donor orientation (legacy / non-donor pathway).
 */

import type { PostSurgeryAuditReport } from "@/lib/reports/postSurgeryAuditReport";
import { buildPatientReportViewModel } from "@/lib/patientReport/buildPatientReportViewModel";
import { groupUploadsIntoPatientReportPhotos } from "@/lib/patientReport/photoGrouping";
import type { PatientReportViewModel } from "@/lib/patientReport/types";

export type PostSurgeryFallbackInput = {
  report: PostSurgeryAuditReport;
  statusLabel?: string;
  reportDate?: string | null;
  procedureDate?: string | null;
  backHref?: string;
  downloadHref?: string;
  uploads?: Array<{
    id?: string;
    type?: string | null;
    storage_path?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  reason?: "missing_donor_orientation" | "legacy_post_surgery";
};

const FALLBACK_LIMITATIONS = [
  "Photographs and questionnaire answers support orientation only — they are not a diagnosis.",
  "Lighting, hair length, angle, and image quality affect interpretation.",
  "Some conclusions require in-person examination.",
  "HairAudit does not replace urgent medical care.",
] as const;

/**
 * Safe fallback when donor orientation is absent.
 * Renders the existing post-surgery summary through the canonical shell contract.
 */
export function buildPostSurgeryFallbackViewModel(
  input: PostSurgeryFallbackInput
): PatientReportViewModel {
  const outcomeTitle = input.report.proceduralOutcomeId.replaceAll("_", " ");
  const photoGroups = groupUploadsIntoPatientReportPhotos(input.uploads ?? []);
  const summaryText =
    input.report.patientSafeSummary.plainEnglishSummary?.trim() ||
    input.report.sections.find((s) => s.id === "overall_procedure")?.finding ||
    "Your Post-Surgery Audit summary is ready for review.";

  const vm: PatientReportViewModel = {
    reportType: "post_surgery",
    reportTitle: "Post-Surgery Audit",
    reportSubtitle: "Independent case review",
    caseStatus: input.statusLabel,
    reportDate: input.reportDate ?? input.report.generatedAt ?? undefined,
    procedureDate: input.procedureDate ?? undefined,
    reportReference: null,
    backHref: input.backHref ?? "/dashboard/patient",
    downloadHref: input.downloadHref,
    summary: {
      label: "Procedural outcome",
      title: outcomeTitle.replace(/\b\w/g, (c) => c.toUpperCase()),
      narrative: summaryText,
      tone: "info",
      reviewStatusLabel: null,
    },
    statusItems: [
      {
        id: "status",
        label: "Report status",
        value: input.statusLabel ?? "Complete",
        tone: "info",
      },
      {
        id: "pathway",
        label: "Pathway",
        value: "Post-surgery review",
        tone: "info",
      },
    ],
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
          photographsSupport: [
            summaryText,
            ...input.report.sections.slice(0, 2).map((s) => s.finding).filter(Boolean),
          ].slice(0, 3),
          remainsUncertain: [
            "Exact measurements and permanent outcomes may require in-person examination.",
            "Photograph quality and timing affect interpretation.",
          ],
          recommendedNextStep:
            input.report.recommendedNextSteps[0] ??
            "Discuss this summary with your treating clinic.",
        },
      },
      ...(photoGroups.length > 0
        ? [
            {
              type: "photos" as const,
              id: "photographs",
              navLabel: "Photographs",
              title: "Photographic evidence",
              groups: photoGroups,
            },
          ]
        : []),
      {
        type: "findings",
        id: "findings",
        navLabel: "Findings",
        title: "Key findings",
        rows: input.report.sections.slice(0, 6).map((s) => ({
          domain: s.id.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          observation: s.finding,
          evidenceStrength: "moderate" as const,
        })),
      },
      {
        type: "limitations",
        id: "limitations",
        navLabel: "Limitations",
        title: "Evidence limitations",
        items: [...FALLBACK_LIMITATIONS],
      },
      {
        type: "recommendations",
        id: "next_steps",
        navLabel: "Next steps",
        title: "Recommended next steps",
        steps: input.report.recommendedNextSteps.slice(0, 6).map((label, i) => ({
          id: `step_${i}`,
          label,
          analyticsKey: `step_${i}`,
        })),
      },
      {
        type: "disclosure",
        id: "supporting_detail",
        navLabel: "Supporting detail",
        title: "Supporting detail",
        defaultCollapsed: true,
        items: [
          {
            id: "disclaimer",
            title: "Clinical disclaimer",
            body: input.report.patientSafeSummary.clinicalDisclaimer,
            expandInPrint: true,
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
            },
          ]
        : []),
      { id: "print", kind: "print" as const, label: "Print" },
    ],
    disclosures: [
      {
        id: "urgent_care",
        title: "Important",
        body: "HairAudit does not replace urgent medical care.",
        alwaysVisible: true,
        expandInPrint: true,
      },
    ],
    analytics: {
      reportType: "post_surgery",
      pathway: "post_surgery",
      entryContext: input.reason === "missing_donor_orientation" ? "donor_healing" : undefined,
    },
  };

  return buildPatientReportViewModel(vm);
}
