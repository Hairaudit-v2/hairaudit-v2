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
import { getTranslation } from "@/lib/i18n/getTranslation";
import { getReportGlossaryLabel } from "@/lib/i18n/reportTerminology";
import { defaultReportOutputLocale, describeLocaleIntent, normalizeUiLocale } from "@/lib/i18n/localeContexts";
import { createEmptyReportTranslationPlan } from "@/lib/i18n/reportTranslationBlueprint";
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

test("getTranslation: marketing meta resolves Spanish when present", () => {
  assert.equal(
    getTranslation("marketing.meta.howItWorks.title", "es"),
    "Cómo funciona | HairAudit"
  );
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
