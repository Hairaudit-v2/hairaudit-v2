/**
 * HA-FIX-8C — PDF download missing-file recovery tests.
 * Run: pnpm exec tsx --test tests/reportPdfDownloadRecovery.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchReportPdfWithRecovery,
  REPORT_PDF_MISSING_REGEN_ERROR,
} from "@/lib/reports/reportPdfDownloadRecovery";
import { renderEliteReportHtml, type EliteReportViewModel } from "@/lib/reports/EliteReportHtml";
import { IMAGE_LIMITED_AUDIT_PATIENT_NOTICE } from "@/lib/patient/patientPhotoImageLimitedOverride";
import type { AuditMode, ReportViewModel } from "@/lib/pdf/reportBuilder";

const CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const REPORT = "9909c2d5-23dc-4a34-a214-593f7b52838e";

function makeAuthCtx(pdfPath: string) {
  return {
    ok: true as const,
    report: { id: REPORT, case_id: CASE, pdf_path: pdfPath, version: 2 },
    case: { id: CASE } as never,
    pdfPath,
    storage: {} as never,
    bucket: "case-files",
  };
}

describe("fetchReportPdfWithRecovery", () => {
  it("returns existing file without rebuild when storage fetch succeeds", async () => {
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    const result = await fetchReportPdfWithRecovery(makeAuthCtx(`${CASE}/v2.pdf`), {
      fetchFromStorage: async () => ({ blob, storagePath: `${CASE}/v2.pdf` }),
      rebuildPdf: async () => {
        throw new Error("rebuild should not run");
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.rebuilt, false);
    assert.equal(result.pdfPath, `${CASE}/v2.pdf`);
    assert.equal(await result.blob.text(), "%PDF-1.4");
  });

  it("triggers rebuild when stored PDF is missing", async () => {
    let rebuildCalls = 0;
    let fetchCalls = 0;
    const blob = new Blob(["%PDF-rebuilt"], { type: "application/pdf" });
    const result = await fetchReportPdfWithRecovery(makeAuthCtx(`${CASE}/v2.pdf`), {
      fetchFromStorage: async (_storage, _bucket, path) => {
        fetchCalls += 1;
        if (fetchCalls === 1) return { error: "Object not found" };
        return { blob, storagePath: path };
      },
      rebuildPdf: async () => {
        rebuildCalls += 1;
        return { pdfPath: `${CASE}/v2.pdf` };
      },
    });
    assert.equal(rebuildCalls, 1);
    assert.equal(fetchCalls, 2);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.rebuilt, true);
    assert.equal(await result.blob.text(), "%PDF-rebuilt");
  });

  it("returns clear error when rebuild cannot run (no report data / audit not ready)", async () => {
    const result = await fetchReportPdfWithRecovery(makeAuthCtx(`${CASE}/v2.pdf`), {
      fetchFromStorage: async () => ({ error: "Object not found" }),
      rebuildPdf: async () => {
        throw Object.assign(new Error("AUDIT_NOT_READY: audit summary is incomplete"), {
          code: "AUDIT_NOT_READY",
        });
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, REPORT_PDF_MISSING_REGEN_ERROR);
    assert.equal(result.status, 422);
  });

  it("returns clear error when report version is invalid", async () => {
    const ctx = {
      ...makeAuthCtx(`${CASE}/v0.pdf`),
      report: { id: REPORT, case_id: CASE, pdf_path: `${CASE}/v0.pdf`, version: 0 },
    };
    const result = await fetchReportPdfWithRecovery(ctx, {
      fetchFromStorage: async () => ({ error: "Object not found" }),
      rebuildPdf: async () => {
        throw new Error("should not rebuild");
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, REPORT_PDF_MISSING_REGEN_ERROR);
  });
});

describe("rebuildReportPdf storage path persistence", () => {
  it("persistReportPdfPath updates reports row by id", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/reports/rebuildReportPdf.ts"), "utf8");
    assert.match(src, /persistReportPdfPath/);
    assert.match(src, /\.update\(payload\)\.eq\("id", args\.reportId\)/);
    assert.match(src, /pdf_path: args\.pdfPath/);
  });

  it("download routes use fetchReportPdfWithRecovery", () => {
    const byId = readFileSync(
      join(process.cwd(), "src/app/api/reports/[reportId]/download/route.ts"),
      "utf8"
    );
    const legacy = readFileSync(join(process.cwd(), "src/app/api/reports/download/route.ts"), "utf8");
    assert.match(byId, /fetchReportPdfWithRecovery/);
    assert.match(legacy, /fetchReportPdfWithRecovery/);
    assert.doesNotMatch(byId, /Could not load report file/);
  });

  it("reportAccess falls back to computed pdf path when pdf_path empty", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/reports/reportAccess.ts"), "utf8");
    assert.match(src, /\$\{caseId\}\/v\$\{version\}\.pdf/);
  });
});

describe("image-limited notice in regenerated PDF/HTML builder input", () => {
  it("renderPdfInternal passes imageLimitedAssessment into forensic content", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/reports/renderPdfInternal.ts"), "utf8");
    assert.match(src, /imageLimitedAssessment:/);
    assert.match(src, /missingRequiredPhotoLabels:/);
  });

  it("HTML builder includes image-limited banner when forensic flag set", () => {
    const viewModel = {
      caseId: "recovery-case",
      version: 1,
      generatedAt: "2026-06-24",
      auditMode: "patient" as AuditMode,
      score: 68,
      donorQuality: "Moderate",
      graftSurvival: "Favorable",
      findings: [],
      areaScores: {},
      images: [],
      forensic: {
        key_findings: [],
        red_flags: [],
        imageLimitedAssessment: true,
        documentAssistedAssessment: true,
      },
    } satisfies ReportViewModel;

    const html = renderEliteReportHtml({
      viewModel,
      caseId: "recovery-case",
      generatedAt: "2026-06-24",
      version: 1,
      metrics: {
        donorQuality: "Moderate",
        graftSurvival: "Favorable",
        transectionRisk: "Low",
        implantationDensity: "Limited coverage",
        hairlineNaturalness: "Acceptable",
        donorScarVisibility: "Not assessable",
      },
      areaDomains: [],
      sectionScores: [],
      highlights: [],
      risks: [],
      radar: { labels: ["Donor"], values: [65], overall: 68 },
      photosByCategory: {},
    } satisfies EliteReportViewModel);
    assert.match(html, /Image-limited audit/);
    assert.match(html, new RegExp(IMAGE_LIMITED_AUDIT_PATIENT_NOTICE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("RebuildPdfPanel is wired on auditor case page", () => {
    const page = readFileSync(join(process.cwd(), "src/app/cases/[caseId]/page.tsx"), "utf8");
    const panel = readFileSync(join(process.cwd(), "src/app/cases/[caseId]/RebuildPdfPanel.tsx"), "utf8");
    assert.match(page, /RebuildPdfPanel/);
    assert.match(panel, /Rebuild PDF/);
  });

  it("print route normalizes clinical template to elite for PDF preflight", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/print/report/route.ts"), "utf8");
    assert.match(route, /resolvePdfReportTemplateHeader/);
  });
});
