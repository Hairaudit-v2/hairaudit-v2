import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAuditorOverridesToSummary,
  type OverrideRow,
} from "@/lib/auditor/applyOverrides";

const summaryWithDomains = (aiScores: Record<string, number>): Record<string, unknown> => ({
  score: 71,
  forensic_audit: {
    domain_scores_v1: {
      domains: [
        { domain_id: "SP", raw_score: aiScores.SP ?? 70, weighted_score: (aiScores.SP ?? 70) * 0.15 },
        { domain_id: "DP", raw_score: aiScores.DP ?? 72, weighted_score: (aiScores.DP ?? 72) * 0.25 },
        { domain_id: "GV", raw_score: aiScores.GV ?? 74, weighted_score: (aiScores.GV ?? 74) * 0.2 },
        { domain_id: "IC", raw_score: aiScores.IC ?? 70, weighted_score: (aiScores.IC ?? 70) * 0.25 },
        { domain_id: "DI", raw_score: aiScores.DI ?? 0, weighted_score: 0 },
      ],
    },
    overall_scores_v1: {
      performance_score: 71,
      benchmark_score: 71,
      confidence_grade: "medium",
    },
  },
});

test("applyAuditorOverridesToSummary: with no overrides, overall score is recomputed from domain scores", () => {
  const summary = summaryWithDomains({});
  const result = applyAuditorOverridesToSummary(summary, []);
  const forensic = result.forensic_audit as Record<string, unknown>;
  const overall = forensic?.overall_scores_v1 as { performance_score?: number };
  assert.equal(typeof overall?.performance_score, "number");
  assert.ok(overall!.performance_score! >= 55 && overall!.performance_score! <= 65, "weighted avg of 70,72,74,70,0");
});

test("applyAuditorOverridesToSummary: overall score uses manual scores where overridden", () => {
  const summary = summaryWithDomains({ SP: 80, DP: 82, GV: 78, IC: 75, DI: 0 });
  const overrides: OverrideRow[] = [
    { domain_key: "SP", ai_score: 80, ai_weighted_score: 12, manual_score: 36, manual_weighted_score: 5.4, delta_score: -44 },
    { domain_key: "DP", ai_score: 82, ai_weighted_score: 20.5, manual_score: 35, manual_weighted_score: 8.75, delta_score: -47 },
    { domain_key: "GV", ai_score: 78, ai_weighted_score: 15.6, manual_score: 33, manual_weighted_score: 6.6, delta_score: -45 },
    { domain_key: "IC", ai_score: 75, ai_weighted_score: 18.75, manual_score: 37, manual_weighted_score: 9.25, delta_score: -38 },
    { domain_key: "DI", ai_score: 0, ai_weighted_score: null, manual_score: 0, manual_weighted_score: null, delta_score: 0 },
  ];
  const result = applyAuditorOverridesToSummary(summary, overrides);
  const forensic = result.forensic_audit as Record<string, unknown>;
  const overall = forensic?.overall_scores_v1 as { performance_score?: number };
  assert.equal(typeof overall?.performance_score, "number");
  assert.ok(overall!.performance_score! < 50, "overall should be ~28–29 (weighted avg of 36,35,33,37,0)");
  assert.ok(overall!.performance_score! >= 25 && overall!.performance_score! <= 35, "auditor lower scores should drive overall down");
});

test("applyAuditorOverridesToSummary: domain raw_score and weighted_score updated for overridden domains", () => {
  const summary = summaryWithDomains({ SP: 80, DP: 82 });
  const overrides: OverrideRow[] = [
    { domain_key: "SP", ai_score: 80, ai_weighted_score: 12, manual_score: 36, manual_weighted_score: 5.4, delta_score: -44 },
  ];
  const result = applyAuditorOverridesToSummary(summary, overrides);
  const forensic = result.forensic_audit as Record<string, unknown>;
  const domains = (forensic?.domain_scores_v1 as { domains?: Array<{ domain_id?: string; raw_score?: number; weighted_score?: number }> })?.domains ?? [];
  const sp = domains.find((d) => d.domain_id === "SP");
  assert.equal(sp?.raw_score, 36);
  assert.equal(sp?.weighted_score, 5.4);
  const dp = domains.find((d) => d.domain_id === "DP");
  assert.equal(dp?.raw_score, 82, "DP not overridden should keep AI score");
});

test("applyAuditorOverridesToSummary: no change when forensic_audit missing", () => {
  const summary = { score: 71, other: "data" };
  const overrides: OverrideRow[] = [
    { domain_key: "SP", ai_score: 80, ai_weighted_score: 12, manual_score: 36, manual_weighted_score: 5.4, delta_score: -44 },
  ];
  const result = applyAuditorOverridesToSummary(summary, overrides);
  assert.deepEqual(result, summary);
});
