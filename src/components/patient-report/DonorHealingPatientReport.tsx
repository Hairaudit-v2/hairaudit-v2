"use client";

import { useMemo } from "react";
import type { PostSurgeryAuditReport } from "@/lib/reports/postSurgeryAuditReport";
import { buildDonorHealingPatientReportViewModel } from "@/lib/patientReport/adapters/donorHealingReportAdapter";
import PatientReportShell from "@/components/patient-report/PatientReportShell";

type UploadRow = {
  id: string;
  type: string;
  storage_path: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Mount helper — builds the donor-healing patient report VM and renders the shell.
 * Professional controls must never be passed into this tree.
 */
export default function DonorHealingPatientReport({
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
      buildDonorHealingPatientReportViewModel({
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
