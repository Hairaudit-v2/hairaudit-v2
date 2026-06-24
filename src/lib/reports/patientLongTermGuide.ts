import { getTranslation } from "@/lib/i18n/getTranslation";
import type { SupportedLocale } from "@/lib/i18n/constants";
import { normalizeLocale } from "@/lib/i18n/constants";

/** HA-GUIDE-2 — Long-term patient education guide section identifiers (9 sections). */
export const PATIENT_LONG_TERM_GUIDE_SECTION_IDS = [
  "firstFourteenDays",
  "growthTimeline",
  "warningSigns",
  "protectingNativeHair",
  "continuedProgression",
  "supportiveTherapies",
  "trackProgress",
  "enrichAssessments",
  "longTermRecord",
] as const;

export type PatientLongTermGuideSectionId = (typeof PATIENT_LONG_TERM_GUIDE_SECTION_IDS)[number];

export type PatientLongTermGuideTimelinePeriod = {
  label: string;
  description: string;
};

export type PatientLongTermGuideSection = {
  id: PatientLongTermGuideSectionId;
  number: number;
  title: string;
  purpose?: string;
  paragraphs?: string[];
  bullets?: string[];
  timeline?: PatientLongTermGuideTimelinePeriod[];
  safetyStatement?: string;
  closing?: string;
};

export type PatientLongTermGuideContent = {
  documentTitle: string;
  coverTitle: string;
  coverSubtitle: string;
  coverAttribution: string;
  footerDisclaimer: string;
  footerIndependence: string;
  educationalDisclaimer: string;
  locale: SupportedLocale;
  sections: PatientLongTermGuideSection[];
};

const GUIDE_PREFIX = "patientEducation.longTermHairRestorationGuide";

const FIRST_FOURTEEN_DAYS_ITEMS = [
  "avoidTouching",
  "elevatedSleep",
  "avoidSweating",
  "avoidExercise",
  "avoidScratching",
  "washingProtocols",
  "avoidTrauma",
  "followMedication",
] as const;

const GROWTH_TIMELINE_PERIODS = [
  "weeks1to2",
  "weeks2to6",
  "months2to4",
  "months4to8",
  "months8to12",
  "months12to18",
] as const;

const WARNING_SIGN_ITEMS = [
  "increasingPain",
  "spreadingRedness",
  "persistentSwelling",
  "abnormalDischarge",
  "persistentBleeding",
  "fever",
  "donorInflammation",
  "worseningTenderness",
] as const;

const NATIVE_HAIR_EXAMPLES = [
  "finasteride",
  "dutasteride",
  "sawPalmetto",
  "nutritionalOptimisation",
  "scalpHealth",
] as const;

const SUPPORTIVE_THERAPY_EXAMPLES = [
  "prp",
  "exosome",
  "microneedling",
  "lowLevelLaser",
] as const;

const PROGRESS_PHOTO_MONTHS = ["month1", "month3", "month6", "month9", "month12"] as const;

const PROGRESS_CONSISTENCY_ITEMS = [
  "lighting",
  "cameraDistance",
  "hairLength",
  "dryHair",
  "angles",
] as const;

const PROGRESS_ANGLES = ["front", "leftSide", "rightSide", "topCrown", "donorArea"] as const;

const ENRICHMENT_UPLOAD_TYPES = [
  "progressPhotos",
  "donorImages",
  "procedureDocs",
  "medicationHistory",
  "secondProcedure",
  "regenerativeHistory",
  "clinicalConcerns",
] as const;

const CONTINUED_PROGRESSION_PARAGRAPHS = ["p1", "p2", "p3", "p4"] as const;

const LONG_TERM_RECORD_PARAGRAPHS = ["p1", "p2", "p3", "p4"] as const;

function guideKey(suffix: string) {
  return `${GUIDE_PREFIX}.${suffix}`;
}

function translateItems(
  locale: SupportedLocale,
  sectionKey: string,
  itemKeys: readonly string[]
): string[] {
  return itemKeys.map((item) => getTranslation(guideKey(`sections.${sectionKey}.items.${item}`), locale));
}

function buildFirstFourteenDaysSection(locale: SupportedLocale, number: number): PatientLongTermGuideSection {
  return {
    id: "firstFourteenDays",
    number,
    title: getTranslation(guideKey("sections.firstFourteenDays.title"), locale),
    purpose: getTranslation(guideKey("sections.firstFourteenDays.purpose"), locale),
    bullets: translateItems(locale, "firstFourteenDays", FIRST_FOURTEEN_DAYS_ITEMS),
    closing: getTranslation(guideKey("sections.firstFourteenDays.closing"), locale),
  };
}

function buildGrowthTimelineSection(locale: SupportedLocale, number: number): PatientLongTermGuideSection {
  return {
    id: "growthTimeline",
    number,
    title: getTranslation(guideKey("sections.growthTimeline.title"), locale),
    purpose: getTranslation(guideKey("sections.growthTimeline.purpose"), locale),
    timeline: GROWTH_TIMELINE_PERIODS.map((period) => ({
      label: getTranslation(guideKey(`sections.growthTimeline.periods.${period}.label`), locale),
      description: getTranslation(guideKey(`sections.growthTimeline.periods.${period}.description`), locale),
    })),
    closing: getTranslation(guideKey("sections.growthTimeline.closing"), locale),
  };
}

function buildWarningSignsSection(locale: SupportedLocale, number: number): PatientLongTermGuideSection {
  return {
    id: "warningSigns",
    number,
    title: getTranslation(guideKey("sections.warningSigns.title"), locale),
    purpose: getTranslation(guideKey("sections.warningSigns.purpose"), locale),
    bullets: translateItems(locale, "warningSigns", WARNING_SIGN_ITEMS),
    closing: getTranslation(guideKey("sections.warningSigns.closing"), locale),
  };
}

function buildProtectingNativeHairSection(locale: SupportedLocale, number: number): PatientLongTermGuideSection {
  return {
    id: "protectingNativeHair",
    number,
    title: getTranslation(guideKey("sections.protectingNativeHair.title"), locale),
    purpose: getTranslation(guideKey("sections.protectingNativeHair.purpose"), locale),
    paragraphs: [
      getTranslation(guideKey("sections.protectingNativeHair.paragraphs.p1"), locale),
      getTranslation(guideKey("sections.protectingNativeHair.paragraphs.p2"), locale),
      getTranslation(guideKey("sections.protectingNativeHair.paragraphs.p3"), locale),
    ],
    bullets: NATIVE_HAIR_EXAMPLES.map((item) =>
      getTranslation(guideKey(`sections.protectingNativeHair.examples.${item}`), locale)
    ),
    safetyStatement: getTranslation(guideKey("sections.protectingNativeHair.safetyStatement"), locale),
  };
}

function buildContinuedProgressionSection(locale: SupportedLocale, number: number): PatientLongTermGuideSection {
  return {
    id: "continuedProgression",
    number,
    title: getTranslation(guideKey("sections.continuedProgression.title"), locale),
    purpose: getTranslation(guideKey("sections.continuedProgression.purpose"), locale),
    paragraphs: CONTINUED_PROGRESSION_PARAGRAPHS.map((p) =>
      getTranslation(guideKey(`sections.continuedProgression.paragraphs.${p}`), locale)
    ),
    closing: getTranslation(guideKey("sections.continuedProgression.closing"), locale),
  };
}

function buildSupportiveTherapiesSection(locale: SupportedLocale, number: number): PatientLongTermGuideSection {
  return {
    id: "supportiveTherapies",
    number,
    title: getTranslation(guideKey("sections.supportiveTherapies.title"), locale),
    purpose: getTranslation(guideKey("sections.supportiveTherapies.purpose"), locale),
    paragraphs: [getTranslation(guideKey("sections.supportiveTherapies.intro"), locale)],
    bullets: SUPPORTIVE_THERAPY_EXAMPLES.map((item) =>
      getTranslation(guideKey(`sections.supportiveTherapies.examples.${item}`), locale)
    ),
  };
}

function buildTrackProgressSection(locale: SupportedLocale, number: number): PatientLongTermGuideSection {
  const photoScheduleLabel = getTranslation(guideKey("sections.trackProgress.photoScheduleLabel"), locale);
  const photoMonths = PROGRESS_PHOTO_MONTHS.map((m) =>
    getTranslation(guideKey(`sections.trackProgress.photoMonths.${m}`), locale)
  );
  const consistencyLabel = getTranslation(guideKey("sections.trackProgress.consistencyLabel"), locale);
  const consistencyItems = PROGRESS_CONSISTENCY_ITEMS.map((item) =>
    getTranslation(guideKey(`sections.trackProgress.consistency.${item}`), locale)
  );
  const anglesLabel = getTranslation(guideKey("sections.trackProgress.anglesLabel"), locale);
  const angles = PROGRESS_ANGLES.map((item) =>
    getTranslation(guideKey(`sections.trackProgress.angles.${item}`), locale)
  );

  return {
    id: "trackProgress",
    number,
    title: getTranslation(guideKey("sections.trackProgress.title"), locale),
    purpose: getTranslation(guideKey("sections.trackProgress.purpose"), locale),
    paragraphs: [
      `${photoScheduleLabel} ${photoMonths.join(", ")}.`,
      `${consistencyLabel} ${consistencyItems.join("; ")}.`,
      `${anglesLabel} ${angles.join(", ")}.`,
    ],
    closing: getTranslation(guideKey("sections.trackProgress.closing"), locale),
  };
}

function buildEnrichAssessmentsSection(locale: SupportedLocale, number: number): PatientLongTermGuideSection {
  return {
    id: "enrichAssessments",
    number,
    title: getTranslation(guideKey("sections.enrichAssessments.title"), locale),
    purpose: getTranslation(guideKey("sections.enrichAssessments.purpose"), locale),
    paragraphs: [getTranslation(guideKey("sections.enrichAssessments.intro"), locale)],
    bullets: ENRICHMENT_UPLOAD_TYPES.map((item) =>
      getTranslation(guideKey(`sections.enrichAssessments.uploadTypes.${item}`), locale)
    ),
    closing: getTranslation(guideKey("sections.enrichAssessments.closing"), locale),
  };
}

function buildLongTermRecordSection(locale: SupportedLocale, number: number): PatientLongTermGuideSection {
  return {
    id: "longTermRecord",
    number,
    title: getTranslation(guideKey("sections.longTermRecord.title"), locale),
    purpose: getTranslation(guideKey("sections.longTermRecord.purpose"), locale),
    paragraphs: [
      ...LONG_TERM_RECORD_PARAGRAPHS.map((p) =>
        getTranslation(guideKey(`sections.longTermRecord.paragraphs.${p}`), locale)
      ),
      getTranslation(guideKey("sections.longTermRecord.closingStatement"), locale),
    ],
  };
}

const SECTION_BUILDERS: Record<
  PatientLongTermGuideSectionId,
  (locale: SupportedLocale, number: number) => PatientLongTermGuideSection
> = {
  firstFourteenDays: buildFirstFourteenDaysSection,
  growthTimeline: buildGrowthTimelineSection,
  warningSigns: buildWarningSignsSection,
  protectingNativeHair: buildProtectingNativeHairSection,
  continuedProgression: buildContinuedProgressionSection,
  supportiveTherapies: buildSupportiveTherapiesSection,
  trackProgress: buildTrackProgressSection,
  enrichAssessments: buildEnrichAssessmentsSection,
  longTermRecord: buildLongTermRecordSection,
};

export function buildPatientLongTermGuideContent(localeInput?: string): PatientLongTermGuideContent {
  const locale = normalizeLocale(localeInput) as SupportedLocale;

  const sections = PATIENT_LONG_TERM_GUIDE_SECTION_IDS.map((id, index) =>
    SECTION_BUILDERS[id](locale, index + 1)
  );

  return {
    documentTitle: getTranslation(guideKey("documentTitle"), locale),
    coverTitle: getTranslation(guideKey("coverTitle"), locale),
    coverSubtitle: getTranslation(guideKey("coverSubtitle"), locale),
    coverAttribution: getTranslation(guideKey("coverAttribution"), locale),
    footerDisclaimer: getTranslation(guideKey("footerDisclaimer"), locale),
    footerIndependence: getTranslation(guideKey("footerIndependence"), locale),
    educationalDisclaimer: getTranslation(guideKey("educationalDisclaimer"), locale),
    locale,
    sections,
  };
}

/** Returns true when resolved copy still looks like an unresolved i18n key path. */
export function isUnresolvedGuideTranslation(value: string): boolean {
  return value.startsWith(GUIDE_PREFIX);
}
