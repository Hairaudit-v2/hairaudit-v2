import test from "node:test";
import assert from "node:assert/strict";
import { maybePostProcessAuditPdf } from "@/lib/pdf/maybePostProcessAuditPdf";

test("maybePostProcessAuditPdf returns original when linearization disabled", async () => {
  const prev = process.env.PDF_ENABLE_LINEARIZATION;
  process.env.PDF_ENABLE_LINEARIZATION = "false";
  try {
    const buf = Buffer.from("%PDF-1.4 test");
    const r = await maybePostProcessAuditPdf(buf);
    assert.equal(r.linearized, false);
    assert.deepEqual(r.buffer, buf);
  } finally {
    process.env.PDF_ENABLE_LINEARIZATION = prev;
  }
});
