import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  detectActualFileType,
  validateImageMagicBytes,
  rejectSvgUploads,
  rejectUnknownBinary,
  enforceMaxFileSize,
  validateUploadedImage,
} from "../src/lib/uploads/fileValidation";
import { MAX_IMAGE_UPLOAD_BYTES } from "../src/lib/uploads/uploadLimits";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

async function tinyPng(): Promise<Buffer> {
  return sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
}

const IMAGE_UPLOAD_ROUTES_RELATIVE = [
  "src/app/api/uploads/patient-photos/route.ts",
  "src/app/api/uploads/doctor-photos/route.ts",
  "src/app/api/uploads/clinic-photos/route.ts",
  "src/app/api/uploads/audit-photos/route.ts",
  "src/app/api/surgery-upload/photos/route.ts",
  "src/app/api/academy/uploads/route.ts",
  "src/app/api/admin/hair-audit/bulk-upload/images/route.ts",
] as const;

function fileFromBuffer(buf: Buffer, name: string, mime?: string) {
  return new File([buf], name, { type: mime ?? "application/octet-stream" });
}

describe("fileValidation (Stage 1D)", () => {
  describe("detectActualFileType / validateImageMagicBytes", () => {
    it("detects JPEG signature", () => {
      const b = Buffer.alloc(16, 0);
      b[0] = 0xff;
      b[1] = 0xd8;
      b[2] = 0xff;
      assert.strictEqual(detectActualFileType(b), "jpeg");
      assert.strictEqual(validateImageMagicBytes(b), true);
    });

    it("detects PNG signature", async () => {
      const png = await tinyPng();
      assert.strictEqual(detectActualFileType(png), "png");
      assert.strictEqual(validateImageMagicBytes(png), true);
    });

    it("rejects random bytes as unknown", () => {
      const b = Buffer.from("hello world!!!!", "utf8");
      assert.strictEqual(detectActualFileType(b), "unknown");
      assert.strictEqual(validateImageMagicBytes(b), false);
    });
  });

  describe("rejectUnknownBinary", () => {
    it("rejects MZ (exe) even if filename says .jpg", async () => {
      const png = await tinyPng();
      const b = Buffer.concat([Buffer.from("MZ", "ascii"), png.subarray(2)]);
      assert.strictEqual(rejectUnknownBinary(b), true);
    });

    it("rejects PDF signature", () => {
      const b = Buffer.from("%PDF-1.4\n", "ascii");
      assert.strictEqual(rejectUnknownBinary(b), true);
    });
  });

  describe("rejectSvgUploads", () => {
    it("flags SVG / XML", () => {
      const b = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8");
      assert.strictEqual(rejectSvgUploads(b), true);
    });
  });

  describe("enforceMaxFileSize", () => {
    it("rejects when over max", () => {
      const err = enforceMaxFileSize(MAX_IMAGE_UPLOAD_BYTES + 1, MAX_IMAGE_UPLOAD_BYTES);
      assert.ok(err);
      assert.strictEqual(err!.code, "FILE_TOO_LARGE");
    });
  });

  describe("validateUploadedImage", () => {
    it("accepts valid PNG", async () => {
      const png = await tinyPng();
      const f = fileFromBuffer(png, "x.png", "image/png");
      const r = await validateUploadedImage(f);
      assert.strictEqual(r.ok, true);
      if (r.ok) {
        assert.strictEqual(r.normalizedMime, "image/png");
        assert.ok(r.buffer.length > 0);
      }
    });

    it("accepts valid JPEG from Sharp", async () => {
      const png = await tinyPng();
      const jpegBuf = await sharp(png).jpeg().toBuffer();
      const f = fileFromBuffer(jpegBuf, "photo.jpg", "image/jpeg");
      const r = await validateUploadedImage(f);
      assert.strictEqual(r.ok, true);
      if (r.ok) assert.strictEqual(r.normalizedMime, "image/jpeg");
    });

    it("accepts valid WebP from Sharp", async () => {
      const png = await tinyPng();
      const webpBuf = await sharp(png).webp().toBuffer();
      const f = fileFromBuffer(webpBuf, "x.webp", "image/webp");
      const r = await validateUploadedImage(f);
      assert.strictEqual(r.ok, true);
      if (r.ok) assert.strictEqual(r.normalizedMime, "image/webp");
    });

    it("rejects fake exe (MZ) renamed as image", async () => {
      const b = Buffer.concat([Buffer.from("MZ", "ascii"), Buffer.alloc(400, 0x41)]);
      const f = fileFromBuffer(b, "evil.jpg", "image/jpeg");
      const r = await validateUploadedImage(f);
      assert.strictEqual(r.ok, false);
      if (!r.ok) assert.ok(/unsafe|Unsupported/i.test(r.error.message));
    });

    it("rejects SVG disguised as PNG by sniffing", async () => {
      const png = await tinyPng();
      const b = Buffer.concat([
        png.subarray(0, 8),
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>', "utf8"),
      ]);
      const f = fileFromBuffer(b, "trick.png", "image/png");
      const r = await validateUploadedImage(f);
      assert.strictEqual(r.ok, false);
    });

    it("rejects invalid magic / garbage", async () => {
      const f = fileFromBuffer(Buffer.from("not-an-image"), "a.jpg", "image/jpeg");
      const r = await validateUploadedImage(f);
      assert.strictEqual(r.ok, false);
    });

    it("rejects when file.size exceeds custom maxBytes", async () => {
      const png = await tinyPng();
      const f = fileFromBuffer(png, "big.png", "image/png");
      const r = await validateUploadedImage(f, { maxBytes: 10 });
      assert.strictEqual(r.ok, false);
      if (!r.ok) assert.strictEqual(r.error.code, "FILE_TOO_LARGE");
    });
  });

  describe("image upload API routes", () => {
    it("all use validateUploadedImage from fileValidation", () => {
      const needle = 'from "@/lib/uploads/fileValidation"';
      for (const rel of IMAGE_UPLOAD_ROUTES_RELATIVE) {
        const abs = join(repoRoot, rel);
        assert.ok(existsSync(abs), `missing route file: ${rel}`);
        const src = readFileSync(abs, "utf8");
        assert.ok(
          src.includes("validateUploadedImage") && src.includes(needle),
          `expected validateUploadedImage import in ${rel}`
        );
      }
    });
  });
});
