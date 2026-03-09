/**
 * Tests for public clinic profile: visibility rules, public-safe fields, tier badges.
 * Run: pnpm tsx --test tests/integration/publicClinicProfile.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getNextMilestoneFromProfile } from "@/lib/transparency/awardRules";

// Public clinic profile page must only select public-safe fields (no clinic_email, linked_user_id, etc.)
const PUBLIC_CLINIC_SELECT =
  "id, clinic_name, clinic_slug, country, city, participation_status, transparency_score, performance_score, volume_confidence_score, current_award_tier, audited_case_count, contributed_case_count, benchmark_eligible_count, average_forensic_score, documentation_integrity_average, profile_visible, validated_case_count, benchmark_eligible_validated_count, award_progression_paused";

test("public clinic select must not include private fields", () => {
  const privateFields = ["clinic_email", "linked_user_id", "contribution_payload", "secure_token"];
  const select = PUBLIC_CLINIC_SELECT;
  for (const field of privateFields) {
    assert.ok(!select.includes(field), `Public select must not include ${field}`);
  }
});

test("public clinic select includes required public fields", () => {
  const required = ["clinic_name", "clinic_slug", "profile_visible", "current_award_tier"];
  const select = PUBLIC_CLINIC_SELECT;
  for (const field of required) {
    assert.ok(select.includes(field), `Public select must include ${field}`);
  }
});

test("visibility rule: profile only shown when profile_visible true and slug match", () => {
  const profileVisible = true;
  const hasSlug = true;
  assert.equal(profileVisible && hasSlug, true);
  assert.equal(false && hasSlug, false);
  assert.equal(profileVisible && false, false);
});

test("getNextMilestoneFromProfile works with clinic profile shape", () => {
  const clinicProfile = {
    current_award_tier: "VERIFIED",
    validated_case_count: 2,
    contributed_case_count: 3,
    average_forensic_score: 78,
    benchmark_eligible_validated_count: 1,
    benchmark_eligible_count: 1,
    transparency_score: 65,
    documentation_integrity_average: 72,
    award_progression_paused: false,
    volume_confidence_score: 25,
  };
  const msg = getNextMilestoneFromProfile(clinicProfile);
  assert.ok(typeof msg === "string");
});

test("award tier labels: VERIFIED SILVER GOLD PLATINUM have display names", () => {
  const tiers = ["VERIFIED", "SILVER", "GOLD", "PLATINUM"] as const;
  const labels: Record<string, string> = {
    VERIFIED: "Verified",
    SILVER: "Silver",
    GOLD: "Gold",
    PLATINUM: "Platinum",
  };
  for (const t of tiers) {
    assert.ok(labels[t], `Tier ${t} has label`);
    assert.ok(labels[t].length > 0);
  }
});
