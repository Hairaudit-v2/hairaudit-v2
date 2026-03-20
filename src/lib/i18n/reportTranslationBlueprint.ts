import type { SupportedLocale } from "./constants";
import { REPORT_SOURCE_LOCALE_UNDETERMINED, type SourceContentLocale } from "./localeContexts";
import { REPORT_CONTENT_DEFAULT_LOCALE } from "./report";

/**
 * Lifecycle of a translated report artifact (blueprint only — **not** written by current generators).
 */
export type ReportTranslationStatus =
  | "none"
  | "pending"
  | "machine"
  | "human_reviewed"
  | "validated";

/** Coarse sections that could be translated independently in a future pipeline. */
export type ReportTranslatedSectionId =
  | "patientSafeSummaryShell"
  | "executiveSummary"
  | "findings"
  | "recommendations"
  | "domainScores"
  | "metadata";

/**
 * Per-section bookkeeping for review / provenance (additive future schema).
 * Empty objects are valid; generators today must ignore this type entirely.
 */
export type ReportTranslationSectionBlueprint = {
  id: ReportTranslatedSectionId;
  reviewed: boolean;
  reviewedAt?: string;
  translationProvenance?: string;
};

/**
 * Container for a future stored translation bundle (e.g. JSON column or sidecar document).
 * **Do not** attach to live `finalize` / PDF paths until schemas and product sign-off exist.
 */
export type ReportTranslationPlan = {
  sourceLocale: SourceContentLocale;
  targetLocale: SupportedLocale;
  sections: Partial<Record<ReportTranslatedSectionId, ReportTranslationSectionBlueprint>>;
  status: ReportTranslationStatus;
};

/**
 * Additive shell-level readiness marker for future patient-safe summary delivery.
 * This intentionally tracks only app-owned framing; generated narrative remains English-first.
 */
export type PatientSafeSummaryShellBlueprint = {
  locale: SupportedLocale;
  narrativeLocale: "en";
  translatedNarrativeAvailable: false;
};

/**
 * Future lifecycle for translated report narrative content.
 * This is intentionally more specific than the coarse Batch 9 `ReportTranslationStatus`.
 */
export type ReportNarrativeTranslationStatus =
  | "not_requested"
  | "pending_generation"
  | "generated_unreviewed"
  | "reviewed_approved"
  | "stale_due_to_source_change";

/**
 * Separate review bookkeeping so future rollout logic can distinguish generation from approval.
 */
export type ReportNarrativeTranslationReviewStatus =
  | "not_reviewed"
  | "review_required"
  | "approved"
  | "rejected";

/**
 * Which class of content a future translated section belongs to.
 * This helps keep patient-safe framing distinct from clinical/internal prose.
 */
export type ReportNarrativeTranslationCategory =
  | "app_owned_shell"
  | "patient_safe_generated"
  | "patient_visible_clinical"
  | "clinician_internal"
  | "structured_data"
  | "metadata";

export type ReportNarrativeTranslationReviewRequirement = "none" | "recommended" | "required";

/**
 * Stable guidance for what future translation automation may attempt and what must be reviewed
 * before patient-visible use. These values are documentation/contract only for now.
 */
export type ReportNarrativeTranslationPolicy = {
  category: ReportNarrativeTranslationCategory;
  machineTranslationAllowed: boolean;
  humanReviewRequirement: ReportNarrativeTranslationReviewRequirement;
  patientVisible: boolean;
};

/**
 * English remains the canonical narrative source language until a dedicated source-language
 * generation flow exists. `sourceContentLocale` captures the original evidence language when known.
 */
export type ReportNarrativeSourceSnapshot = {
  locale: typeof REPORT_CONTENT_DEFAULT_LOCALE;
  sourceContentLocale: SourceContentLocale;
  text: string;
  capturedAt?: string;
  /**
   * Future immutable source marker, e.g. `report:v3:findings` or another snapshot identifier.
   * Prefer comparing this first when available; fall back to normalized text comparison otherwise.
   */
  contentVersion?: string;
};

export type ReportNarrativeTranslationReview = {
  status: ReportNarrativeTranslationReviewStatus;
  reviewedAt?: string;
  reviewerId?: string;
  reviewNotes?: string;
};

/**
 * Contract for one future translated narrative section.
 * No current report, finalize, scoring, or PDF paths should read this yet.
 */
export type ReportNarrativeTranslationSection = {
  sectionId: ReportTranslatedSectionId;
  sourceLocale: typeof REPORT_CONTENT_DEFAULT_LOCALE;
  targetLocale: SupportedLocale;
  status: ReportNarrativeTranslationStatus;
  policy: ReportNarrativeTranslationPolicy;
  sourceSnapshot: ReportNarrativeSourceSnapshot;
  translatedText?: string;
  translatedAt?: string;
  translationProvenance?: string;
  review: ReportNarrativeTranslationReview;
  staleDetectedAt?: string;
};

/**
 * Future translations should attach to an immutable report-version/content snapshot rather than a
 * mutable case-level locale preference. That keeps English source and translated derivatives in sync.
 */
export type ReportNarrativeTranslationStorageBinding = {
  scope: "report_version_snapshot";
  caseId?: string;
  reportId?: string;
  reportVersion?: number;
  summaryReleaseKey?: string;
};

/**
 * Future storage/read contract for translated narrative overlays.
 * Intended for a JSON column or sidecar document in a later rollout.
 */
export type ReportNarrativeTranslationBundle = {
  sourceNarrativeLocale: typeof REPORT_CONTENT_DEFAULT_LOCALE;
  targetLocale: SupportedLocale;
  storage: ReportNarrativeTranslationStorageBinding;
  sections: Partial<Record<ReportTranslatedSectionId, ReportNarrativeTranslationSection>>;
  createdAt?: string;
  updatedAt?: string;
};

export const REPORT_NARRATIVE_TRANSLATION_POLICIES: Record<
  ReportTranslatedSectionId,
  ReportNarrativeTranslationPolicy
> = {
  patientSafeSummaryShell: {
    category: "app_owned_shell",
    machineTranslationAllowed: true,
    humanReviewRequirement: "recommended",
    patientVisible: true,
  },
  executiveSummary: {
    category: "patient_safe_generated",
    machineTranslationAllowed: true,
    humanReviewRequirement: "required",
    patientVisible: true,
  },
  findings: {
    category: "patient_visible_clinical",
    machineTranslationAllowed: true,
    humanReviewRequirement: "required",
    patientVisible: true,
  },
  recommendations: {
    category: "patient_visible_clinical",
    machineTranslationAllowed: true,
    humanReviewRequirement: "required",
    patientVisible: true,
  },
  domainScores: {
    category: "structured_data",
    machineTranslationAllowed: true,
    humanReviewRequirement: "recommended",
    patientVisible: true,
  },
  metadata: {
    category: "metadata",
    machineTranslationAllowed: true,
    humanReviewRequirement: "none",
    patientVisible: false,
  },
};

export function createPatientSafeSummaryShellBlueprint(locale: SupportedLocale): PatientSafeSummaryShellBlueprint {
  return {
    locale,
    narrativeLocale: "en",
    translatedNarrativeAvailable: false,
  };
}

export function createEmptyReportTranslationPlan(targetLocale: SupportedLocale): ReportTranslationPlan {
  return {
    sourceLocale: REPORT_SOURCE_LOCALE_UNDETERMINED,
    targetLocale,
    sections: {},
    status: "none",
  };
}

export function createEmptyReportNarrativeTranslationBundle(targetLocale: SupportedLocale): ReportNarrativeTranslationBundle {
  return {
    sourceNarrativeLocale: REPORT_CONTENT_DEFAULT_LOCALE,
    targetLocale,
    storage: { scope: "report_version_snapshot" },
    sections: {},
  };
}

export function getReportNarrativeTranslationPolicy(
  sectionId: ReportTranslatedSectionId
): ReportNarrativeTranslationPolicy {
  return REPORT_NARRATIVE_TRANSLATION_POLICIES[sectionId];
}

function normalizeNarrativeSourceText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export type ReportNarrativeTranslationStalenessCheck = {
  sourceSnapshot: Pick<ReportNarrativeSourceSnapshot, "text" | "contentVersion">;
  currentSourceText: string;
  currentContentVersion?: string | null;
};

/**
 * Use version markers when present; otherwise compare normalized English source text snapshots.
 * This stays intentionally small and pure so future persistence or jobs can reuse it safely.
 */
export function isReportNarrativeTranslationStale(args: ReportNarrativeTranslationStalenessCheck): boolean {
  if (args.currentContentVersion && args.sourceSnapshot.contentVersion) {
    return args.currentContentVersion !== args.sourceSnapshot.contentVersion;
  }

  return normalizeNarrativeSourceText(args.sourceSnapshot.text) !== normalizeNarrativeSourceText(args.currentSourceText);
}

export function canServeReviewedNarrativeTranslation(
  section: Pick<ReportNarrativeTranslationSection, "status" | "translatedText" | "review">
): boolean {
  return (
    section.status === "reviewed_approved" &&
    section.review.status === "approved" &&
    Boolean(section.translatedText?.trim())
  );
}
