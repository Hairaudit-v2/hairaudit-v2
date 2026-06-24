/**
 * HA-GUIDE-2B — Spanish localisation for the long-term hair restoration guide.
 * Run: pnpm exec tsx --test tests/patientLongTermGuideSpanish.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPatientLongTermGuideContent,
  isUnresolvedGuideTranslation,
  PATIENT_LONG_TERM_GUIDE_SECTION_IDS,
} from "../src/lib/reports/patientLongTermGuide";
import { renderPatientLongTermGuideHtml } from "../src/lib/reports/PatientLongTermGuideHtml";
import { buildPatientLongTermGuidePdfHref } from "../src/lib/constants/patientGuide";
import { getTranslation } from "../src/lib/i18n/getTranslation";
import en from "../src/lib/i18n/translations/en.json";
import es from "../src/lib/i18n/translations/es.json";

const GUIDE_PREFIX = "patientEducation.longTermHairRestorationGuide";

const SPANISH_SECTION_TITLES: Record<(typeof PATIENT_LONG_TERM_GUIDE_SECTION_IDS)[number], string> = {
  firstFourteenDays: "Los primeros 14 días después de la cirugía",
  growthTimeline: "Comprender el proceso normal de crecimiento capilar",
  warningSigns: "Cuándo contactar con su profesional tratante",
  protectingNativeHair: "Proteger el cabello nativo existente",
  continuedProgression: "La progresión de la pérdida capilar no siempre se detiene después de la cirugía",
  supportiveTherapies: "Terapias capilares complementarias de apoyo",
  trackProgress: "Continúe controlando su evolución",
  enrichAssessments: "Ayude a mejorar futuras revisiones de HairAudit",
  longTermRecord: "Su proceso de restauración capilar continúa",
};

const UNSAFE_PRESCRIPTION_PATTERNS = [
  /debe tomar finasterida/i,
  /debe usar dutasterida/i,
  /debe empezar saw palmetto/i,
  /debe tomar/i,
  /debe usar/i,
  /debe empezar/i,
];

type JsonRecord = Record<string, unknown>;

function collectStringLeafPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string") {
    return prefix ? [prefix] : [];
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return [];
  }
  const record = obj as JsonRecord;
  return Object.entries(record).flatMap(([key, value]) =>
    collectStringLeafPaths(value, prefix ? `${prefix}.${key}` : key)
  );
}

function collectGuideText(content: ReturnType<typeof buildPatientLongTermGuideContent>): string {
  return [
    content.documentTitle,
    content.coverTitle,
    content.coverSubtitle,
    content.coverAttribution,
    content.footerDisclaimer,
    content.footerIndependence,
    content.educationalDisclaimer,
    ...content.sections.flatMap((section) => [
      section.title,
      section.purpose ?? "",
      section.closing ?? "",
      section.safetyStatement ?? "",
      ...(section.paragraphs ?? []),
      ...(section.bullets ?? []),
      ...(section.timeline?.flatMap((p) => [p.label, p.description]) ?? []),
    ]),
  ].join(" ");
}

describe("patientLongTermGuideSpanish", () => {
  it("es.json mirrors all longTermHairRestorationGuide string keys from en.json", () => {
    const enGuide = (en as JsonRecord).patientEducation as JsonRecord;
    const esGuide = (es as JsonRecord).patientEducation as JsonRecord;
    const enPaths = collectStringLeafPaths(enGuide?.longTermHairRestorationGuide).sort();
    const esPaths = collectStringLeafPaths(esGuide?.longTermHairRestorationGuide).sort();

    assert.deepEqual(esPaths, enPaths);
    assert.ok(enPaths.length > 0);
  });

  it("resolves all 9 Spanish section titles without English fallback", () => {
    const content = buildPatientLongTermGuideContent("es");

    assert.equal(content.sections.length, 9);
    for (const section of content.sections) {
      const expected = SPANISH_SECTION_TITLES[section.id];
      assert.equal(section.title, expected, `section ${section.id} title`);
      assert.equal(isUnresolvedGuideTranslation(section.title), false);

      const englishTitle = getTranslation(`${GUIDE_PREFIX}.sections.${section.id}.title`, "en");
      assert.notEqual(section.title, englishTitle, `section ${section.id} fell back to English title`);
    }
  });

  it("resolves Spanish body copy without English fallback for guide leaves", () => {
    const enGuide = (en as JsonRecord).patientEducation as JsonRecord;
    const paths = collectStringLeafPaths(enGuide?.longTermHairRestorationGuide);

    for (const relativePath of paths) {
      const key = `${GUIDE_PREFIX}.${relativePath}`;
      const esValue = getTranslation(key, "es");
      const enValue = getTranslation(key, "en");

      assert.ok(esValue.length > 0, key);
      assert.equal(isUnresolvedGuideTranslation(esValue), false, key);
      assert.notEqual(esValue, key, key);
      assert.notEqual(esValue, enValue, `${key} matches English (fallback)`);
    }
  });

  it("includes Spanish safety statement and educational disclaimer", () => {
    const content = buildPatientLongTermGuideContent("es");
    const nativeHair = content.sections.find((s) => s.id === "protectingNativeHair");

    assert.match(
      nativeHair?.safetyStatement ?? "",
      /médico de cabecera|profesional clínico cualificado/i
    );
    assert.equal(
      content.educationalDisclaimer,
      "HairAudit ofrece orientación educativa únicamente y no prescribe tratamientos."
    );
  });

  it("avoids prescription-style Spanish in medication and therapy sections", () => {
    const content = buildPatientLongTermGuideContent("es");
    const medicationSections = content.sections.filter((s) =>
      ["protectingNativeHair", "supportiveTherapies"].includes(s.id)
    );

    for (const section of medicationSections) {
      const text = collectGuideText({
        ...content,
        sections: [section],
      });
      for (const pattern of UNSAFE_PRESCRIPTION_PATTERNS) {
        assert.doesNotMatch(text, pattern, `section ${section.id} uses prescription phrasing`);
      }
    }
  });

  it("renders Spanish titles in PDF HTML with Spanish lang attribute", () => {
    const content = buildPatientLongTermGuideContent("es");
    const html = renderPatientLongTermGuideHtml(content);

    assert.match(html, /lang="es"/);
    assert.match(html, /Guía de restauración capilar a largo plazo/);
    assert.match(html, /Los primeros 14 días después de la cirugía/);
    assert.match(html, /HairAudit ofrece orientación educativa únicamente y no prescribe tratamientos/);
    assert.doesNotMatch(html, /Long-Term Hair Restoration Guide/);
  });

  it("builds locale-aware PDF download href for Spanish users", () => {
    assert.equal(buildPatientLongTermGuidePdfHref("en"), "/post-operative-hair-protection-guide.pdf");
    assert.equal(
      buildPatientLongTermGuidePdfHref("es"),
      "/post-operative-hair-protection-guide.pdf?locale=es"
    );
  });

  it("Spanish enrichAssessments intro uses patient-safe wording", () => {
    const intro = getTranslation(`${GUIDE_PREFIX}.sections.enrichAssessments.intro`, "es");
    assert.match(intro, /Las evaluaciones de HairAudit pueden volverse más completas/i);
    assert.doesNotMatch(intro, /aprende de usted|AI learns|inteligencia artificial/i);
  });
});
