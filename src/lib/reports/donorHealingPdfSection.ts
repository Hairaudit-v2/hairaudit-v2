/**
 * HA-PATIENT-REPORT-UI-1A.2 — donor orientation block for Post-Surgery PDF HTML.
 * Snapshot-safe: renders the patient-safe orientation slice only (no provenance history,
 * actor IDs, or auditor controls).
 */

import type { PatientSafeDonorOrientationSlice } from "@/lib/patient/donorHealingOrientationReport";
import type { DonorHealingOrientation } from "@/lib/patient/donorHealingEntry";
import {
  DONOR_EVIDENCE_LIMITATIONS,
  DONOR_PDF_LIMITATIONS_TITLE,
  DONOR_PDF_ORIENTATION_SECTION_TITLE,
  DONOR_PDF_STATUS_EVIDENCE,
  DONOR_PDF_STATUS_HEALING_STAGE,
  DONOR_PDF_STATUS_NEXT_STEP,
} from "@/lib/patientReport/donorPatientCopy";
import {
  patientSafeEvidenceSuitabilityLabel,
  patientSafeHealingStageLabel,
  patientSafeNextActionCategory,
} from "@/lib/patientReport/healingStageLabels";

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export type DonorHealingPdfSectionInput = {
  orientation: PatientSafeDonorOrientationSlice;
  /** Optional months_since band from intake — improves healing-stage label. */
  monthsSinceBand?: string | null;
};

/** CSS scoped to donor PDF orientation / limitations blocks. */
export const DONOR_HEALING_PDF_SECTION_CSS = `
    .donorOrientationSection {
      border-color: #bfdbfe;
      background: linear-gradient(180deg, #eff6ff 0%, #ffffff 55%);
    }
    .donorOrientationSection .donorOrientLabel {
      margin: 0;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #1d4ed8;
    }
    .donorOrientationSection .donorOrientTitle {
      margin: 6px 0 0;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #0f172a;
    }
    .donorOrientationSection .donorOrientNarrative {
      margin: 10px 0 0;
      font-size: 12px;
      line-height: 1.55;
      color: #334155;
    }
    .donorOrientationSection .donorOrientEscalation {
      margin: 12px 0 0;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #fca5a5;
      background: #fef2f2;
      color: #7f1d1d;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.45;
    }
    .donorStatusStrip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-top: 14px;
    }
    .donorStatusItem {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #ffffff;
      padding: 8px 10px;
    }
    .donorStatusItem .k {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
    }
    .donorStatusItem .v {
      margin-top: 4px;
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.35;
    }
    .donorLimitationsSection {
      border-color: #e2e8f0;
      background: #f8fafc;
    }
    .donorLimitationsSection ul {
      margin: 10px 0 0;
      padding-left: 18px;
      font-size: 11px;
      color: #334155;
      line-height: 1.5;
    }
    .donorLimitationsSection li { margin-bottom: 4px; }
    .donorReviewStatus {
      margin-top: 10px;
      font-size: 10px;
      color: #64748b;
    }
    @media print {
      .donorOrientationSection, .donorLimitationsSection { break-inside: avoid; }
    }
`;

/**
 * Renders patient-safe donor orientation + status strip + evidence limitations.
 * Returns empty string when orientation is absent.
 */
export function renderDonorHealingPdfSectionHtml(input: DonorHealingPdfSectionInput): string {
  const { orientation, monthsSinceBand } = input;
  const stageLabel = patientSafeHealingStageLabel(monthsSinceBand, orientation.stageGroup);
  const evidenceLabel = patientSafeEvidenceSuitabilityLabel(orientation.evidenceSufficient);
  const nextAction = patientSafeNextActionCategory(orientation.state as DonorHealingOrientation);
  const reviewStatus =
    orientation.provenanceSource === "clinician_confirmation"
      ? "Reviewed and confirmed"
      : orientation.provenanceSource === "clinician_correction"
        ? "Reviewed and corrected"
        : null;

  const escalationHtml = orientation.escalationCopy
    ? `<p class="donorOrientEscalation" data-testid="pdf-donor-escalation">${esc(
        orientation.escalationCopy
      )}</p>`
    : "";

  const limitationsItems = DONOR_EVIDENCE_LIMITATIONS.map(
    (line) => `<li>${esc(line)}</li>`
  ).join("");

  return `
    <div class="section donorOrientationSection" data-testid="pdf-donor-orientation">
      <p class="donorOrientLabel">${esc(DONOR_PDF_ORIENTATION_SECTION_TITLE)}</p>
      <h2 class="donorOrientTitle">${esc(orientation.label)}</h2>
      <p class="donorOrientNarrative">${esc(orientation.stageAwareNarrative)}</p>
      ${escalationHtml}
      <div class="donorStatusStrip" data-testid="pdf-donor-status-strip">
        <div class="donorStatusItem">
          <div class="k">${esc(DONOR_PDF_STATUS_HEALING_STAGE)}</div>
          <div class="v">${esc(stageLabel)}</div>
        </div>
        <div class="donorStatusItem">
          <div class="k">${esc(DONOR_PDF_STATUS_EVIDENCE)}</div>
          <div class="v">${esc(evidenceLabel)}</div>
        </div>
        <div class="donorStatusItem">
          <div class="k">${esc(DONOR_PDF_STATUS_NEXT_STEP)}</div>
          <div class="v">${esc(nextAction.value)}</div>
        </div>
      </div>
      ${
        reviewStatus
          ? `<p class="donorReviewStatus">${esc(reviewStatus)}</p>`
          : ""
      }
    </div>
    <div class="section donorLimitationsSection" data-testid="pdf-donor-limitations">
      <div class="sectionHead"><h2>${esc(DONOR_PDF_LIMITATIONS_TITLE)}</h2></div>
      <ul>${limitationsItems}</ul>
    </div>`;
}
