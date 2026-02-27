/**
 * On Vercel (Linux), remove @napi-rs/canvas platform packages we don't need.
 * Keeps only linux-x64-gnu. Saves ~400MB+ from deployment.
 * No-op when VERCEL is not set (local dev).
 */
const fs = require("fs");
const path = require("path");

if (process.env.VERCEL !== "1") process.exit(0);

const root = path.resolve(__dirname, "..");
const nm = path.join(root, "node_modules");

const KEEP = "canvas-linux-x64-gnu";
const REMOVE = [
  "canvas-darwin-x64",
  "canvas-darwin-arm64",
  "canvas-win32-x64-msvc",
  "canvas-win32-arm64-msvc",
  "canvas-linux-arm-gnueabihf",
  "canvas-linux-x64-musl",
  "canvas-linux-arm64-gnu",
  "canvas-linux-arm64-musl",
  "canvas-android-arm64",
  "canvas-linux-riscv64-gnu",
];

for (const pkg of REMOVE) {
  const dir = path.join(nm, `@napi-rs`, pkg);
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true });
      console.log(`[strip-canvas] removed @napi-rs/${pkg}`);
    } catch (e) {
      console.warn(`[strip-canvas] failed to remove ${pkg}:`, e.message);
    }
  }
}
