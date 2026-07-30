export type * from "@/lib/patientReport/types";
export {
  assertPatientReportViewModel,
  buildPatientReportViewModel,
  DONOR_HEALING_SECTION_ORDER,
  POST_SURGERY_SECTION_ORDER,
  findInternalIdLeaks,
  validateDonorHealingSectionOrder,
  validatePostSurgerySectionOrder,
} from "@/lib/patientReport/buildPatientReportViewModel";
export {
  buildDonorHealingPatientReportViewModel,
  type DonorHealingAdapterInput,
} from "@/lib/patientReport/adapters/donorHealingReportAdapter";
export {
  buildPostSurgeryAuditPatientReportViewModel,
  type BuildPostSurgeryAuditPatientReportInput,
} from "@/lib/patientReport/adapters/postSurgeryAuditReportAdapter";
export {
  buildPostSurgeryFallbackViewModel,
  type PostSurgeryFallbackInput,
} from "@/lib/patientReport/adapters/postSurgeryFallbackAdapter";
export {
  resolvePatientPostSurgeryReportMount,
  shouldMountDonorHealingPatientReport,
  shouldMountStandardPostSurgeryPatientReport,
  type PatientPostSurgeryReportMount,
  type PatientPostSurgeryReportMountKind,
} from "@/lib/patientReport/resolvePatientPostSurgeryReportMount";
export {
  normalizePostSurgeryFindings,
  normalizePostSurgeryPhotos,
  normalizePostSurgeryReportSnapshot,
  normalizePostSurgeryTiming,
  isEarlyPostSurgeryStage,
  stripInternalIdsFromPatientText,
} from "@/lib/patientReport/normalizePostSurgeryReport";
export {
  PATIENT_REPORT_UI_EVENTS,
  trackPatientReportUiEvent,
  buildPatientReportAnalyticsPayload,
  patientReportAnalyticsContainsForbiddenKeys,
} from "@/lib/patientReport/analytics";
