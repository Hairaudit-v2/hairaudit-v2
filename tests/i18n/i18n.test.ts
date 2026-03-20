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
import { localeFromAcceptLanguage } from "@/lib/seo/localeMetadata";

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
