/**
 * FI-OUTCOME-INTELLIGENCE-1B — Small-cell suppression tests.
 * Run: pnpm exec tsx --test tests/outcomeCohortSuppression.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSafeDistribution,
  suppressCount,
} from "@/lib/outcomeIntelligence/cohortCoverage";
import { createOutcomeCohortDataQualityAuditService } from "@/lib/outcomeIntelligence/cohortDataQualityAudit";
import { InMemoryOutcomeCohortRepository } from "@/lib/outcomeIntelligence/cohortRepository";
import { auditRow } from "./outcomeCohortAuditTestHelpers";

describe("FI-OUTCOME-INTELLIGENCE-1B suppression", () => {
  it("26-29. n=9 suppressed; n=10 visible; cannot bypass via domain rows", () => {
    const small = new Map<string, Set<string>>();
    small.set(
      "fue",
      new Set(Array.from({ length: 9 }, (_, i) => `p${i}`))
    );
    const s = buildSafeDistribution({ categoryToProcedures: small, minCohortSize: 10 });
    assert.equal(s.ok, false);

    const okMap = new Map<string, Set<string>>();
    okMap.set(
      "fue",
      new Set(Array.from({ length: 10 }, (_, i) => `p${i}`))
    );
    const ok = buildSafeDistribution({ categoryToProcedures: okMap, minCohortSize: 10 });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.total, 10);

    // 20 domain-rows from 9 procedures still suppressed
    const fakeRows = new Map<string, Set<string>>();
    fakeRows.set("fue", new Set(Array.from({ length: 9 }, (_, i) => `p${i}`)));
    assert.equal(
      buildSafeDistribution({ categoryToProcedures: fakeRows, minCohortSize: 10 }).ok,
      false
    );
  });

  it("30. adjacent metrics do not trivially reveal suppressed small cell", () => {
    // 12 procedures: 10 fue + 1 fut + 1 combo → collapsing other=2 < 10 → full suppress
    const map = new Map<string, Set<string>>();
    map.set("fue", new Set(Array.from({ length: 10 }, (_, i) => `f${i}`)));
    map.set("fut", new Set(["x"]));
    map.set("combo", new Set(["y"]));
    const dist = buildSafeDistribution({ categoryToProcedures: map, minCohortSize: 10 });
    assert.equal(dist.ok, false);
    // Must not return fue=10 which would reveal residual=2
    if (dist.ok) assert.fail("expected suppression");
  });

  it("filtered subgroup rechecks threshold; zone suppressCount", async () => {
    assert.equal(suppressCount(9, 10), "insufficient_cohort_size");
    assert.equal(suppressCount(10, 10), 10);
    assert.equal(suppressCount(0, 10), 0);

    const repo = new InMemoryOutcomeCohortRepository();
    for (let i = 0; i < 12; i++) {
      await repo.insert(
        auditRow({
          procedureKey: `p${i}`,
          graft: i < 11 ? "2500_3499" : "under_1500",
        })
      );
    }
    const service = createOutcomeCohortDataQualityAuditService({
      cohortRepository: repo,
      materializationEnabled: true,
    });
    const audit = await service.runCohortDataQualityAudit();
    // graft distribution has a small cell → entire distribution suppressed
    assert.equal(audit.procedureContextCoverage.graftCountBand.ok, false);
  });
});
