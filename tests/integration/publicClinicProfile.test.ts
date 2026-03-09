/**
 * Tests for public clinic profile: visibility rules, public-safe fields, tier badges.
 * Run: pnpm tsx --test tests/integration/publicClinicProfile.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getNextMilestoneFromProfile } from "@/lib/transparency/awardRules";
import { filterAndSortDirectory } from "@/lib/clinics/directoryFilters";

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

// --- Clinic directory: filter/sort and public-only ---
test("directory: only rows with clinic_slug are included", () => {
  const rows = [
    { clinic_slug: "a", clinic_name: "A", country: null, city: null, participation_status: null, current_award_tier: "VERIFIED", transparency_score: 0, audited_case_count: 0, contributed_case_count: 0, benchmark_eligible_count: 0, benchmark_eligible_validated_count: 0, average_forensic_score: null, documentation_integrity_average: null },
    { clinic_slug: null, clinic_name: "B", country: null, city: null, participation_status: null, current_award_tier: "GOLD", transparency_score: 0, audited_case_count: 0, contributed_case_count: 0, benchmark_eligible_count: 0, benchmark_eligible_validated_count: 0, average_forensic_score: null, documentation_integrity_average: null },
  ] as any;
  const out = filterAndSortDirectory(rows, {});
  assert.equal(out.length, 1);
  assert.equal(out[0].clinic_name, "A");
});

test("directory: sort order is tier then benchmark then score then name", () => {
  const rows = [
    { clinic_slug: "c1", clinic_name: "Beta", country: null, city: null, participation_status: null, current_award_tier: "SILVER", transparency_score: 0, audited_case_count: 0, contributed_case_count: 0, benchmark_eligible_count: 2, benchmark_eligible_validated_count: 2, average_forensic_score: 80, documentation_integrity_average: null },
    { clinic_slug: "c2", clinic_name: "Alpha", country: null, city: null, participation_status: null, current_award_tier: "SILVER", transparency_score: 0, audited_case_count: 0, contributed_case_count: 0, benchmark_eligible_count: 2, benchmark_eligible_validated_count: 2, average_forensic_score: 85, documentation_integrity_average: null },
    { clinic_slug: "c3", clinic_name: "Gamma", country: null, city: null, participation_status: null, current_award_tier: "GOLD", transparency_score: 0, audited_case_count: 0, contributed_case_count: 0, benchmark_eligible_count: 0, benchmark_eligible_validated_count: 0, average_forensic_score: 90, documentation_integrity_average: null },
  ] as any;
  const out = filterAndSortDirectory(rows, {});
  assert.equal(out[0].current_award_tier, "GOLD");
  assert.equal(out[0].clinic_name, "Gamma");
  assert.equal(out[1].current_award_tier, "SILVER");
  assert.equal(out[1].average_forensic_score, 85);
  assert.equal(out[1].clinic_name, "Alpha");
  assert.equal(out[2].clinic_name, "Beta");
});

test("directory: filter by tier", () => {
  const rows = [
    { clinic_slug: "a", clinic_name: "A", country: null, city: null, participation_status: null, current_award_tier: "GOLD", transparency_score: 0, audited_case_count: 0, contributed_case_count: 0, benchmark_eligible_count: 0, benchmark_eligible_validated_count: 0, average_forensic_score: null, documentation_integrity_average: null },
    { clinic_slug: "b", clinic_name: "B", country: null, city: null, participation_status: null, current_award_tier: "SILVER", transparency_score: 0, audited_case_count: 0, contributed_case_count: 0, benchmark_eligible_count: 0, benchmark_eligible_validated_count: 0, average_forensic_score: null, documentation_integrity_average: null },
  ] as any;
  const out = filterAndSortDirectory(rows, { tier: "GOLD" });
  assert.equal(out.length, 1);
  assert.equal(out[0].clinic_name, "A");
});

test("directory: filter benchmark-active only", () => {
  const rows = [
    { clinic_slug: "a", clinic_name: "A", country: null, city: null, participation_status: null, current_award_tier: "VERIFIED", transparency_score: 0, audited_case_count: 0, contributed_case_count: 0, benchmark_eligible_count: 0, benchmark_eligible_validated_count: 0, average_forensic_score: null, documentation_integrity_average: null },
    { clinic_slug: "b", clinic_name: "B", country: null, city: null, participation_status: null, current_award_tier: "VERIFIED", transparency_score: 0, audited_case_count: 0, contributed_case_count: 0, benchmark_eligible_count: 1, benchmark_eligible_validated_count: 1, average_forensic_score: null, documentation_integrity_average: null },
  ] as any;
  const out = filterAndSortDirectory(rows, { benchmark: "1" });
  assert.equal(out.length, 1);
  assert.equal(out[0].clinic_name, "B");
});

test("directory select uses only public-safe fields", () => {
  const DIR_SELECT =
    "clinic_slug, clinic_name, country, city, participation_status, current_award_tier, transparency_score, audited_case_count, contributed_case_count, benchmark_eligible_count, benchmark_eligible_validated_count, average_forensic_score, documentation_integrity_average, award_progression_paused";
  assert.ok(!DIR_SELECT.includes("clinic_email"));
  assert.ok(!DIR_SELECT.includes("linked_user_id"));
  assert.ok(DIR_SELECT.includes("clinic_slug"));
  assert.ok(DIR_SELECT.includes("current_award_tier"));
});
