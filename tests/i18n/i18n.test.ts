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

test("getTranslation: Spanish missing key falls back to English string", () => {
  const v = getTranslation("nav.home", "es");
  assert.equal(v, "Home");
});

test("getTranslation: missing key everywhere returns key path", () => {
  const key = "this.key.does.not.exist";
  assert.equal(getTranslation(key, "en"), key);
  assert.equal(getTranslation(key, "es"), key);
});

test("getTranslation: dev warns on English fallback from another locale", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevWarn = console.warn;
  const warnings: unknown[][] = [];
  process.env.NODE_ENV = "development";
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  try {
    getTranslation("nav.howItWorks", "es");
    assert.ok(warnings.length >= 1);
    assert.match(String(warnings[0][0] ?? ""), /fell back to English/i);
  } finally {
    console.warn = prevWarn;
    process.env.NODE_ENV = prevEnv;
  }
});

test("getTranslation: no dev warn in production when falling back", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevWarn = console.warn;
  const warnings: unknown[][] = [];
  process.env.NODE_ENV = "production";
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  try {
    const v = getTranslation("nav.clinics", "es");
    assert.equal(v, "Clinics");
    assert.equal(warnings.length, 0);
  } finally {
    console.warn = prevWarn;
    process.env.NODE_ENV = prevEnv;
  }
});
