/**
 * HA-PROJECTION-1C — Patient projected result report.
 * Run: pnpm exec tsx --test tests/surgeryDayProjectionReport.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildSurgeryDayProjectionReport,
  extractAssessmentTypeFromSummary,
  resolveReportPresentationTemplateName,
  resolveSurgeryDayProjectionReport,
  shouldUseSurgeryDayProjectionReportTemplate,
} from "@/lib/reports/surgeryDayProjectionReport";
import { renderSurgeryDayProjectionReportHtml } from "@/lib/reports/SurgeryDayProjectionReportHtml";
import { resolvePatientReportTemplateName } from "@/lib/reports/preSurgeryPlanningReport";
import { shouldUsePostSurgeryReportTemplate } from "@/lib/reports/postSurgeryAuditReport";
import { shouldUsePreSurgeryReportTemplate } from "@/lib/reports/preSurgeryPlanningReport";
import { normalizeReportTemplateForPdf } from "@/lib/pdf/normalizeReportTemplateForPdf";
import { findUnsafeProjectionClaims } from "@/lib/projection/surgeryDayProjectionSafety";
import { buildSurgeryDayProcedureReconstruction } from "@/lib/projection/surgeryDayProcedureReconstruction";
import { buildSurgeryDayProjectedOutcome } from "@/lib/projection/surgeryDayProjectedOutcome";
import type { SurgeryDayProcedureReconstruction } from "@/lib/projection/types";
import {
  fixtureA_baselinePlusSurgeryDay,
  fixtureB_surgeryDayOnly,
  fixtureC_limitedNoDonor,
  fixtureE_conflictingGrafts,
  SYNTHETIC_PHOTOS_BY_CATEGORY,
} from "./fixtures/surgeryDayProjection/fixtures";

const CASE_ID = "00000000-0000-4000-8000-0000000001c1";

function htmlVisible(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ");
}

function renderPair(
  pair: ReturnType<typeof fixtureA_baselinePlusSurgeryDay>,
  photos = SYNTHETIC_PHOTOS_BY_CATEGORY
) {
  const built = buildSurgeryDayProjectionReport({
    reconstruction: pair.reconstruction,
    projectedOutcome: pair.projectedOutcome,
    caseId: CASE_ID,
    reportVersion: 1,
    generatedAt: "2026-07-27T00:00:00.000Z",
    photosByCategory: photos,
  });
  assert.equal(built.ok, true, built.ok ? "" : built.reason);
  if (!built.ok) throw new Error(built.reason);
  const html = renderSurgeryDayProjectionReportHtml({
    report: built.report,
    caseId: CASE_ID,
    generatedAtDisplay: "27 Jul 2026",
  });
  return { report: built.report, html, text: htmlVisible(html) };
}

describe("HA-PROJECTION-1C routing", () => {
  it("surgery_day_projection selects projection report template", () => {
    assert.equal(
      shouldUseSurgeryDayProjectionReportTemplate("surgery_day_projection", "patient"),
      true
    );
    const name = resolveReportPresentationTemplateName({
      assessmentType: "surgery_day_projection",
      pathway: "post_surgery",
      auditMode: "patient",
      resolvePathwayTemplate: resolvePatientReportTemplateName,
    });
    assert.equal(name, "surgery-day-projection");
  });

  it("surgery_day_projection_with_baseline selects same template", () => {
    assert.equal(
      shouldUseSurgeryDayProjectionReportTemplate(
        "surgery_day_projection_with_baseline",
        "patient"
      ),
      true
    );
    const name = resolveReportPresentationTemplateName({
      assessmentType: "surgery_day_projection_with_baseline",
      pathway: "post_surgery",
      auditMode: "patient",
      resolvePathwayTemplate: resolvePatientReportTemplateName,
    });
    assert.equal(name, "surgery-day-projection");
  });

  it("pre/post reports unchanged when no projection assessmentType", () => {
    assert.equal(shouldUsePreSurgeryReportTemplate("pre_surgery", "patient"), true);
    assert.equal(shouldUsePostSurgeryReportTemplate("post_surgery", "patient"), true);
    assert.equal(
      shouldUseSurgeryDayProjectionReportTemplate(null, "patient"),
      false
    );
    assert.equal(resolvePatientReportTemplateName("pre_surgery", "patient"), "pre-surgery-planning");
    assert.equal(resolvePatientReportTemplateName("post_surgery", "patient"), "post-surgery-audit");
  });

  it("Elite report not used for projection (template maps through elite PDF header)", () => {
    const clinical = "surgery-day-projection";
    assert.equal(normalizeReportTemplateForPdf(clinical), "elite");
    const route = readFileSync(join(process.cwd(), "src/app/api/print/report/route.ts"), "utf8");
    assert.match(route, /shouldUseSurgeryDayProjectionReportTemplate/);
    assert.match(route, /renderSurgeryDayProjectionReportHtml/);
    assert.match(route, /renderEliteReportHtml/);
    // Projection branch precedes Elite fallback
    const projIdx = route.indexOf("renderSurgeryDayProjectionReportHtml");
    const eliteIdx = route.indexOf("return renderEliteReportHtml");
    assert.ok(projIdx > 0 && eliteIdx > projIdx);
  });
});

describe("HA-PROJECTION-1C data contract", () => {
  it("report consumes 1A + 1B data only", () => {
    const pair = fixtureB_surgeryDayOnly();
    const built = buildSurgeryDayProjectionReport({
      reconstruction: pair.reconstruction,
      projectedOutcome: pair.projectedOutcome,
      caseId: CASE_ID,
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.report.assessmentType, pair.projectedOutcome.assessmentType);
    assert.equal(
      built.report.reconstructionConfidence.toLowerCase(),
      pair.projectedOutcome.reconstructionConfidence
    );
  });

  it("no raw uploads queried by report renderer module", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/reports/SurgeryDayProjectionReportHtml.tsx"),
      "utf8"
    );
    assert.doesNotMatch(src, /\.from\(["']uploads["']\)/);
    assert.doesNotMatch(src, /createSupabaseAdminClient/);
    assert.doesNotMatch(src, /storage\.from/);
  });

  it("no raw forensic payload rendered", () => {
    const { text } = renderPair(fixtureA_baselinePlusSurgeryDay());
    assert.doesNotMatch(text, /section_score_evidence/i);
    assert.doesNotMatch(text, /forensic_audit/i);
    assert.doesNotMatch(text, /storage_path/i);
    assert.doesNotMatch(text, /case_files/i);
  });
});

describe("HA-PROJECTION-1C sections", () => {
  it("projection banner + confidences + observed/projected + cannot + future", () => {
    const { text, report } = renderPair(fixtureA_baselinePlusSurgeryDay());
    assert.match(text, /Projected analysis based on surgery-day evidence/i);
    assert.match(text, /Reconstruction confidence/i);
    assert.match(text, /Projection confidence/i);
    assert.match(text, /What HairAudit Can Observe Today/i);
    assert.match(text, /Projected Cosmetic Characteristics/i);
    assert.match(text, /What Cannot Yet Be Determined/i);
    assert.match(text, /Future HairAudit Comparison/i);
    assert.ok(report.reconstructionConfidence);
    assert.ok(report.projectionConfidence);
    assert.notEqual(report.reconstructionConfidence, undefined);
  });
});

describe("HA-PROJECTION-1C domain behavior", () => {
  it("omitted 1B domain stays omitted", () => {
    const pair = fixtureB_surgeryDayOnly();
    assert.ok(
      !pair.projectedOutcome.projectedCharacteristics.some(
        (c) => c.domain === "native_hair_dependency"
      )
    );
    const { text } = renderPair(pair);
    assert.doesNotMatch(text, /Native Hair Dependency/i);
  });

  it("baseline section hidden without valid baseline", () => {
    const { report, text } = renderPair(fixtureB_surgeryDayOnly());
    assert.equal(report.assessmentType, "surgery_day_projection");
    assert.ok(!report.observedToday.some((b) => b.id === "baseline_comparison"));
    assert.match(text, /No verified preoperative baseline was available/i);
  });

  it("native hair dependency hidden without 1B domain", () => {
    const { text } = renderPair(fixtureC_limitedNoDonor());
    assert.doesNotMatch(text, /Native Hair Dependency/i);
  });

  it("untreated crown renders only when supplied by 1B", () => {
    const pair = fixtureA_baselinePlusSurgeryDay();
    const untreated = pair.projectedOutcome.projectedCharacteristics.find(
      (c) => c.domain === "untreated_or_lower_treatment_areas"
    );
    const { text } = renderPair(pair);
    if (untreated) {
      assert.match(text, /Untreated|lower treatment|Crown/i);
    } else {
      assert.doesNotMatch(text, /untreated_or_lower_treatment_areas/);
    }
  });
});

describe("HA-PROJECTION-1C graft handling", () => {
  it("clinic-reported and GII estimate remain separate; conflicts not averaged", () => {
    const { report, text } = renderPair(fixtureE_conflictingGrafts());
    assert.ok(report.graftEvidence.conflictNote);
    assert.match(text, /kept separate rather than averaged/i);
    assert.match(text, /3,180|3180/);
    assert.match(text, /2,800|2800/);
    if (report.graftEvidence.imageDerivedEstimate) {
      assert.match(text, /Image-derived estimate/i);
      assert.match(text, /2,900–3,300|2900/);
    }
    assert.doesNotMatch(text, /HairAudit confirms 3,180/i);
    // Must not show a single averaged figure as the only count
    assert.doesNotMatch(text, /averaged graft count/i);
  });

  it("missing graft count does not create fake number", () => {
    const pair = fixtureC_limitedNoDonor();
    const { report, text } = renderPair(pair);
    assert.equal(report.graftEvidence.procedureRecords.length, 0);
    assert.equal(report.graftEvidence.imageDerivedEstimate, null);
    assert.doesNotMatch(text, /Clinic-reported graft count/i);
  });
});

describe("HA-PROJECTION-1C safety", () => {
  it("report rejects unsafe will grow / survival% / success probability", () => {
    const pair = fixtureB_surgeryDayOnly();
    const unsafeOutcome = {
      ...pair.projectedOutcome,
      projectedCharacteristics: [
        {
          ...pair.projectedOutcome.projectedCharacteristics[0]!,
          projection: "The transplanted hairs will grow with 90% survival and high success probability.",
        },
      ],
    };
    const built = buildSurgeryDayProjectionReport({
      reconstruction: pair.reconstruction,
      projectedOutcome: unsafeOutcome,
      caseId: CASE_ID,
    });
    assert.equal(built.ok, false);
  });

  it("report does not show fake grafts/cm² or success score", () => {
    const { text } = renderPair(fixtureA_baselinePlusSurgeryDay());
    assert.doesNotMatch(text, /\d+\s*(grafts?|fu)\s*\/\s*cm/i);
    assert.doesNotMatch(text, /success score/i);
    assert.doesNotMatch(text, /success probability/i);
    assert.doesNotMatch(text, /AI Outcome Score/i);
  });

  it("cannot yet be assessed remains allowed", () => {
    const check = findUnsafeProjectionClaims(
      "Actual graft survival cannot yet be assessed."
    );
    assert.equal(check.length, 0);
    const { text } = renderPair(fixtureA_baselinePlusSurgeryDay());
    assert.match(text, /cannot yet be/i);
  });
});

describe("HA-PROJECTION-1C donor", () => {
  it("immediate donor observation renders; mature claim absent", () => {
    const { text } = renderPair(fixtureA_baselinePlusSurgeryDay());
    assert.match(text, /Donor Observations/i);
    assert.match(
      text,
      /Final donor appearance cannot be assessed from immediate postoperative images/i
    );
    assert.doesNotMatch(text, /mature scarring will/i);
    assert.doesNotMatch(text, /final donor depletion/i);
  });

  it("no donor section content when donor absent", () => {
    const { report } = renderPair(fixtureC_limitedNoDonor());
    assert.equal(report.donorObservations.length, 0);
  });
});

describe("HA-PROJECTION-1C resolve / availability", () => {
  it("embedded summary pair resolves without reconstructionInput", () => {
    const pair = fixtureA_baselinePlusSurgeryDay();
    const resolved = resolveSurgeryDayProjectionReport({
      summary: {
        assessmentType: pair.projectedOutcome.assessmentType,
        surgeryDayReconstruction: pair.reconstruction,
        surgeryDayProjectedOutcome: pair.projectedOutcome,
      },
      caseId: CASE_ID,
    });
    assert.equal(resolved.ok, true);
  });

  it("insufficient reconstruction fails closed", () => {
    const rebuilt = buildSurgeryDayProcedureReconstruction({
      uploads: [{ type: "patient_photo:preop_front" }],
    });
    assert.equal(rebuilt.ok, false);
    const resolved = resolveSurgeryDayProjectionReport({
      reconstructionInput: { uploads: [{ type: "patient_photo:preop_front" }] },
      caseId: CASE_ID,
    });
    assert.equal(resolved.ok, false);
  });

  it("extractAssessmentTypeFromSummary reads nested fields", () => {
    assert.equal(
      extractAssessmentTypeFromSummary({ assessmentType: "surgery_day_projection" }),
      "surgery_day_projection"
    );
    assert.equal(
      extractAssessmentTypeFromSummary({
        surgery_day_projection: { assessmentType: "surgery_day_projection_with_baseline" },
      }),
      "surgery_day_projection_with_baseline"
    );
  });
});

describe("HA-PROJECTION-1C HTML smoke fixtures", () => {
  it("writes synthetic HTML for fixtures A/B/C (no PHI)", () => {
    const outDir = join(process.cwd(), "tmp", "projection-1c-smoke");
    mkdirSync(outDir, { recursive: true });
    const fixtures = [
      ["A-baseline", fixtureA_baselinePlusSurgeryDay()],
      ["B-surgery-only", fixtureB_surgeryDayOnly()],
      ["C-limited", fixtureC_limitedNoDonor()],
    ] as const;
    for (const [name, pair] of fixtures) {
      const { html, text } = renderPair(pair);
      const path = join(outDir, `${name}.html`);
      writeFileSync(path, html, "utf8");
      assert.match(text, /HairAudit Surgery-Day Projection/);
      assert.match(text, /Projected analysis based on surgery-day evidence/);
      assert.match(text, /Clinical Disclaimer/);
    }
  });
});

describe("HA-PROJECTION-1C observed vs projected separation", () => {
  it("keeps Observed and Projected Characteristic labels distinct", () => {
    const { text } = renderPair(fixtureA_baselinePlusSurgeryDay());
    assert.match(text, /Observed Today/);
    assert.match(text, /Projected Characteristic/);
    assert.match(text, /Limitations \/ Confidence/);
  });
});

describe("HA-PROJECTION-1C regression wiring", () => {
  it("1A/1B builders still produce valid pairs for report", () => {
    const rebuilt = buildSurgeryDayProcedureReconstruction({
      uploads: [{ type: "patient_photo:day0_recipient" }],
    });
    assert.equal(rebuilt.ok, true);
    if (!rebuilt.ok) return;
    const outcome = buildSurgeryDayProjectedOutcome(rebuilt.reconstruction);
    assert.equal(outcome.ok, true);
    const report = buildSurgeryDayProjectionReport({
      reconstruction: rebuilt.reconstruction as SurgeryDayProcedureReconstruction,
      projectedOutcome: outcome.projectedOutcome!,
      caseId: CASE_ID,
    });
    assert.equal(report.ok, true);
  });
});
