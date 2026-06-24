/**
 * HA-FIX-8E — PDF preflight template normalization tests.
 * Run: pnpm exec tsx --test tests/pdfTemplateNormalization.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeReportTemplateForPdf,
  validatePdfPreflightTemplateHeader,
} from "@/lib/pdf/normalizeReportTemplateForPdf";
import { resolvePatientReportTemplateName } from "@/lib/reports/preSurgeryPlanningReport";

describe("normalizeReportTemplateForPdf", () => {
  it("maps post-surgery clinical template keys to elite", () => {
    assert.equal(normalizeReportTemplateForPdf("post-surgery-audit"), "elite");
    assert.equal(normalizeReportTemplateForPdf("post_surgery_audit"), "elite");
    assert.equal(normalizeReportTemplateForPdf("post_surgery"), "elite");
    assert.equal(normalizeReportTemplateForPdf("post-surgery"), "elite");
  });

  it("maps pre-surgery clinical template keys to elite", () => {
    assert.equal(normalizeReportTemplateForPdf("pre-surgery-planning"), "elite");
    assert.equal(normalizeReportTemplateForPdf("pre_surgery_planning"), "elite");
    assert.equal(normalizeReportTemplateForPdf("pre_surgery"), "elite");
    assert.equal(normalizeReportTemplateForPdf("pre-surgery"), "elite");
  });

  it("passes elite and demo through unchanged", () => {
    assert.equal(normalizeReportTemplateForPdf("elite"), "elite");
    assert.equal(normalizeReportTemplateForPdf("demo"), "demo");
    assert.equal(normalizeReportTemplateForPdf("sample"), "demo");
  });

  it("throws on unknown template input", () => {
    assert.throws(() => normalizeReportTemplateForPdf("custom-brand-template"), /unknown template/i);
    assert.throws(() => normalizeReportTemplateForPdf(""), /empty template/i);
  });
});

describe("validatePdfPreflightTemplateHeader", () => {
  it("accepts elite and demo headers only", () => {
    assert.equal(validatePdfPreflightTemplateHeader("elite"), "elite");
    assert.equal(validatePdfPreflightTemplateHeader("demo"), "demo");
    assert.equal(validatePdfPreflightTemplateHeader("ELITE"), "elite");
  });

  it("rejects unknown direct preflight headers", () => {
    assert.throws(
      () => validatePdfPreflightTemplateHeader("post-surgery-audit"),
      /expected X-Report-Template=elite or demo/
    );
    assert.throws(
      () => validatePdfPreflightTemplateHeader("pre-surgery-planning"),
      /expected X-Report-Template=elite or demo/
    );
    assert.throws(
      () => validatePdfPreflightTemplateHeader(null),
      /expected X-Report-Template=elite or demo/
    );
  });
});

describe("print route producer wiring", () => {
  it("normalizes patient post-surgery clinical template to elite header", () => {
    const clinical = resolvePatientReportTemplateName("post_surgery", "patient");
    assert.equal(clinical, "post-surgery-audit");
    assert.equal(normalizeReportTemplateForPdf(clinical), "elite");
  });

  it("print route resolves clinical template then normalizes for X-Report-Template", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/print/report/route.ts"), "utf8");
    assert.match(route, /resolvePatientReportTemplateName/);
    assert.match(route, /resolvePdfReportTemplateHeader/);
    assert.match(route, /"X-Report-Template": pdfTemplate/);
    assert.doesNotMatch(route, /"X-Report-Template": resolvePatientReportTemplateName/);
  });

  it("generateReportPdf preflight still validates elite/demo only", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/pdf/generateReportPdf.ts"), "utf8");
    assert.match(src, /validatePdfPreflightTemplateHeader/);
  });
});

describe("image-limited post-surgery PDF rebuild", () => {
  it("patient post-surgery pathway resolves to elite PDF template header", () => {
    const clinical = resolvePatientReportTemplateName("post_surgery", "patient");
    const pdfTemplate = normalizeReportTemplateForPdf(clinical);
    assert.equal(pdfTemplate, "elite");
  });
});
