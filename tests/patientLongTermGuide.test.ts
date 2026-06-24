/**
 * HA-GUIDE-2 — Long-term hair restoration guide content, i18n, HTML, and download wiring.
 * Run: pnpm exec tsx --test tests/patientLongTermGuide.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildPatientLongTermGuideContent,
  isUnresolvedGuideTranslation,
  PATIENT_LONG_TERM_GUIDE_SECTION_IDS,
} from "../src/lib/reports/patientLongTermGuide";
import {
  renderPatientLongTermGuideHtml,
} from "../src/lib/reports/PatientLongTermGuideHtml";
import { buildPatientLongTermGuidePdfHref, PATIENT_LONG_TERM_GUIDE_PRINT_PATH } from "../src/lib/constants/patientGuide";
import { getTranslation } from "../src/lib/i18n/getTranslation";
import { generateReportPdfFromUrl } from "../src/lib/pdf/generateReportPdf";

const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /TODO/i,
  /placeholder/i,
  /TBD/i,
  /coming soon/i,
];

const FORBIDDEN_PATIENT_TERMS = ["Forensic AI", "AuditOS", "Precision Score", "GPT"];

describe("patientLongTermGuide", () => {
  it("builds all 9 guide sections with resolved translation copy", () => {
    const content = buildPatientLongTermGuideContent("en");

    assert.equal(content.sections.length, 9);
    assert.deepEqual(
      content.sections.map((s) => s.id),
      [...PATIENT_LONG_TERM_GUIDE_SECTION_IDS]
    );

    for (const section of content.sections) {
      assert.ok(section.title.length > 0, `section ${section.id} missing title`);
      assert.equal(isUnresolvedGuideTranslation(section.title), false, section.title);

      const allText = [
        section.title,
        section.purpose ?? "",
        section.closing ?? "",
        section.safetyStatement ?? "",
        ...(section.paragraphs ?? []),
        ...(section.bullets ?? []),
        ...(section.timeline?.flatMap((p) => [p.label, p.description]) ?? []),
      ].join(" ");

      for (const pattern of PLACEHOLDER_PATTERNS) {
        assert.doesNotMatch(allText, pattern, `section ${section.id} contains placeholder-like text`);
      }
      for (const term of FORBIDDEN_PATIENT_TERMS) {
        assert.equal(allText.includes(term), false, `section ${section.id} exposes forbidden term: ${term}`);
      }
    }
  });

  it("includes safety statements in medication and treatment sections", () => {
    const content = buildPatientLongTermGuideContent("en");
    const nativeHair = content.sections.find((s) => s.id === "protectingNativeHair");
    assert.ok(nativeHair?.safetyStatement);
    assert.match(nativeHair!.safetyStatement!, /GP|qualified treating clinician/i);
  });

  it("resolves translation keys for cover and footer strings", () => {
    const content = buildPatientLongTermGuideContent("en");

    assert.equal(content.documentTitle, getTranslation("patientEducation.longTermHairRestorationGuide.documentTitle", "en"));
    assert.equal(content.coverTitle, getTranslation("patientEducation.longTermHairRestorationGuide.coverTitle", "en"));
    assert.equal(isUnresolvedGuideTranslation(content.coverSubtitle), false);
    assert.equal(isUnresolvedGuideTranslation(content.footerDisclaimer), false);
    assert.equal(isUnresolvedGuideTranslation(content.footerIndependence), false);
    assert.equal(isUnresolvedGuideTranslation(content.educationalDisclaimer), false);
  });

  it("renders stable HTML with all section anchors and mobile viewport", () => {
    const content = buildPatientLongTermGuideContent("en");
    const html = renderPatientLongTermGuideHtml(content);

    assert.match(html, /<!doctype html>/i);
    assert.match(html, /name="viewport"/i);
    assert.match(html, /Long-Term Hair Restoration Guide/);
    assert.ok(html.includes("@page { size: A4"));

    for (const id of PATIENT_LONG_TERM_GUIDE_SECTION_IDS) {
      assert.match(html, new RegExp(`id="section-${id}"`));
      assert.match(html, new RegExp(`id="title-${id}"`));
    }

    assert.match(html, /max-width: 640px/);
    assert.doesNotMatch(html, /lorem ipsum/i);
  });

  it("preserves existing public PDF download path constant", () => {
    assert.equal(buildPatientLongTermGuidePdfHref("en"), "/post-operative-hair-protection-guide.pdf");
  });

  it("wires PDF rewrite and print route in project config", () => {
    const nextConfig = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    const dashboardCard = readFileSync(
      join(process.cwd(), "src/components/patient/PatientDashboardHliGuideCard.tsx"),
      "utf8"
    );
    const guidePage = readFileSync(join(process.cwd(), "src/app/post-op-hair-protection-guide/page.tsx"), "utf8");

    assert.match(nextConfig, /post-operative-hair-protection-guide\.pdf/);
    assert.match(nextConfig, /patient-long-term-guide/);
    assert.ok(dashboardCard.includes("buildPatientLongTermGuidePdfHref"));
    assert.ok(guidePage.includes("buildPatientLongTermGuidePdfHref"));
    assert.match(guidePage, /download/);
    assert.equal(PATIENT_LONG_TERM_GUIDE_PRINT_PATH, "/api/print/patient-long-term-guide");
  });

  it("allows patient guide print URL in PDF generation guardrails", () => {
    const pdfGen = readFileSync(join(process.cwd(), "src/lib/pdf/generateReportPdf.ts"), "utf8");
    assert.match(pdfGen, /patient-long-term-guide/);
  });

  it("generateReportPdfFromUrl rejects unrelated URLs", async () => {
    await assert.rejects(
      () => generateReportPdfFromUrl("https://example.com/not-a-print-route"),
      /PDF render refused/
    );
  });
});
