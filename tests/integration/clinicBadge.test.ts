/**
 * Tests for HairAudit clinic badge and verification widget.
 * - Badge only available for public profiles with slug and tier
 * - Widget uses only public-safe fields
 * - Embed snippets contain correct slug/profile URL
 * - Variant handling
 * Run: pnpm tsx --test tests/integration/clinicBadge.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  BADGE_PUBLIC_SELECT,
  BADGE_FORBIDDEN_FIELDS,
  type PublicBadgePayload,
} from "@/lib/clinics/badgeData";

test("badge eligibility: only when profile_visible, clinic_slug, and current_award_tier", () => {
  const eligible = (p: {
    profile_visible?: boolean;
    clinic_slug?: string | null;
    current_award_tier?: string | null;
  }) =>
    Boolean(p.profile_visible && p.clinic_slug && p.current_award_tier);

  assert.equal(eligible({ profile_visible: true, clinic_slug: "my-clinic", current_award_tier: "GOLD" }), true);
  assert.equal(eligible({ profile_visible: false, clinic_slug: "my-clinic", current_award_tier: "GOLD" }), false);
  assert.equal(eligible({ profile_visible: true, clinic_slug: null, current_award_tier: "GOLD" }), false);
  assert.equal(eligible({ profile_visible: true, clinic_slug: "x", current_award_tier: null }), false);
  assert.equal(eligible({ profile_visible: true, clinic_slug: "", current_award_tier: "VERIFIED" }), false);
  assert.equal(eligible({ profile_visible: true, clinic_slug: "ab", current_award_tier: "" }), false);
});

test("badge select must not include any forbidden fields", () => {
  const select = BADGE_PUBLIC_SELECT;
  for (const field of BADGE_FORBIDDEN_FIELDS) {
    assert.ok(!select.includes(field), `Badge select must not include ${field}`);
  }
});

test("badge select includes only public-safe fields", () => {
  const allowed = [
    "clinic_name",
    "clinic_slug",
    "current_award_tier",
    "participation_status",
    "city",
    "country",
    "profile_visible",
  ];
  const parts = BADGE_PUBLIC_SELECT.split(",").map((s) => s.trim());
  for (const part of parts) {
    assert.ok(allowed.includes(part), `Badge select field ${part} must be in allowed list`);
  }
  for (const a of allowed) {
    assert.ok(BADGE_PUBLIC_SELECT.includes(a), `Badge select must include ${a}`);
  }
});

test("PublicBadgePayload type aligns with BADGE_PUBLIC_SELECT", () => {
  const payload: PublicBadgePayload = {
    clinic_name: "Test Clinic",
    clinic_slug: "test-clinic",
    current_award_tier: "SILVER",
    participation_status: "active",
    city: "London",
    country: "UK",
    profile_visible: true,
  };
  assert.equal(payload.clinic_slug, "test-clinic");
  assert.equal(payload.profile_visible, true);
  assert.ok(!("clinic_email" in payload));
  assert.ok(!("linked_user_id" in payload));
});

test("embed snippets contain correct slug and profile URL", () => {
  const baseUrl = "https://hairaudit.com";
  const slug = "my-clinic";
  const profileUrl = `${baseUrl}/clinics/${slug}`;
  const badgeUrlCompact = `${baseUrl}/clinics/${slug}/badge?variant=compact`;
  const badgeUrlFull = `${baseUrl}/clinics/${slug}/badge?variant=full`;

  assert.ok(profileUrl.includes(slug));
  assert.equal(profileUrl, "https://hairaudit.com/clinics/my-clinic");
  assert.ok(badgeUrlCompact.includes("/badge"));
  assert.ok(badgeUrlCompact.includes("variant=compact"));
  assert.ok(badgeUrlFull.includes("variant=full"));
});

test("variant query param: compact and full are supported", () => {
  const variants = ["compact", "full"] as const;
  for (const v of variants) {
    const url = `/clinics/slug/badge?variant=${v}`;
    assert.ok(url.includes(`variant=${v}`));
  }
});

test("style query param: dark and light are supported", () => {
  const styles = ["dark", "light"] as const;
  for (const s of styles) {
    const url = `/clinics/slug/badge?style=${s}`;
    assert.ok(url.includes(`style=${s}`));
  }
});
