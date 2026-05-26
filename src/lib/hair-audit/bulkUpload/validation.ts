import type { BulkCaseReadiness } from "./types";
import type { BulkIntakeStatus } from "./constants";

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function computeCaseReadiness(
  caseRow: {
    patient_reference?: string | null;
    graft_count?: number | null;
  },
  imageCount: number
): BulkCaseReadiness {
  const missingFields: string[] = [];

  if (!hasText(caseRow.patient_reference)) {
    missingFields.push("Patient name or initials");
  }
  if (caseRow.graft_count == null || caseRow.graft_count <= 0) {
    missingFields.push("Graft count");
  }
  if (imageCount < 1) {
    missingFields.push("At least one image");
  }

  let intakeStatus: BulkIntakeStatus = "draft";
  if (missingFields.length === 0) {
    intakeStatus = "ready_for_audit";
  } else if (hasText(caseRow.patient_reference) || caseRow.graft_count != null || imageCount > 0) {
    intakeStatus = "incomplete";
  }

  return {
    intakeStatus,
    isReady: missingFields.length === 0,
    missingFields,
    imageCount,
  };
}
