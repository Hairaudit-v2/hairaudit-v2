import Link from "next/link";
import type { ReactNode } from "react";

import AuditorCaseSummaryHeader from "@/components/auditor/case-workflow/AuditorCaseSummaryHeader";
import AuditorAuditExecutionCenter from "@/components/auditor/case-workflow/AuditorAuditExecutionCenter";
import AuditorStickyActionBar from "@/components/auditor/case-workflow/AuditorStickyActionBar";
import AuditorTechnicalLogsSection from "@/components/auditor/case-workflow/AuditorTechnicalLogsSection";
import CaseClinicalHistoryPanel from "@/components/hairaudit/admin/CaseClinicalHistoryPanel";
import AuditorPatientImageManager from "./AuditorPatientImageManager";
import PatientSafeSummaryTranslationOpsPanel from "./PatientSafeSummaryTranslationOpsPanel";
import AuditorRerunPanel from "./AuditorRerunPanel";
import ForensicCaseTimelineViewer from "@/components/reports/ForensicCaseTimelineViewer";
import HairAuditIntelligencePanel from "@/components/auditor/HairAuditIntelligencePanel";
import GraftIntegrityReviewPanel from "@/app/dashboard/auditor/GraftIntegrityReviewPanel";
import AuditorReviewPanel from "@/components/reports/AuditorReviewPanel";
import DomainIntelligenceAccordion from "@/components/reports/DomainIntelligenceAccordion";
import UnlockAuditorReviewButton from "./UnlockAuditorReviewButton";
import DoctorScoringNarrativeCard from "@/components/reports/DoctorScoringNarrativeCard";
import VersionHistoryDrawer from "@/components/reports/VersionHistoryDrawer";
import LatestReportCard from "@/components/reports/LatestReportCard";
import UploadThumbnailGallery from "@/components/reports/UploadThumbnailGallery";
import SurgeryUploadReviewPanel, {
  type SurgeryAuditIntakeView,
} from "@/components/surgery-upload/SurgeryUploadReviewPanel";
import BulkBatchInheritedMetadataPanel from "@/components/hair-audit/BulkBatchInheritedMetadataPanel";
import PatientImageEvidenceQualityPanel from "@/components/reports/PatientImageEvidenceQualityPanel";
import AuditOsShadowDebugPanel, {
  type AuditOsShadowDebugPanelPayload,
} from "@/components/auditor/AuditOsShadowDebugPanel";
import AuditOsReviewPanel, { type AuditOsReviewPanelProps } from "@/components/auditor/AuditOsReviewPanel";
import EvidenceSummary from "@/components/reports/EvidenceSummary";
import DoctorAnswersSummary from "@/components/reports/DoctorAnswersSummary";
import PatientAnswersSummary from "@/components/reports/PatientAnswersSummary";
import { BENCHMARKING_GLOBAL_STANDARDS } from "@/lib/benchmarkingCopy";
import { IMAGE_LIMITED_AUDIT_PATIENT_NOTICE } from "@/lib/patient/patientPhotoImageLimitedOverride";
import type { ClinicalHistorySnapshot } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";
import type { SurgeryUploadDetails } from "@/lib/surgeryUpload/fields";
import type { SurgerySlotReviewRow } from "@/lib/surgeryUpload/evidenceReview";
import type { EvidenceTimelineEvent } from "@/lib/surgeryUpload/evidenceEvents";
import type { HairAuditIntelligenceBundle } from "@/lib/hairaudit-intelligence/types";
import type { PatientSafeSummaryObservation } from "@/lib/reports/patientSafeSummary";

type DomainRow = {
  domain_id?: string;
  title?: string;
  weighted_score?: number;
  confidence?: number;
};

export type AuditorCasePageWorkflowProps = {
  caseId: string;
  caseRow: Record<string, unknown>;
  statusLabel: string;
  statusPillClass: string;
  patientName: string;
  clinicLabel: string;
  auditType: string;
  auditSource: string;
  submittedAt: string | null;
  auditStage: string | null;
  language: string;
  priorityScore: number | null;
  pathwayLabel: string;
  patientReviewPathway: "pre_surgery" | "post_surgery";
  clinicalHistorySnapshot: ClinicalHistorySnapshot | null;
  hasPatientImagesForImageLimited: boolean;
  missingPatientPhotoLabels: string[];
  hasClinicalHistoryForImageLimited: boolean;
  imagesSortedLabel: string;
  hasReportPdf: boolean;
  readyToRun: boolean;
  clinicalDataPresent: boolean;
  isAuditFailed: boolean;
  imageLimitedForensicNotice: boolean;
  forensicReports: Array<{
    id: string;
    version: number;
    pdf_path: string | null;
    summary?: unknown;
    created_at: string;
    status?: string;
  }>;
  latestReport: {
    id: string;
    version: number;
    pdf_path: string | null;
    summary?: unknown;
    created_at: string;
    status?: string;
    auditor_review_eligibility?: string;
    provisional_status?: string;
    counts_for_awards?: boolean;
  } | null;
  latestReportDisplayScore?: number;
  repErr: { message: string } | null;
  showAuditorReview: boolean;
  auditorReviewEligibility?: string;
  domains: DomainRow[];
  benchmark?: { eligible?: boolean; reasons?: string[] };
  overallScores?: {
    performance_score?: number;
    confidence_grade?: string;
    confidence_multiplier?: number;
    benchmark_score?: number;
  };
  provisionalStatus?: string;
  countsForAwards?: boolean;
  hairAuditIntelligenceBundle: HairAuditIntelligenceBundle | null;
  auditOsShadowDebug: AuditOsShadowDebugPanelPayload | null;
  auditOsReviewPanel: AuditOsReviewPanelProps | null;
  uploads: unknown[];
  graftIntegrityEstimate: unknown;
  procedureDate: string | null;
  monthsSinceSurgery: number | null;
  confidenceLabel: string;
  summaryObservations: PatientSafeSummaryObservation[];
  giiNotes: string | null;
  giiLimitations: string[];
  priorityEvidence: {
    preopDonor: number;
    postopDonor: number;
    postopRecipient: number;
    graftTrayCloseup: number;
    followup: number;
  };
  changedFieldsOnly: string[];
  completenessScoreNum: number | null;
  evidenceScoreNum: number | null;
  confidenceEstimateNum: number | null;
  technicalDataSufficiency: string;
  manualAuditReadinessScore: number | null;
  missingCriticalEvidenceFlags: string[];
  evidenceCoverageDashboardPct: number | null;
  patientImageEvidenceQuality: ReturnType<
    typeof import("@/lib/audit/patientImageEvidenceConfidence").computePatientImageEvidenceQualityFromCaseUploads
  > | null;
  surgeryUploadDetails: SurgeryUploadDetails | null;
  surgerySlotReviews: SurgerySlotReviewRow[];
  surgeryEvidenceEvents: EvidenceTimelineEvent[];
  surgeryPhotoExportHistory: Awaited<
    ReturnType<typeof import("@/lib/surgeryUpload/photoExportHistory").loadPhotoExportHistory>
  >;
  surgeryAuditIntakeView: SurgeryAuditIntakeView | null;
  surgeryEvidenceReportPdfPath: string | null;
  evidenceReportRequestedByLabel: string | null;
  canExportSurgeryPhotoPack: boolean;
  bulkBatchContext: Awaited<
    ReturnType<typeof import("@/lib/hair-audit/bulkUpload/loadBulkBatchContext").loadBulkBatchContext>
  > | null;
  caseLabel: string | null;
  showAuditor: boolean;
  doctorAnswersBlock: ReactNode;
  clinicAnswersBlock: ReactNode;
  scoringBlock: ReactNode;
  patientAnswersBlock: ReactNode;
  manualAuditBanner: ReactNode;
};

function WorkflowSection({
  title,
  subtitle,
  prominent = false,
  children,
}: {
  title: string;
  subtitle?: string;
  prominent?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={
        prominent
          ? "space-y-4"
          : "rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4"
      }
    >
      <header>
        <h2 className={`font-semibold text-white ${prominent ? "text-lg" : "text-base"}`}>{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

export default function AuditorCasePageWorkflow(props: AuditorCasePageWorkflowProps) {
  const latestForensic = props.forensicReports[0];
  const hasForensicReport = props.forensicReports.length > 0;

  return (
    <div className="mt-4 space-y-6 pb-28 lg:pb-24">
      {props.bulkBatchContext ? (
        <BulkBatchInheritedMetadataPanel
          display={props.bulkBatchContext.display}
          caseLabel={props.caseLabel}
          variant="dark"
          showAdminLink
        />
      ) : null}

      <AuditorCaseSummaryHeader
        patientName={props.patientName}
        caseId={props.caseId}
        auditType={props.auditType}
        statusLabel={props.statusLabel}
        statusPillClass={props.statusPillClass}
        submittedAt={props.submittedAt}
        auditStage={props.auditStage}
        language={props.language}
        priorityScore={props.priorityScore}
        pathwayLabel={props.pathwayLabel}
        clinicLabel={props.clinicLabel}
        bulkBatchLabel={props.bulkBatchContext?.batch.batch_name ?? null}
      />

      <CaseClinicalHistoryPanel
        caseId={props.caseId}
        initialSnapshot={props.clinicalHistorySnapshot}
        hasPatientImages={props.hasPatientImagesForImageLimited}
        photosMissing={props.missingPatientPhotoLabels.length > 0}
        workflowLayout
      />

      <AuditorPatientImageManager
        caseId={props.caseId}
        patientReviewPathway={props.patientReviewPathway}
        workflowLayout
      />

      {hasForensicReport ? (
        <AuditorAuditExecutionCenter
          caseId={props.caseId}
          caseStatus={String(props.caseRow.status ?? "draft")}
          submittedAt={props.submittedAt}
          reportId={latestForensic?.id}
          latestReportVersion={latestForensic?.version}
          hasPdfPath={Boolean(latestForensic?.pdf_path)}
          isAuditFailed={props.isAuditFailed}
          canImageLimitedRegenerate={
            props.hasPatientImagesForImageLimited || props.hasClinicalHistoryForImageLimited
          }
          photosMissing={props.missingPatientPhotoLabels.length > 0}
          missingPhotoLabels={props.missingPatientPhotoLabels}
        />
      ) : (
        <AuditorAuditExecutionCenter
          caseId={props.caseId}
          caseStatus={String(props.caseRow.status ?? "draft")}
          submittedAt={props.submittedAt}
          isAuditFailed={props.isAuditFailed}
          canImageLimitedRegenerate={
            props.hasPatientImagesForImageLimited || props.hasClinicalHistoryForImageLimited
          }
          photosMissing={props.missingPatientPhotoLabels.length > 0}
          missingPhotoLabels={props.missingPatientPhotoLabels}
        />
      )}

      {props.manualAuditBanner}

      <WorkflowSection
        title="AI ANALYSIS REVIEW"
        subtitle="Forensic AI observations, confidence, diagnostics, and domain intelligence — review after audit execution."
      >
        <ForensicCaseTimelineViewer
          caseId={props.caseId}
          auditType={props.auditType}
          procedureDate={props.procedureDate}
          monthsSinceSurgery={props.monthsSinceSurgery}
          confidenceLabel={props.confidenceLabel}
          uploads={
            props.uploads as Array<{ id: string; type: string; storage_path: string; created_at?: string }>
          }
          giiNotes={props.giiNotes}
          giiLimitations={props.giiLimitations}
          aiObservations={props.summaryObservations}
        />

        {props.hairAuditIntelligenceBundle ? (
          <HairAuditIntelligencePanel
            bundle={props.hairAuditIntelligenceBundle}
            reportVersion={props.latestReport?.version}
          />
        ) : null}

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <h3 className="font-semibold text-white mb-4">Graft Integrity Review</h3>
          <GraftIntegrityReviewPanel
            cases={[props.caseRow] as never[]}
            initialEstimates={
              props.graftIntegrityEstimate ? [props.graftIntegrityEstimate as never] : []
            }
            emptyMessage="No Graft Integrity estimate generated yet for this case."
          />
        </div>

        {props.domains.length > 0 ? (
          <div>
            {props.showAuditorReview && props.latestReport ? (
              <>
                {props.auditorReviewEligibility === "eligible_low_score" && (
                  <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-950/40 px-4 py-3">
                    <p className="text-sm font-medium text-amber-100">
                      Extreme-score review available: scored below 60.
                    </p>
                  </div>
                )}
                {props.auditorReviewEligibility === "eligible_high_score" && (
                  <div className="mb-4 rounded-xl border border-emerald-300/40 bg-emerald-950/40 px-4 py-3">
                    <p className="text-sm font-medium text-emerald-100">
                      Recognition-band review available: scored above 90.
                    </p>
                  </div>
                )}
                <AuditorReviewPanel
                  caseId={props.caseId}
                  reportId={props.latestReport.id}
                  domains={props.domains as never[]}
                  benchmark={props.benchmark}
                  overallScores={props.overallScores}
                  provisionalStatus={props.provisionalStatus}
                  countsForAwards={props.countsForAwards}
                />
              </>
            ) : (
              <>
                <DomainIntelligenceAccordion domains={props.domains as never[]} />
                {props.latestReport && !props.showAuditorReview ? (
                  <div className="mt-4">
                    <UnlockAuditorReviewButton reportId={props.latestReport.id} />
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {props.scoringBlock}
        {props.doctorAnswersBlock}
        {props.clinicAnswersBlock}
        {props.patientAnswersBlock}
      </WorkflowSection>

      <WorkflowSection title="PATIENT REPORT OUTPUT" subtitle="Report summary, PDF status, and patient-safe preview.">
        {props.imageLimitedForensicNotice ? (
          <div className="rounded-xl border border-amber-300/40 bg-amber-950/40 px-4 py-3">
            <p className="text-sm font-medium text-amber-100">Image-limited audit report</p>
            <p className="mt-1 text-xs text-amber-100/80">{IMAGE_LIMITED_AUDIT_PATIENT_NOTICE}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">{BENCHMARKING_GLOBAL_STANDARDS}</p>
          {props.forensicReports.length > 0 ? <VersionHistoryDrawer reports={props.forensicReports} /> : null}
        </div>
        {props.repErr ? <p className="text-sm text-rose-300">{props.repErr.message}</p> : null}
        <LatestReportCard
          report={props.latestReport}
          caseId={props.caseId}
          displayScore={props.latestReportDisplayScore}
        />
        {props.latestReport ? (
          <PatientSafeSummaryTranslationOpsPanel caseId={props.caseId} locale={props.language} />
        ) : null}
      </WorkflowSection>

      <WorkflowSection
        title="SUPPORTING EVIDENCE"
        subtitle="Uploaded PDFs, surgical reports, and additional uploads — reference after image review."
      >
        {props.surgeryUploadDetails ? (
          <SurgeryUploadReviewPanel
            details={props.surgeryUploadDetails}
            uploads={props.uploads as never[]}
            caseId={props.caseId}
            isAuditor={props.showAuditor}
            canExportPhotoPack={props.canExportSurgeryPhotoPack}
            initialSlotReviews={props.surgerySlotReviews}
            evidenceEvents={props.surgeryEvidenceEvents}
            auditIntake={props.surgeryAuditIntakeView}
            evidenceReportPdfPath={props.surgeryEvidenceReportPdfPath}
            evidenceReportRequestedByLabel={props.evidenceReportRequestedByLabel}
            photoExportHistory={props.surgeryPhotoExportHistory}
          />
        ) : null}
        <UploadThumbnailGallery
          caseId={props.caseId}
          uploads={props.uploads as never[]}
          displayMode="auditor"
        />
        <EvidenceSummary caseRow={props.caseRow as never} uploads={props.uploads as never[]} />
      </WorkflowSection>

      <AuditorTechnicalLogsSection>
        {hasForensicReport ? (
          <AuditorRerunPanel caseId={props.caseId} latestReportVersion={latestForensic?.version} />
        ) : null}
        {props.auditOsShadowDebug ? <AuditOsShadowDebugPanel debug={props.auditOsShadowDebug} /> : null}
        {props.auditOsReviewPanel ? <AuditOsReviewPanel {...props.auditOsReviewPanel} /> : null}
        {props.patientImageEvidenceQuality ? (
          <PatientImageEvidenceQualityPanel result={props.patientImageEvidenceQuality} />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="text-sm font-semibold text-slate-200">Evidence priority</h3>
            <dl className="mt-3 space-y-2 text-sm text-slate-300">
              <div className="flex justify-between"><dt>Pre-op donor</dt><dd>{props.priorityEvidence.preopDonor}</dd></div>
              <div className="flex justify-between"><dt>Post-op donor</dt><dd>{props.priorityEvidence.postopDonor}</dd></div>
              <div className="flex justify-between"><dt>Post-op recipient</dt><dd>{props.priorityEvidence.postopRecipient}</dd></div>
              <div className="flex justify-between"><dt>Graft tray</dt><dd>{props.priorityEvidence.graftTrayCloseup}</dd></div>
              <div className="flex justify-between"><dt>Follow-up</dt><dd>{props.priorityEvidence.followup}</dd></div>
            </dl>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="text-sm font-semibold text-slate-200">Follow-up delta</h3>
            <p className="mt-2 text-sm text-slate-300">Changed fields: {props.changedFieldsOnly.length}</p>
            {props.changedFieldsOnly.length > 0 ? (
              <div className="mt-2 max-h-32 overflow-y-auto text-xs text-slate-400">
                {props.changedFieldsOnly.map((field) => (
                  <div key={field} className="border-b border-slate-800 py-1">{field}</div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No field deltas between report versions.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Intelligence diagnostics</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs text-slate-300">
            <div>Completeness: {props.completenessScoreNum ?? "N/A"}</div>
            <div>Evidence score: {props.evidenceScoreNum ?? "N/A"}</div>
            <div>Data sufficiency: {props.technicalDataSufficiency}</div>
            <div>Readiness: {props.manualAuditReadinessScore ?? "N/A"}</div>
            <div>
              Confidence:{" "}
              {props.confidenceEstimateNum != null
                ? `${props.confidenceEstimateNum}%`
                : props.confidenceLabel}
            </div>
            <div>
              Evidence coverage:{" "}
              {props.evidenceCoverageDashboardPct != null
                ? `${props.evidenceCoverageDashboardPct}%`
                : "N/A"}
            </div>
            <div className="sm:col-span-2">
              Missing flags:{" "}
              {props.missingCriticalEvidenceFlags.length
                ? props.missingCriticalEvidenceFlags.join(", ")
                : "none"}
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Contribution paths</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <Link
              href={`/cases/${props.caseId}/patient/questions`}
              className="rounded-lg border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-center text-xs font-semibold text-cyan-100"
            >
              Patient questions
            </Link>
            <Link
              href={`/cases/${props.caseId}/doctor/form`}
              className="rounded-lg border border-blue-300/35 bg-blue-300/10 px-3 py-2 text-center text-xs font-semibold text-blue-100"
            >
              Doctor form
            </Link>
            <Link
              href={`/cases/${props.caseId}/clinic/form`}
              className="rounded-lg border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-center text-xs font-semibold text-emerald-100"
            >
              Clinic form
            </Link>
          </div>
        </section>
      </AuditorTechnicalLogsSection>

      <AuditorStickyActionBar
        caseId={props.caseId}
        caseStatus={String(props.caseRow.status ?? "draft")}
        submittedAt={props.submittedAt}
        statusLabel={props.statusLabel}
        clinicalDataPresent={props.clinicalDataPresent}
        imagesSortedLabel={props.imagesSortedLabel}
        pdfUploaded={props.hasReportPdf}
        readyToRun={props.readyToRun}
      />
    </div>
  );
}
