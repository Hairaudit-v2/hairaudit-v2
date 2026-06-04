import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

/** Strip // full-line and /* block *\/ comments so assertions ignore REGRESSION GUARD docs. */
function stripTsLineAndBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("Stage 8 evidence-workspace API route must not reference legacy submit pipeline", () => {
  const route = stripTsLineAndBlockComments(
    readSrc("src/app/api/admin/hair-audit/surgery-upload/[caseId]/evidence-workspace/route.ts")
  );
  assert.ok(!route.includes("case/submitted"), "must not emit case/submitted");
  assert.ok(!route.includes("/api/submit"), "must not call /api/submit");
  assert.ok(!route.includes("submitted_at"), "must not touch submitted_at");
  assert.ok(!route.includes("cases.status"), "must not touch cases.status");
  assert.ok(!route.includes('.from("cases").update'), "must not update cases");
});

test("Stage 8 SurgeryUploadEvidenceWorkspace client must not call /api/submit", () => {
  const src = stripTsLineAndBlockComments(readSrc("src/components/surgery-upload/SurgeryUploadEvidenceWorkspace.tsx"));
  assert.ok(!src.includes("/api/submit"));
  assert.ok(!src.includes("case/submitted"));
});

test("Stage 8 evidenceReviewWorkspace lib must not reference legacy submit", () => {
  const src = stripTsLineAndBlockComments(readSrc("src/lib/surgeryUpload/evidenceReviewWorkspace.ts"));
  assert.ok(!src.includes("/api/submit"));
  assert.ok(!src.includes("case/submitted"));
});
