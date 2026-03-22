import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { optimizeRasterBufferForPrintPdf } from "@/lib/pdf/optimizeRasterForPrintPdf";

test("optimizeRasterBufferForPrintPdf returns jpeg data URL for opaque raster", async () => {
  const buf = await sharp({
    create: { width: 1200, height: 900, channels: 3, background: { r: 180, g: 120, b: 90 } },
  })
    .png()
    .toBuffer();

  const out = await optimizeRasterBufferForPrintPdf(buf);
  assert.ok(out);
  assert.match(out.dataUrl, /^data:image\/jpeg;base64,/);
  assert.ok(out.bytesOut > 0);
  assert.ok(out.bytesOut <= out.bytesIn);
});

test("optimizeRasterBufferForPrintPdf keeps png when alpha present", async () => {
  const buf = await sharp({
    create: { width: 400, height: 400, channels: 4, background: { r: 10, g: 200, b: 100, alpha: 0.5 } },
  })
    .png()
    .toBuffer();

  const out = await optimizeRasterBufferForPrintPdf(buf);
  assert.ok(out);
  assert.match(out.dataUrl, /^data:image\/png;base64,/);
});

test("optimizeRasterBufferForPrintPdf skips re-encode when within max edge", async () => {
  const buf = await sharp({
    create: { width: 600, height: 600, channels: 3, background: "#e5e7eb" },
  })
    .jpeg({ quality: 92 })
    .toBuffer();

  const out = await optimizeRasterBufferForPrintPdf(buf);
  assert.ok(out);
  assert.equal(out.skippedReencode, true);
  assert.equal(out.bytesOut, out.bytesIn);
  assert.match(out.dataUrl, /^data:image\/jpeg;base64,/);
});
