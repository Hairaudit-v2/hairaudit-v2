/**
 * HA-PUBLIC-PATHWAY-CTA-STYLE-FIX-1A — public pathway CTA hierarchy + styling.
 * Run: pnpm tsx --test tests/publicPathwayCtaStyle.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  fiHairauditPrimaryButtonClass,
  fiHairauditSecondaryButtonClass,
} from "@/lib/fi-ui/hairauditPrimaryButton";
import { isPathwayCtaPrimary } from "@/lib/marketing/pathwayCtaHierarchy";

test("isPathwayCtaPrimary: Pre-Surgery is featured by default", () => {
  assert.equal(isPathwayCtaPrimary("pre_surgery"), true);
  assert.equal(isPathwayCtaPrimary("post_surgery"), false);
});

test("isPathwayCtaPrimary: donor-entry highlight elevates Post-Surgery", () => {
  assert.equal(isPathwayCtaPrimary("post_surgery", { highlightPostSurgery: true }), true);
  assert.equal(isPathwayCtaPrimary("pre_surgery", { highlightPostSurgery: true }), false);
});

test("fiHairauditPrimaryButtonClass uses HairAudit gold treatment", () => {
  const cls = fiHairauditPrimaryButtonClass("lg");
  assert.match(cls, /bg-amber-500/);
  assert.match(cls, /text-slate-900/);
  assert.doesNotMatch(cls, /from-white\/14/);
  assert.doesNotMatch(cls, /bg-gradient-to-b/);
  assert.doesNotMatch(cls, /\bcursor-not-allowed\b/);
  // Permanently muted look is banned; disabled:opacity-50 only applies when genuinely disabled.
  assert.doesNotMatch(cls, /(?<!disabled:)opacity-50/);
});

test("fiHairauditSecondaryButtonClass stays distinct from gold primary", () => {
  const primary = fiHairauditPrimaryButtonClass("lg");
  const secondary = fiHairauditSecondaryButtonClass("lg");
  assert.match(secondary, /border-white\/30|border-border/);
  assert.doesNotMatch(secondary, /bg-amber-500/);
  assert.notEqual(primary, secondary);
});

test("StartFreeAuditButton only disables during busy — never on missing profile/user", () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), "src/components/audit/StartFreeAuditButton.tsx"),
    "utf8"
  );
  assert.match(src, /disabled=\{busy\}/);
  assert.doesNotMatch(src, /disabled=\{\s*!profile/);
  assert.doesNotMatch(src, /disabled=\{\s*!user/);
  assert.doesNotMatch(src, /aria-disabled/);
  assert.doesNotMatch(src, /authLoading|profileLoading/);
});

test("PatientPathwayChooser uses hierarchy helper (not inverted post_surgery primary)", () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), "src/components/marketing/PatientPathwayChooser.tsx"),
    "utf8"
  );
  assert.match(src, /isPathwayCtaPrimary/);
  assert.match(src, /fiHairauditPrimaryButtonClass/);
  assert.match(src, /fiHairauditSecondaryButtonClass/);
  assert.doesNotMatch(src, /isPrimary = pathway === "post_surgery"/);
  assert.doesNotMatch(src, /disabled=\{\s*!profile/);
  assert.doesNotMatch(src, /disabled=\{\s*!user/);
});
