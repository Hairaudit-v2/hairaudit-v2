/**
 * FI-OUTCOME-INTELLIGENCE-1B — Coverage / denominator / retention tests.
 * Run: pnpm exec tsx --test tests/outcomeCohortCoverage.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assessabilityForStage,
  buildFollowUpRetention,
  buildStageCoverage,
  uniqueProcedureKeys,
} from "@/lib/outcomeIntelligence/cohortCoverage";
import { InMemoryOutcomeCohortRepository } from "@/lib/outcomeIntelligence/cohortRepository";
import { auditRow } from "./outcomeCohortAuditTestHelpers";

describe("FI-OUTCOME-INTELLIGENCE-1B coverage", () => {
  it("1-4. unique procedure denominator ignores duplicate domains and superseded", async () => {
    const repo = new InMemoryOutcomeCohortRepository();
    await repo.insert(auditRow({ procedureKey: "p0", domain: "frontal_framing" }));
    await repo.insert(auditRow({ procedureKey: "p0", domain: "density_distribution" }));
    await repo.insert(
      auditRow({
        procedureKey: "p1",
        current: false,
        comparisonChecksum: "old",
      })
    );
    await repo.insert(auditRow({ procedureKey: "p1", comparisonChecksum: "new" }));

    const current = await repo.listCurrent();
    assert.equal(uniqueProcedureKeys(current).size, 2);
    assert.equal(current.length, 3); // p0×2 domains + p1 current

    const coverage = buildStageCoverage({
      stageRows: current.filter((r) => r.followupStage === "month_12"),
      totalUniqueProcedures: 2,
    });
    assert.equal(coverage.proceduresWithStage, 2);
  });

  it("5-9. stage coverage + follow-up retention maths", async () => {
    const rows = [];
    for (let i = 0; i < 10; i++) {
      const key = `p${i}`;
      rows.push(auditRow({ procedureKey: key, stage: "month_3", status: "not_yet_assessable" }));
      if (i < 8) {
        rows.push(
          auditRow({
            procedureKey: key,
            stage: "month_6",
            status: "partially_consistent",
          })
        );
      }
      if (i < 5) {
        rows.push(auditRow({ procedureKey: key, stage: "month_9", status: "consistent" }));
      }
      if (i < 4) {
        rows.push(auditRow({ procedureKey: key, stage: "month_12", status: "consistent" }));
      }
    }

    const m3 = buildStageCoverage({
      stageRows: rows.filter((r) => r.followupStage === "month_3"),
      totalUniqueProcedures: 10,
    });
    const m6 = buildStageCoverage({
      stageRows: rows.filter((r) => r.followupStage === "month_6"),
      totalUniqueProcedures: 10,
    });
    const m9 = buildStageCoverage({
      stageRows: rows.filter((r) => r.followupStage === "month_9"),
      totalUniqueProcedures: 10,
    });
    const m12 = buildStageCoverage({
      stageRows: rows.filter((r) => r.followupStage === "month_12"),
      totalUniqueProcedures: 10,
    });

    assert.equal(m3.proceduresWithStage, 10);
    assert.equal(m3.proportionOfCohort, 1);
    assert.equal(m3.proceduresOnlyNotYetAssessable, 10);
    assert.equal(m6.proceduresWithStage, 8);
    assert.equal(m9.proceduresWithStage, 5);
    assert.equal(m12.proceduresWithStage, 4);
    assert.equal(m12.proportionOfCohort, 0.4);

    // Early-stage not_yet_assessable is timing, not a data-quality failure by itself
    assert.equal(m3.proceduresWithAssessableDomain, 0);

    const retention = buildFollowUpRetention(rows);
    assert.equal(retention.month3Observed, 10);
    assert.equal(retention.month6Observed, 8);
    assert.equal(retention.month3ToMonth6, 0.8);
    assert.equal(retention.month6ToMonth9, 5 / 8);
    assert.equal(retention.month9ToMonth12, 4 / 5);
  });

  it("10-12. assessability separates timing vs evidence", () => {
    const rows = [
      auditRow({ procedureKey: "a", status: "consistent" }),
      auditRow({ procedureKey: "a", domain: "density_distribution", status: "not_yet_assessable" }),
      auditRow({ procedureKey: "b", status: "not_yet_assessable" }),
      auditRow({ procedureKey: "c", status: "insufficient_evidence" }),
      auditRow({
        procedureKey: "d",
        status: "insufficient_evidence",
        domain: "density_distribution",
      }),
      auditRow({ procedureKey: "d", status: "not_yet_assessable" }),
    ];
    const dist = assessabilityForStage(rows);
    assert.equal(dist.assessable, 1); // a
    assert.equal(dist.notYetAssessable, 1); // b
    assert.equal(dist.insufficientEvidence, 2); // c and d
  });
});
