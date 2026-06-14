import { describe, it } from "node:test";
import assert from "node:assert";
import {
  resolveReportCaseId,
  storagePathBelongsToReportCase,
  type ReportRowForAccess,
} from "../src/lib/reports/reportAccess";

const CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const OTHER = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

describe("storagePathBelongsToReportCase", () => {
  it("accepts cases/{uuid}/reports/ layout", () => {
    const p = `cases/${CASE}/reports/v3.pdf`;
    assert.strictEqual(storagePathBelongsToReportCase(CASE, p), true);
    assert.strictEqual(storagePathBelongsToReportCase(OTHER, p), false);
  });

  it("accepts legacy two-segment v PDF key", () => {
    const p = `${CASE}/v1.pdf`;
    assert.strictEqual(storagePathBelongsToReportCase(CASE, p), true);
  });

  it("rejects traversal", () => {
    assert.strictEqual(storagePathBelongsToReportCase(CASE, `cases/${CASE}/../${OTHER}/reports/v1.pdf`), false);
  });

  it("rejects pdf_path pointing at a different case (tampered row)", () => {
    assert.strictEqual(storagePathBelongsToReportCase(CASE, `cases/${OTHER}/reports/v1.pdf`), false);
  });
});

describe("resolveReportCaseId", () => {
  it("reads case_id", () => {
    const r: ReportRowForAccess = { id: "r1", case_id: CASE, pdf_path: "x" };
    assert.strictEqual(resolveReportCaseId(r), CASE);
  });
});
