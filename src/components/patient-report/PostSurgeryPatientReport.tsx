"use client";

import { useMemo } from "react";
import type { PostSurgeryAuditReport } from "@/lib/reports/postSurgeryAuditReport";
import { buildPostSurgeryAuditPatientReportViewModel } from "@/lib/patientReport/adapters/postSurgeryAuditReportAdapter";
import PatientReportShell from "@/components/patient-report/PatientReportShell";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Mount helper — builds the standard Post-Surgery Audit patient report VM and renders the shell.
 * Professional controls must never be passed into this tree.
 * Donor-healing cases must continue to use DonorHealingPatientReport instead.
 */
export default function PostSurgeryPatientReport({
  report,
  statusLabel,
  reportDate,
  procedureDate,
  monthsSinceBand,
  backHref,
  downloadHref,
  uploads = [],
  caseId,
}: {
  report: PostSurgeryAuditReport;
  statusLabel?: string;
  reportDate?: string | null;
  procedureDate?: string | null;
  monthsSinceBand?: string | null;
  backHref?: string;
  downloadHref?: string;
  uploads?: UploadRow[];
  caseId?: string;
}) {
  const model = useMemo(
    () =>
      buildPostSurgeryAuditPatientReportViewModel({
        report,
        statusLabel,
        reportDate,
        procedureDate,
        monthsSinceBand,
        backHref,
        downloadHref,
        uploads,
      }),
    [
      report,
      statusLabel,
      reportDate,
      procedureDate,
      monthsSinceBand,
      backHref,
      downloadHref,
      uploads,
    ]
  );

  return <PatientReportShell model={model} uploads={uploads} caseId={caseId} />;
}
