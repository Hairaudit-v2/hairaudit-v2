/**
 * HA-PATIENT-REPORT-UI-1A — View-model validation helpers.
 */

import type {
  PatientReportSection,
  PatientReportType,
  PatientReportViewModel,
} from "@/lib/patientReport/types";

const REPORT_TYPES: readonly PatientReportType[] = [
  "pre_surgery",
  "post_surgery",
  "donor_healing",
  "projection",
  "longitudinal",
] as const;

const INTERNAL_ID_PATTERNS = [
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  /\bsnapshot[_-]?id\b/i,
  /\bprovenance[_-]?id\b/i,
  /\borientation[_-]?id\b/i,
  /\bevent[_-]?id\b/i,
  /\buser[_-]?id\b/i,
  /\bactorUserId\b/i,
  /\bstorage_path\b/i,
];

export function isPatientReportType(value: unknown): value is PatientReportType {
  return typeof value === "string" && (REPORT_TYPES as readonly string[]).includes(value);
}

export function assertPatientReportViewModel(
  value: unknown
): asserts value is PatientReportViewModel {
  if (!value || typeof value !== "object") {
    throw new Error("PatientReportViewModel must be an object");
  }
  const vm = value as PatientReportViewModel;
  if (!isPatientReportType(vm.reportType)) {
    throw new Error("PatientReportViewModel.reportType is invalid");
  }
  if (typeof vm.reportTitle !== "string" || !vm.reportTitle.trim()) {
    throw new Error("PatientReportViewModel.reportTitle is required");
  }
  if (!vm.summary || typeof vm.summary.title !== "string") {
    throw new Error("PatientReportViewModel.summary is required");
  }
  if (!Array.isArray(vm.statusItems)) {
    throw new Error("PatientReportViewModel.statusItems must be an array");
  }
  if (!Array.isArray(vm.sections)) {
    throw new Error("PatientReportViewModel.sections must be an array");
  }
  if (!Array.isArray(vm.actions)) {
    throw new Error("PatientReportViewModel.actions must be an array");
  }
  if (!Array.isArray(vm.disclosures)) {
    throw new Error("PatientReportViewModel.disclosures must be an array");
  }
}

/** Canonical donor-healing section order (ids). */
export const DONOR_HEALING_SECTION_ORDER = [
  "orientation",
  "what_this_means",
  "photographs",
  "findings",
  "healing_stage",
  "limitations",
  "next_steps",
  "supporting_detail",
  "methodology",
] as const;

export function sectionIdsInOrder(sections: PatientReportSection[]): string[] {
  return sections.map((s) => s.id);
}

export function validateDonorHealingSectionOrder(sections: PatientReportSection[]): boolean {
  const ids = sectionIdsInOrder(sections);
  let cursor = 0;
  for (const expected of DONOR_HEALING_SECTION_ORDER) {
    const idx = ids.indexOf(expected);
    if (idx === -1) continue;
    if (idx < cursor) return false;
    cursor = idx;
  }
  return true;
}

/**
 * Scan patient-visible strings for internal IDs / provenance keys.
 * Returns matching snippets (empty = clean).
 */
export function findInternalIdLeaks(vm: PatientReportViewModel): string[] {
  const leaks: string[] = [];
  const visit = (text: string | null | undefined, path: string) => {
    if (!text) return;
    for (const pattern of INTERNAL_ID_PATTERNS) {
      if (pattern.test(text)) {
        leaks.push(`${path}: ${text.slice(0, 120)}`);
        break;
      }
    }
  };

  visit(vm.reportTitle, "reportTitle");
  visit(vm.reportSubtitle, "reportSubtitle");
  visit(vm.reportReference, "reportReference");
  visit(vm.summary.label, "summary.label");
  visit(vm.summary.title, "summary.title");
  visit(vm.summary.narrative, "summary.narrative");
  visit(vm.summary.escalationCopy, "summary.escalationCopy");
  visit(vm.summary.reviewStatusLabel, "summary.reviewStatusLabel");

  for (const item of vm.statusItems) {
    visit(item.label, `status.${item.id}.label`);
    visit(item.value, `status.${item.id}.value`);
  }

  for (const section of vm.sections) {
    if (section.type === "narrative") {
      visit(section.title, `${section.id}.title`);
      for (const line of section.whatThisMeans.photographsSupport) {
        visit(line, `${section.id}.support`);
      }
      for (const line of section.whatThisMeans.remainsUncertain) {
        visit(line, `${section.id}.uncertain`);
      }
      visit(section.whatThisMeans.recommendedNextStep, `${section.id}.next`);
    }
    if (section.type === "findings") {
      for (const row of section.rows) {
        visit(row.domain, `${section.id}.domain`);
        visit(row.observation, `${section.id}.observation`);
      }
    }
    if (section.type === "photos") {
      for (const group of section.groups) {
        for (const photo of group.photos) {
          visit(photo.label, `${section.id}.photo.label`);
          visit(photo.alt, `${section.id}.photo.alt`);
          // fetchKey is intentionally not patient-visible; do not flag it.
        }
      }
    }
    if (section.type === "timeline") {
      for (const item of section.items) {
        visit(item.title, `${section.id}.timeline.title`);
        visit(item.body, `${section.id}.timeline.body`);
      }
    }
    if (section.type === "limitations") {
      for (const item of section.items) visit(item, `${section.id}.limitation`);
    }
    if (section.type === "recommendations") {
      for (const step of section.steps) visit(step.label, `${section.id}.step`);
    }
    if (section.type === "disclosure") {
      for (const item of section.items) {
        visit(item.title, `${section.id}.disclosure.title`);
        visit(item.body, `${section.id}.disclosure.body`);
      }
    }
  }

  for (const d of vm.disclosures) {
    visit(d.title, `disclosure.${d.id}.title`);
    visit(d.body, `disclosure.${d.id}.body`);
  }

  return leaks;
}

export function buildPatientReportViewModel(
  input: PatientReportViewModel
): PatientReportViewModel {
  assertPatientReportViewModel(input);
  return input;
}
