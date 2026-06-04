import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { filterForensicAuditReports } from "@/lib/reports/forensicReportsFilter";
import { SURGERY_UPLOAD_REPORT_KIND_EVIDENCE_REVIEW_V1 } from "@/lib/surgeryUpload/surgeryUploadReportPipelineStage7a";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

/** Strip // full-line and /* block *\/ comments so assertions ignore REGRESSION GUARD docs. */
function stripTsLineAndBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("filterForensicAuditReports excludes evidence review report_kind so it cannot become latest forensic row", () => {
  const rows = [
    {
      id: "ev",
      version: 3,
      created_at: "2026-01-02T00:00:00Z",
      pdf_path: "/ev.pdf",
      report_kind: SURGERY_UPLOAD_REPORT_KIND_EVIDENCE_REVIEW_V1,
    },
    {
      id: "forensic",
      version: 2,
      created_at: "2026-01-01T00:00:00Z",
      pdf_path: "/f.pdf",
      report_kind: null,
    },
  ] as const;
  const forensic = filterForensicAuditReports([...rows]);
  assert.equal(forensic.length, 1);
  assert.equal(forensic[0].id, "forensic");
  assert.notEqual(rows[0].id, forensic[0].id);
});

test("Stage 7B request route source must not reference legacy submit pipeline", () => {
  const route = stripTsLineAndBlockComments(
    readSrc("src/app/api/admin/hair-audit/surgery-upload/[caseId]/request-report/route.ts")
  );
  assert.ok(!route.includes("case/submitted"), "must not emit case/submitted");
  assert.ok(!route.includes("/api/submit"), "must not call /api/submit");
});

test("Stage 7B Inngest evidence report job must not emit case/submitted or touch cases table", () => {
  const fn = stripTsLineAndBlockComments(readSrc("src/lib/inngest/functions/surgeryUploadEvidenceReviewReport.ts"));
  assert.ok(!fn.includes("case/submitted"));
  assert.ok(!fn.includes("/api/submit"));
  assert.ok(!fn.includes("submitted_at"));
  assert.ok(!fn.includes('from("cases")'));
});
