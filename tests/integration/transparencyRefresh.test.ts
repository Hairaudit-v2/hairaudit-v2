/**
 * Tests for transparency refresh orchestration.
 * Run: pnpm tsx --test tests/integration/transparencyRefresh.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveProfileIdsForCase,
  refreshTransparencyMetricsForCase,
} from "@/lib/transparency/refreshOrchestration";

function mockAdminEmpty() {
  return {
    from: (table: string) => {
      if (table === "case_contribution_requests")
        return { select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) };
      if (table === "cases")
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
      return { select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) };
    },
  } as any;
}

test("resolveProfileIdsForCase: returns null ids when no requests or case", async () => {
  const admin = mockAdminEmpty();
  const result = await resolveProfileIdsForCase(admin, "test-case-id");
  assert.equal(result.clinicProfileId, null);
  assert.equal(result.doctorProfileId, null);
});

test("refreshTransparencyMetricsForCase: returns shape when no profiles resolved", async () => {
  const admin = mockAdminEmpty();
  const result = await refreshTransparencyMetricsForCase(admin, "test-case-id");
  assert.equal(result.clinicRefreshed, false);
  assert.equal(result.doctorRefreshed, false);
});
