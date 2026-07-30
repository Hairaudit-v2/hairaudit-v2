/**
 * HA-PATIENT-REPORT-UI-1A — Canonical patient-facing report view model.
 * UI consumes adapters; clinical engines and orientation mapping stay upstream.
 */

export type PatientReportType =
  | "pre_surgery"
  | "post_surgery"
  | "donor_healing"
  | "projection"
  | "longitudinal";

export type PatientReportSemanticTone =
  | "compatible"
  | "uncertain"
  | "clinical"
  | "info"
  | "unavailable";

export type PatientReportSummary = {
  label: string;
  title: string;
  narrative: string;
  escalationCopy?: string | null;
  tone: PatientReportSemanticTone;
  /** Patient-safe confirmation statement when clinician-reviewed. */
  reviewStatusLabel?: string | null;
};

export type PatientReportStatusItem = {
  id: string;
  label: string;
  value: string;
  tone?: PatientReportSemanticTone;
};

export type PatientReportAction = {
  id: string;
  kind: "print" | "download" | "back" | "next_step" | "custom";
  label: string;
  href?: string;
  /** Opaque action token for analytics — never PHI. */
  analyticsKey?: string;
};

export type PatientReportDisclosureItem = {
  id: string;
  title: string;
  body: string;
  /** When true, remains visible even when collapsed groups hide secondary detail. */
  alwaysVisible?: boolean;
  /** Expand by default in print media. */
  expandInPrint?: boolean;
};

export type PatientReportPhotoRole =
  | "donor_rear"
  | "donor_left"
  | "donor_right"
  | "close_up"
  | "pre_surgery"
  | "surgery_day"
  | "follow_up"
  | "recipient"
  | "additional";

export type PatientReportPhotoGroupId =
  | "rear_donor"
  | "left_donor"
  | "right_donor"
  | "additional_evidence";

export type PatientReportPhoto = {
  role: PatientReportPhotoRole;
  label: string;
  alt: string;
  dateLabel?: string;
  evidenceQualityLabel?: string;
  groupId: PatientReportPhotoGroupId;
  /**
   * Opaque client key for signed-URL resolution.
   * Never rendered in patient-facing copy.
   */
  fetchKey?: string;
  imageUrl?: string | null;
};

export type PatientReportPhotoGroup = {
  id: PatientReportPhotoGroupId;
  title: string;
  photos: PatientReportPhoto[];
};

export type PatientReportFindingEvidenceStrength = "high" | "moderate" | "limited";

export type PatientReportFindingRow = {
  domain: string;
  observation: string;
  evidenceStrength: PatientReportFindingEvidenceStrength;
};

export type PatientReportTimelineItem = {
  id: string;
  title: string;
  body: string;
  emphasis?: boolean;
};

export type PatientReportWhatThisMeans = {
  photographsSupport: string[];
  remainsUncertain: string[];
  recommendedNextStep: string;
};

export type PatientReportOrientationSection = {
  type: "orientation";
  id: string;
  navLabel: string;
  /** Rendered via summary + status strip; kept for section ordering. */
};

export type PatientReportNarrativeSection = {
  type: "narrative";
  id: string;
  navLabel: string;
  title: string;
  whatThisMeans: PatientReportWhatThisMeans;
};

export type PatientReportFindingsSection = {
  type: "findings";
  id: string;
  navLabel: string;
  title: string;
  subtitle?: string;
  rows: PatientReportFindingRow[];
};

export type PatientReportPhotoSection = {
  type: "photos";
  id: string;
  navLabel: string;
  title: string;
  subtitle?: string;
  groups: PatientReportPhotoGroup[];
};

export type PatientReportTimelineSection = {
  type: "timeline";
  id: string;
  navLabel: string;
  title: string;
  subtitle?: string;
  items: PatientReportTimelineItem[];
};

export type PatientReportComparisonSection = {
  type: "comparison";
  id: string;
  navLabel: string;
  title: string;
  body: string;
};

export type PatientReportLimitationsSection = {
  type: "limitations";
  id: string;
  navLabel: string;
  title: string;
  items: string[];
};

export type PatientReportRecommendationsSection = {
  type: "recommendations";
  id: string;
  navLabel: string;
  title: string;
  subtitle?: string;
  steps: Array<{ id: string; label: string; analyticsKey?: string }>;
};

export type PatientReportDisclosureSection = {
  type: "disclosure";
  id: string;
  navLabel: string;
  title: string;
  subtitle?: string;
  items: PatientReportDisclosureItem[];
  /** Collapsed by default on screen; expanded for print when items request it. */
  defaultCollapsed?: boolean;
};

export type PatientReportSection =
  | PatientReportOrientationSection
  | PatientReportNarrativeSection
  | PatientReportFindingsSection
  | PatientReportPhotoSection
  | PatientReportTimelineSection
  | PatientReportComparisonSection
  | PatientReportLimitationsSection
  | PatientReportRecommendationsSection
  | PatientReportDisclosureSection;

export type PatientReportViewModel = {
  reportType: PatientReportType;
  reportTitle: string;
  reportSubtitle?: string;
  caseStatus?: string;
  reportDate?: string;
  procedureDate?: string;
  patientDisplayName?: string;
  /** Patient-safe reference only — never database / snapshot IDs. */
  reportReference?: string | null;
  backHref?: string;
  downloadHref?: string;
  summary: PatientReportSummary;
  statusItems: PatientReportStatusItem[];
  sections: PatientReportSection[];
  actions: PatientReportAction[];
  disclosures: PatientReportDisclosureItem[];
  /** Pathway / entry context for analytics (safe tokens only). */
  analytics: {
    reportType: PatientReportType;
    entryContext?: string;
    pathway?: string;
  };
};
