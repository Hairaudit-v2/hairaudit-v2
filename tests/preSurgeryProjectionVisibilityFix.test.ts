/**
 * HA-PRE-SURGERY-PROJECTION-VISIBILITY-FIX — asset status helpers.
 * Run: pnpm exec tsx --test tests/preSurgeryProjectionVisibilityFix.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyProjectionStoragePath,
  clinicianProjectionLifecycleLabel,
  projectionMatchesCurrentPlan,
} from "../src/lib/preSurgeryIntelligence/projectionAssetStatus";

describe("HA-PRE-SURGERY-PROJECTION-VISIBILITY-FIX asset classification", () => {
  it("flags stub placeholders without attempting signed URLs", () => {
    const a = classifyProjectionStoragePath(
      "pre_surgery_projections/83de37d6/planned/e837d07ae751ec4f.stub"
    );
    assert.equal(a.kind, "stub_placeholder");
    assert.equal(a.canAttemptSignedUrl, false);
    assert.match(a.message, /Stub generation — no image asset produced/);
  });

  it("flags missing paths", () => {
    const a = classifyProjectionStoragePath(null);
    assert.equal(a.kind, "missing_path");
  });

  it("allows signed URL attempts for real image paths", () => {
    const a = classifyProjectionStoragePath(
      "pre_surgery_projections/case/planned/out.jpg"
    );
    assert.equal(a.kind, "image");
    assert.equal(a.canAttemptSignedUrl, true);
  });

  it("detects plan version mismatch for the production case pattern", () => {
    const m = projectionMatchesCurrentPlan({
      projectionGraftPlanId: "5b7cc2c1-ed8c-4b81-9f65-509481b94cf6",
      projectionGraftPlanVersion: 3,
      currentApprovedPlanId: "9301046e-80fa-4cba-9828-01fe3563fdb6",
      currentApprovedPlanVersion: 4,
    });
    assert.equal(m.matches, false);
    assert.match(String(m.reason), /v3/);
    assert.match(String(m.reason), /v4/);
  });

  it("labels clinical lifecycle states", () => {
    assert.equal(clinicianProjectionLifecycleLabel("approved"), "Clinically approved");
    assert.equal(clinicianProjectionLifecycleLabel("failed"), "Generation failed");
  });
});
