/**
 * i18n locale registry + resolution. Run: pnpm tsx --test tests/i18n/i18n.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  getDefaultLocale,
  getLocaleMeta,
  getTextDirection,
  isSupportedLocale,
  normalizeLocale,
} from "@/lib/i18n/constants";
import { formatTemplate } from "@/lib/i18n/formatTemplate";
import { resolveAuditPrompt, resolveAuditSectionTitle } from "@/lib/audit/auditDisplayI18n";
import { getIntakeFieldOptionLabel, getIntakeFieldPrompt, getTranslation } from "@/lib/i18n/getTranslation";
import { getReportGlossaryLabel } from "@/lib/i18n/reportTerminology";
import { defaultReportOutputLocale, describeLocaleIntent, normalizeUiLocale } from "@/lib/i18n/localeContexts";
import {
  canServeReviewedNarrativeTranslation,
  createEmptyReportNarrativeTranslationBundle,
  createEmptyReportTranslationPlan,
  createPatientSafeSummaryShellBlueprint,
  getReportNarrativeTranslationPolicy,
  isReportNarrativeTranslationStale,
} from "@/lib/i18n/reportTranslationBlueprint";
import { buildPatientSafeSummaryObservations } from "@/lib/reports/patientSafeSummary";
import {
  canServePatientSafeSummaryNarrativeTranslation,
  createPatientSafeSummaryNarrativeContentVersion,
  createPatientSafeSummaryNarrativeSourceSnapshot,
  getPatientSafeSummaryPilotTargetLocale,
  PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID,
  refreshPatientSafeSummaryNarrativeTranslation,
  resolvePatientSafeSummaryNarrativePresentation,
  validatePatientSafeSummaryReviewAction,
} from "@/lib/reports/patientSafeSummaryNarrativeTranslation";
import { resolvePatientSafeSummaryDisclosureState } from "@/lib/reports/patientSafeSummaryDisclosure";
import {
  derivePatientSafeSummaryQueueStatus,
  filterAndSortPatientSafeSummaryQueue,
} from "@/lib/reports/patientSafeSummaryTranslationQueue";
import { createLocalizedPageMetadata, localeFromAcceptLanguage } from "@/lib/seo/localeMetadata";
import {
  buildLocalizedPublicPathname,
  buildPublicLocaleLanguageAlternates,
  createPublicLocaleRoutingPlan,
  isLocalizedPublicPathname,
} from "@/lib/seo/publicLocaleRouting";

test("getDefaultLocale returns en", () => {
  assert.equal(getDefaultLocale(), "en");
});

test("normalizeLocale: invalid strings fall back to en", () => {
  assert.equal(normalizeLocale(undefined), "en");
  assert.equal(normalizeLocale(null), "en");
  assert.equal(normalizeLocale(""), "en");
  assert.equal(normalizeLocale("fr"), "en");
  assert.equal(normalizeLocale("  es  "), "es");
});

test("isSupportedLocale narrows enabled codes only", () => {
  assert.equal(isSupportedLocale("en"), true);
  assert.equal(isSupportedLocale("es"), true);
  assert.equal(isSupportedLocale("ar"), false);
  assert.equal(isSupportedLocale(""), false);
});

test("getTextDirection: default LTR for known and unknown locales", () => {
  assert.equal(getTextDirection("en"), "ltr");
  assert.equal(getTextDirection("es"), "ltr");
  assert.equal(getTextDirection("fr"), "ltr");
  assert.equal(getTextDirection(null), "ltr");
});

test("getLocaleMeta: returns registry row for known codes", () => {
  const en = getLocaleMeta("en");
  assert.ok(en);
  assert.equal(en?.code, "en");
  assert.equal(en?.rtl, false);
  assert.equal(getLocaleMeta("not-a-locale"), undefined);
});

test("getTranslation: uses Spanish when key exists in es bundle", () => {
  assert.equal(getTranslation("nav.home", "es"), "Inicio");
});

test("getTranslation: missing key everywhere returns key path", () => {
  const key = "this.key.does.not.exist";
  assert.equal(getTranslation(key, "en"), key);
  assert.equal(getTranslation(key, "es"), key);
});

test("getTranslation: dev warns when key missing in both locales", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevWarn = console.warn;
  const warnings: unknown[][] = [];
  process.env.NODE_ENV = "development";
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  try {
    getTranslation("nav.intentionally.absent.key", "es");
    assert.ok(warnings.length >= 1);
    assert.match(String(warnings[0][0] ?? ""), /Missing translation in requested and default locale/i);
  } finally {
    console.warn = prevWarn;
    process.env.NODE_ENV = prevEnv;
  }
});

test("localeFromAcceptLanguage: prefers es when listed first", () => {
  assert.equal(localeFromAcceptLanguage("es,en;q=0.9"), "es");
  assert.equal(localeFromAcceptLanguage("es-MX,en-US"), "es");
});

test("localeFromAcceptLanguage: en before es yields en", () => {
  assert.equal(localeFromAcceptLanguage("en,es;q=0.8"), "en");
});

test("localeFromAcceptLanguage: unknown languages fall back to en", () => {
  assert.equal(localeFromAcceptLanguage("fr-CH,de"), "en");
});

test("localeFromAcceptLanguage: null or empty is en", () => {
  assert.equal(localeFromAcceptLanguage(null), "en");
  assert.equal(localeFromAcceptLanguage(""), "en");
});

test("isLocalizedPublicPathname: recognizes Batch 18 localized marketing routes", () => {
  assert.equal(isLocalizedPublicPathname("/"), true);
  assert.equal(isLocalizedPublicPathname("/how-it-works"), true);
  assert.equal(isLocalizedPublicPathname("/professionals"), true);
  assert.equal(isLocalizedPublicPathname("/sample-report"), true);
  assert.equal(isLocalizedPublicPathname("/clinics"), false);
});

test("buildLocalizedPublicPathname: keeps English unprefixed and prefixes Spanish", () => {
  assert.equal(buildLocalizedPublicPathname("en", "/how-it-works"), "/how-it-works");
  assert.equal(buildLocalizedPublicPathname("es", "/how-it-works"), "/es/how-it-works");
  assert.equal(buildLocalizedPublicPathname("en", "/"), "/");
  assert.equal(buildLocalizedPublicPathname("es", "/"), "/es");
});

test("createPublicLocaleRoutingPlan: current public setup stays single-url canonical", () => {
  const plan = createPublicLocaleRoutingPlan("/how-it-works");
  assert.equal(plan.localized, true);
  assert.equal(plan.canonicalLocale, "en");
  assert.equal(plan.canonicalPathname, "/how-it-works");
  assert.equal(plan.distinctLocaleUrlsReady, false);
  assert.equal(plan.strategy, "unprefixed_single_url");
  assert.equal(plan.localePathnames, undefined);
});

test("buildPublicLocaleLanguageAlternates: returns undefined until locale URLs are real", () => {
  const plan = createPublicLocaleRoutingPlan("/how-it-works");
  assert.equal(buildPublicLocaleLanguageAlternates(plan), undefined);
});

test("buildPublicLocaleLanguageAlternates: future distinct locale URLs get full map", () => {
  const plan = createPublicLocaleRoutingPlan("/how-it-works", {
    distinctLocaleUrlsReady: true,
  });
  assert.deepEqual(buildPublicLocaleLanguageAlternates(plan), {
    en: "/how-it-works",
    es: "/es/how-it-works",
    "x-default": "/how-it-works",
  });
});

test("getPatientSafeSummaryPilotTargetLocale: only Spanish is live in pilot", () => {
  assert.equal(getPatientSafeSummaryPilotTargetLocale("es"), "es");
  assert.equal(getPatientSafeSummaryPilotTargetLocale("en"), null);
});

test("createPatientSafeSummaryNarrativeSourceSnapshot: binds source to report version", () => {
  const snapshot = createPatientSafeSummaryNarrativeSourceSnapshot({
    observations: [{ stage: "day0", text: "Healing irregularity noted near day 0 recipient zone." }],
    reportId: "report-123",
    reportVersion: 4,
  });
  assert.equal(snapshot.locale, "en");
  assert.equal(snapshot.contentVersion, createPatientSafeSummaryNarrativeContentVersion("report-123", 4));
  assert.match(snapshot.text, /\[day0\]/);
});

test("canServePatientSafeSummaryNarrativeTranslation: serves recommended-review pilot translation when fresh", () => {
  const sourceSnapshot = createPatientSafeSummaryNarrativeSourceSnapshot({
    observations: [{ stage: "preop", text: "Pre-op donor photos show mild asymmetry." }],
    reportId: "report-123",
    reportVersion: 2,
  });
  assert.equal(
    canServePatientSafeSummaryNarrativeTranslation({
      section: {
        sectionId: PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID,
        sourceLocale: "en",
        targetLocale: "es",
        status: "generated_unreviewed",
        policy: {
          category: "patient_safe_generated",
          machineTranslationAllowed: true,
          humanReviewRequirement: "recommended",
          patientVisible: true,
        },
        sourceSnapshot,
        translatedText: "Las fotos preoperatorias del área donante muestran una leve asimetría.",
        review: { status: "not_reviewed" },
      },
      requestedLocale: "es",
      currentSourceText: sourceSnapshot.text,
      currentContentVersion: sourceSnapshot.contentVersion ?? "",
      translatedItems: ["Las fotos preoperatorias del área donante muestran una leve asimetría."],
      sourceObservationCount: 1,
    }),
    true
  );
});

test("canServePatientSafeSummaryNarrativeTranslation: stale source falls back", () => {
  const sourceSnapshot = createPatientSafeSummaryNarrativeSourceSnapshot({
    observations: [{ stage: "preop", text: "Pre-op donor photos show mild asymmetry." }],
    reportId: "report-123",
    reportVersion: 2,
  });
  assert.equal(
    canServePatientSafeSummaryNarrativeTranslation({
      section: {
        sectionId: PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID,
        sourceLocale: "en",
        targetLocale: "es",
        status: "generated_unreviewed",
        policy: {
          category: "patient_safe_generated",
          machineTranslationAllowed: true,
          humanReviewRequirement: "recommended",
          patientVisible: true,
        },
        sourceSnapshot,
        translatedText: "Las fotos preoperatorias del área donante muestran una leve asimetría.",
        review: { status: "not_reviewed" },
      },
      requestedLocale: "es",
      currentSourceText: sourceSnapshot.text,
      currentContentVersion: createPatientSafeSummaryNarrativeContentVersion("report-123", 3),
      translatedItems: ["Las fotos preoperatorias del área donante muestran una leve asimetría."],
      sourceObservationCount: 1,
    }),
    false
  );
});

test("canServePatientSafeSummaryNarrativeTranslation: stale after approval still falls back", () => {
  const sourceSnapshot = createPatientSafeSummaryNarrativeSourceSnapshot({
    observations: [{ stage: "preop", text: "Pre-op donor photos show mild asymmetry." }],
    reportId: "report-123",
    reportVersion: 2,
  });
  assert.equal(
    canServePatientSafeSummaryNarrativeTranslation({
      section: {
        sectionId: PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID,
        sourceLocale: "en",
        targetLocale: "es",
        status: "reviewed_approved",
        policy: {
          category: "patient_safe_generated",
          machineTranslationAllowed: true,
          humanReviewRequirement: "recommended",
          patientVisible: true,
        },
        sourceSnapshot,
        translatedText: "Las fotos preoperatorias del área donante muestran una leve asimetría.",
        review: { status: "approved" },
      },
      requestedLocale: "es",
      currentSourceText: sourceSnapshot.text,
      currentContentVersion: createPatientSafeSummaryNarrativeContentVersion("report-123", 3),
      translatedItems: ["Las fotos preoperatorias del área donante muestran una leve asimetría."],
      sourceObservationCount: 1,
    }),
    false
  );
});

test("canServePatientSafeSummaryNarrativeTranslation: unsupported locale does not serve pilot text", () => {
  const sourceSnapshot = createPatientSafeSummaryNarrativeSourceSnapshot({
    observations: [{ stage: "preop", text: "Pre-op donor photos show mild asymmetry." }],
    reportId: "report-123",
    reportVersion: 2,
  });
  assert.equal(
    canServePatientSafeSummaryNarrativeTranslation({
      section: {
        sectionId: PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID,
        sourceLocale: "en",
        targetLocale: "es",
        status: "reviewed_approved",
        policy: {
          category: "patient_safe_generated",
          machineTranslationAllowed: true,
          humanReviewRequirement: "recommended",
          patientVisible: true,
        },
        sourceSnapshot,
        translatedText: "Las fotos preoperatorias del área donante muestran una leve asimetría.",
        review: { status: "approved" },
      },
      requestedLocale: "en",
      currentSourceText: sourceSnapshot.text,
      currentContentVersion: sourceSnapshot.contentVersion ?? "",
      translatedItems: ["Las fotos preoperatorias del área donante muestran una leve asimetría."],
      sourceObservationCount: 1,
    }),
    false
  );
});

test("canServePatientSafeSummaryNarrativeTranslation: rejected review never serves", () => {
  const sourceSnapshot = createPatientSafeSummaryNarrativeSourceSnapshot({
    observations: [{ stage: "preop", text: "Pre-op donor photos show mild asymmetry." }],
    reportId: "report-123",
    reportVersion: 2,
  });
  assert.equal(
    canServePatientSafeSummaryNarrativeTranslation({
      section: {
        sectionId: PATIENT_SAFE_SUMMARY_TRANSLATION_SECTION_ID,
        sourceLocale: "en",
        targetLocale: "es",
        status: "reviewed_approved",
        policy: {
          category: "patient_safe_generated",
          machineTranslationAllowed: true,
          humanReviewRequirement: "recommended",
          patientVisible: true,
        },
        sourceSnapshot,
        translatedText: "Las fotos preoperatorias del área donante muestran una leve asimetría.",
        review: { status: "rejected" },
      },
      requestedLocale: "es",
      currentSourceText: sourceSnapshot.text,
      currentContentVersion: sourceSnapshot.contentVersion ?? "",
      translatedItems: ["Las fotos preoperatorias del área donante muestran una leve asimetría."],
      sourceObservationCount: 1,
    }),
    false
  );
});

test("resolvePatientSafeSummaryNarrativePresentation: feature flag off forces English fallback", async () => {
  const prev = process.env.ENABLE_PATIENT_SAFE_SUMMARY_TRANSLATION_PILOT;
  process.env.ENABLE_PATIENT_SAFE_SUMMARY_TRANSLATION_PILOT = "false";
  try {
    const out = await resolvePatientSafeSummaryNarrativePresentation({
      db: null,
      caseId: "case-1",
      reportId: "report-1",
      reportVersion: 1,
      requestedLocale: "es",
      sourceObservations: [{ stage: "preop", text: "Pre-op donor photos show mild asymmetry." }],
    });
    assert.equal(out.translationStatus, "english_fallback");
    assert.equal(out.fallbackReason, "pilot_disabled");
  } finally {
    process.env.ENABLE_PATIENT_SAFE_SUMMARY_TRANSLATION_PILOT = prev;
  }
});

test("resolvePatientSafeSummaryNarrativePresentation: unsupported locale yields explicit fallback reason", async () => {
  const out = await resolvePatientSafeSummaryNarrativePresentation({
    db: null,
    caseId: "case-1",
    reportId: "report-1",
    reportVersion: 1,
    requestedLocale: "en",
    sourceObservations: [{ stage: "preop", text: "Pre-op donor photos show mild asymmetry." }],
  });
  assert.equal(out.translationStatus, "english_fallback");
  assert.equal(out.fallbackReason, "unsupported_locale");
});

test("refreshPatientSafeSummaryNarrativeTranslation: explicit refresh path still falls back safely without generation", async () => {
  const mockDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      upsert: () => ({
        select: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      }),
    }),
  };
  const out = await refreshPatientSafeSummaryNarrativeTranslation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: mockDb as any,
    caseId: "case-1",
    reportId: "report-1",
    reportVersion: 1,
    requestedLocale: "es",
    sourceObservations: [{ stage: "preop", text: "Pre-op donor photos show mild asymmetry." }],
  });
  assert.equal(out.translationStatus, "english_fallback");
  assert.ok(out.fallbackReason === "generation_failed" || out.fallbackReason === "stored_translation_not_servable");
});

test("validatePatientSafeSummaryReviewAction: rejection requires rationale note", () => {
  assert.equal(validatePatientSafeSummaryReviewAction({ action: "approve" }).ok, true);
  assert.equal(validatePatientSafeSummaryReviewAction({ action: "reset_review" }).ok, true);
  assert.equal(validatePatientSafeSummaryReviewAction({ action: "reject", reviewNotes: "Needs terminology correction." }).ok, true);
  assert.equal(validatePatientSafeSummaryReviewAction({ action: "reject", reviewNotes: "   " }).ok, false);
});

test("resolvePatientSafeSummaryDisclosureState: translated state when pilot text is active", () => {
  const state = resolvePatientSafeSummaryDisclosureState({
    requestedLocale: "es",
    translatedNarrativeActive: true,
  });
  assert.equal(state, "translated_pilot_active");
});

test("resolvePatientSafeSummaryDisclosureState: English default for unsupported locale", () => {
  const state = resolvePatientSafeSummaryDisclosureState({
    requestedLocale: "en",
    translatedNarrativeActive: false,
    fallbackReason: "unsupported_locale",
  });
  assert.equal(state, "english_source_default");
});

test("resolvePatientSafeSummaryDisclosureState: Spanish fallback shows translation-availability disclosure", () => {
  const state = resolvePatientSafeSummaryDisclosureState({
    requestedLocale: "es",
    translatedNarrativeActive: false,
    fallbackReason: "generation_failed",
  });
  assert.equal(state, "english_source_translation_unavailable");
});

test("derivePatientSafeSummaryQueueStatus: maps pilot translation workflow states", () => {
  assert.equal(derivePatientSafeSummaryQueueStatus({ hasTranslation: false }), "missing_translation");
  assert.equal(
    derivePatientSafeSummaryQueueStatus({
      hasTranslation: true,
      translationStatus: "stale_due_to_source_change",
      reviewStatus: "approved",
    }),
    "stale"
  );
  assert.equal(
    derivePatientSafeSummaryQueueStatus({
      hasTranslation: true,
      translationStatus: "reviewed_approved",
      reviewStatus: "approved",
    }),
    "approved"
  );
  assert.equal(
    derivePatientSafeSummaryQueueStatus({
      hasTranslation: true,
      translationStatus: "generated_unreviewed",
      reviewStatus: "rejected",
    }),
    "rejected"
  );
});

test("filterAndSortPatientSafeSummaryQueue: filters stale and sorts oldest first", () => {
  const rows = filterAndSortPatientSafeSummaryQueue(
    [
      {
        caseId: "c1",
        caseTitle: "Case One",
        reportId: "r1",
        reportVersion: 1,
        targetLocale: "es",
        status: "stale",
        translationStatus: "stale_due_to_source_change",
        reviewStatus: "approved",
        fallbackCurrentlyEnglish: true,
        updatedAt: "2026-03-20T10:00:00.000Z",
        translatedAt: null,
        reviewedAt: null,
      },
      {
        caseId: "c2",
        caseTitle: "Case Two",
        reportId: "r2",
        reportVersion: 1,
        targetLocale: "es",
        status: "stale",
        translationStatus: "stale_due_to_source_change",
        reviewStatus: "approved",
        fallbackCurrentlyEnglish: true,
        updatedAt: "2026-03-18T10:00:00.000Z",
        translatedAt: null,
        reviewedAt: null,
      },
      {
        caseId: "c3",
        caseTitle: "Case Three",
        reportId: "r3",
        reportVersion: 1,
        targetLocale: "es",
        status: "approved",
        translationStatus: "reviewed_approved",
        reviewStatus: "approved",
        fallbackCurrentlyEnglish: false,
        updatedAt: "2026-03-19T10:00:00.000Z",
        translatedAt: null,
        reviewedAt: null,
      },
    ],
    { status: "stale", freshness: "stale", sort: "updated_asc" }
  );
  assert.deepEqual(
    rows.map((r) => r.caseId),
    ["c2", "c1"]
  );
});

test("formatTemplate: replaces placeholders", () => {
  assert.equal(formatTemplate("{{count}} items", { count: 3 }), "3 items");
  assert.equal(formatTemplate("Score {{score}}", { score: 72 }), "Score 72");
});

test("getReportGlossaryLabel: Spanish donor management term", () => {
  assert.equal(getReportGlossaryLabel("donorManagement", "es"), "Manejo del donante");
});

test("localeContexts: default report output is English", () => {
  assert.equal(defaultReportOutputLocale(), "en");
});

test("localeContexts: describeLocaleIntent fills defaults", () => {
  const intent = describeLocaleIntent("es");
  assert.equal(intent.ui, "es");
  assert.equal(intent.reportOutput, "en");
  assert.equal(intent.source, "und");
});

test("normalizeUiLocale: invalid → en", () => {
  assert.equal(normalizeUiLocale("fr"), "en");
});

test("createEmptyReportTranslationPlan: blueprint defaults", () => {
  const plan = createEmptyReportTranslationPlan("es");
  assert.equal(plan.targetLocale, "es");
  assert.equal(plan.status, "none");
  assert.equal(plan.sourceLocale, "und");
  assert.deepEqual(plan.sections, {});
});

test("createEmptyReportNarrativeTranslationBundle: additive defaults stay English-sourced", () => {
  const bundle = createEmptyReportNarrativeTranslationBundle("es");
  assert.equal(bundle.targetLocale, "es");
  assert.equal(bundle.sourceNarrativeLocale, "en");
  assert.equal(bundle.storage.scope, "report_version_snapshot");
  assert.deepEqual(bundle.sections, {});
});

test("getReportNarrativeTranslationPolicy: patient-visible narrative requires review", () => {
  const policy = getReportNarrativeTranslationPolicy("findings");
  assert.equal(policy.category, "patient_visible_clinical");
  assert.equal(policy.machineTranslationAllowed, true);
  assert.equal(policy.humanReviewRequirement, "required");
  assert.equal(policy.patientVisible, true);
});

test("isReportNarrativeTranslationStale: version marker changes mark translation stale", () => {
  assert.equal(
    isReportNarrativeTranslationStale({
      sourceSnapshot: { text: "English findings text", contentVersion: "report:v1:findings" },
      currentSourceText: "English findings text",
      currentContentVersion: "report:v2:findings",
    }),
    true
  );
});

test("isReportNarrativeTranslationStale: whitespace-only differences are ignored", () => {
  assert.equal(
    isReportNarrativeTranslationStale({
      sourceSnapshot: { text: "Line one\n\nLine two" },
      currentSourceText: "  Line one Line two  ",
    }),
    false
  );
});

test("canServeReviewedNarrativeTranslation: requires approved reviewed text", () => {
  assert.equal(
    canServeReviewedNarrativeTranslation({
      status: "reviewed_approved",
      translatedText: "Resumen traducido",
      review: { status: "approved" },
    }),
    true
  );
  assert.equal(
    canServeReviewedNarrativeTranslation({
      status: "generated_unreviewed",
      translatedText: "Resumen traducido",
      review: { status: "not_reviewed" },
    }),
    false
  );
});

test("createPatientSafeSummaryShellBlueprint: remains English narrative only", () => {
  const shell = createPatientSafeSummaryShellBlueprint("es");
  assert.equal(shell.locale, "es");
  assert.equal(shell.narrativeLocale, "en");
  assert.equal(shell.translatedNarrativeAvailable, false);
});

test("getTranslation: marketing meta resolves Spanish when present", () => {
  assert.equal(
    getTranslation("marketing.meta.howItWorks.title", "es"),
    "Cómo funciona | HairAudit"
  );
});

test("createLocalizedPageMetadata: keeps canonical stable and omits hreflang today", () => {
  const metadata = createLocalizedPageMetadata("es", {
    titleKey: "marketing.meta.howItWorks.title",
    descriptionKey: "marketing.meta.howItWorks.description",
    pathname: "/how-it-works",
  });
  assert.equal(metadata.alternates?.canonical, "/how-it-works");
  assert.equal(metadata.alternates?.languages, undefined);
});

test("getIntakeFieldPrompt: nested question id resolves in Spanish", () => {
  const p = getIntakeFieldPrompt("es", "clinic_city");
  assert.ok(p && p.length > 2);
  assert.notEqual(p, "Clinic City");
});

test("getIntakeFieldOptionLabel: option value with spaces uses bracket lookup", () => {
  const qid = "enhanced_patient_answers.baseline.patient_sex";
  const es = getIntakeFieldOptionLabel("es", qid, "Prefer not to say");
  const en = getIntakeFieldOptionLabel("en", qid, "Prefer not to say");
  assert.equal(en, "Prefer not to say");
  assert.ok(es && es.length > 0);
  assert.notEqual(es, "Prefer not to say");
});

test("doctor case audit display: section title resolves in Spanish", () => {
  const out = resolveAuditSectionTitle("doctor", "es", {
    id: "doctor_clinic",
    title: "1. Doctor & Clinic Profile",
  });
  assert.ok(out.length > 4);
  assert.notEqual(out, "1. Doctor & Clinic Profile");
});

test("clinic case audit display: prompt resolves in Spanish", () => {
  const out = resolveAuditPrompt("clinic", "es", {
    id: "clinic_location",
    prompt: "Clinic Location(s)",
  });
  assert.ok(out.length > 4);
  assert.notEqual(out, "Clinic Location(s)");
});

test("patient safe summary shell labels resolve in Spanish", () => {
  assert.equal(
    getTranslation("dashboard.patient.safeSummary.title", "es"),
    "Resumen seguro para el paciente"
  );
  assert.equal(
    getTranslation("dashboard.patient.safeSummary.stages.day0", "es"),
    "Día de la cirugía"
  );
});

test("buildPatientSafeSummaryObservations: keeps generated text but infers stages", () => {
  const observations = buildPatientSafeSummaryObservations({
    key_findings: [
      { title: "Pre-op donor photos show mild asymmetry." },
      { title: "At 12 month follow-up, density appears stable." },
    ],
    red_flags: ["Healing irregularity noted near day 0 recipient zone."],
  });

  assert.deepEqual(
    observations.map((item) => item.stage),
    ["preop", "month_12_plus", "day0"]
  );
  assert.equal(observations[0]?.text, "Pre-op donor photos show mild asymmetry.");
});

test("getTranslation: no dev warn in production for resolved Spanish", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevWarn = console.warn;
  const warnings: unknown[][] = [];
  process.env.NODE_ENV = "production";
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  try {
    const v = getTranslation("nav.clinics", "es");
    assert.equal(v, "Clínicas");
    assert.equal(warnings.length, 0);
  } finally {
    console.warn = prevWarn;
    process.env.NODE_ENV = prevEnv;
  }
});
