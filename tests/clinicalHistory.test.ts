import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeClinicalHistoryPayload } from "@/lib/hairaudit/clinical-history/clinicalHistoryValidation";
import {
  buildClinicalHistorySnapshot,
  buildPatientSafeClinicalHistoryLines,
  clinicalHistorySnapshotFromPayload,
  hasMeaningfulClinicalHistory,
} from "@/lib/hairaudit/clinical-history/clinicalHistoryUtils";
import {
  calculateAverageHairsPerGraft,
  calculateFromGraftDistribution,
} from "@/lib/hairaudit/clinical-history/clinicalHistoryCalculations";
import {
  formatParsedClinicalHistorySummary,
  parseClinicalHistoryPasteText,
} from "@/lib/hairaudit/clinical-history/clinicalHistoryPasteParser";
import { formatClinicalHistoryForPrompt } from "@/lib/hairaudit/clinical-history/clinicalHistory.server";
import { buildPatientSafeReportSummary } from "@/lib/reports/patientSafeSummary";
import { AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED } from "@/lib/patient/patientPhotoImageLimitedOverride";
import type { CaseClinicalHistoryRow } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";

const sampleRow: CaseClinicalHistoryRow = {
  id: "11111111-1111-4111-8111-111111111111",
  case_id: "22222222-2222-4222-8222-222222222222",
  prior_surgery_count: 1,
  prior_procedure_type: "fue",
  prior_surgery_date: "2024-06-15",
  prior_surgery_timing_note: null,
  prior_clinic_name: "Prior Clinic",
  prior_surgeon_name: "Dr Smith",
  prior_graft_count: 3200,
  estimated_hair_count: 6400,
  average_hairs_per_graft: 2.0,
  single_hair_grafts: 600,
  double_hair_grafts: 1400,
  triple_hair_grafts: 900,
  quadruple_hair_grafts: 100,
  donor_grafts_removed: 3100,
  punch_size_mm: 0.85,
  extraction_method: "motorised_punch",
  implantation_method: "implanter_pen",
  transection_rate_percent: 8,
  survival_estimate_percent: 92,
  recipient_zones: ["frontal_hairline", "crown"],
  donor_depletion_level: "mild",
  donor_reserve_assessment: null,
  visible_scarring_level: "none",
  surgical_technique_notes: "Motorised FUE, lateral slit",
  medication_history: { finasteride: true, topical_minoxidil: true },
  supporting_document_notes: "PDF operative note: 3200 grafts, 2.0 hairs/graft",
  clinician_summary: "Internal: verify donor photos when available",
  created_by: null,
  updated_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("clinical history validation", () => {
  it("normalizes valid payload to db row shape", () => {
    const result = normalizeClinicalHistoryPayload({
      priorGraftCount: 2800,
      estimatedHairCount: 5600,
      averageHairsPerGraft: 2.25,
      punchSizeMm: 0.85,
      extractionMethod: "manual_punch",
      implantationMethod: "forceps",
      donorDepletionLevel: "moderate",
      visibleScarringLevel: "mild",
      recipientZones: ["temples", "invalid_zone", "crown"],
      medicationHistory: { dutasteride: true, other: "biotin" },
      priorSurgeryDate: "2023-01-10",
      priorSurgeryTimingNote: "Approx 2 years ago",
      singleHairGrafts: 500,
      transectionRatePercent: 7.5,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.dbRow.prior_graft_count, 2800);
    assert.equal(result.dbRow.estimated_hair_count, 5600);
    assert.equal(result.dbRow.average_hairs_per_graft, 2.25);
    assert.equal(result.dbRow.punch_size_mm, 0.85);
    assert.equal(result.dbRow.extraction_method, "manual_punch");
    assert.equal(result.dbRow.donor_depletion_level, "moderate");
    assert.deepEqual(result.dbRow.recipient_zones, ["temples", "crown"]);
    assert.equal((result.dbRow.medication_history as { other?: string }).other, "biotin");
    assert.equal(result.dbRow.prior_surgery_timing_note, "Approx 2 years ago");
  });

  it("rejects invalid average hairs per graft", () => {
    const result = normalizeClinicalHistoryPayload({ averageHairsPerGraft: 5.5 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /1\.0 and 4\.5/);
  });

  it("rejects punch size outside 0.5–1.5", () => {
    const result = normalizeClinicalHistoryPayload({ punchSizeMm: 2.0 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /0\.5 and 1\.5/);
  });

  it("rejects transection rate outside 0–100", () => {
    const result = normalizeClinicalHistoryPayload({ transectionRatePercent: 110 });
    assert.equal(result.ok, false);
  });

  it("rejects non-positive integers", () => {
    const result = normalizeClinicalHistoryPayload({ priorGraftCount: 0 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.dbRow.prior_graft_count, null);
  });

  it("rejects invalid depletion level", () => {
    const result = normalizeClinicalHistoryPayload({ donorDepletionLevel: "extreme" });
    assert.equal(result.ok, false);
  });

  it("rejects invalid extraction method", () => {
    const result = normalizeClinicalHistoryPayload({ extractionMethod: "laser" });
    assert.equal(result.ok, false);
  });
});

describe("clinical history calculations", () => {
  it("calculates average hairs per graft from totals", () => {
    assert.equal(calculateAverageHairsPerGraft(3200, 7200), 2.25);
  });

  it("calculates totals from singles/doubles/triples/quadruples", () => {
    const totals = calculateFromGraftDistribution(600, 1400, 900, 100);
    assert.ok(totals);
    assert.equal(totals!.totalGrafts, 3000);
    assert.equal(totals!.estimatedHairs, 6500);
    assert.equal(totals!.averageHairsPerGraft, 2.17);
  });
});

describe("clinical history paste parser", () => {
  it("parses graft/hair/ratio/punch patterns", () => {
    const parsed = parseClinicalHistoryPasteText(
      "3120 grafts, 7040 hairs, 2.26 ratio, 0.85 punch, 600 singles, 1400 doubles, 8% transection"
    );
    assert.equal(parsed.priorGraftCount, 3120);
    assert.equal(parsed.estimatedHairCount, 7040);
    assert.equal(parsed.averageHairsPerGraft, 2.26);
    assert.equal(parsed.punchSizeMm, 0.85);
    assert.equal(parsed.singleHairGrafts, 600);
    assert.equal(parsed.doubleHairGrafts, 1400);
    assert.equal(parsed.transectionRatePercent, 8);
    assert.match(formatParsedClinicalHistorySummary(parsed), /3120 grafts/);
    assert.match(formatParsedClinicalHistorySummary(parsed), /0\.85mm/);
  });
});

describe("clinical history utils", () => {
  it("buildClinicalHistorySnapshot maps row fields including new columns", () => {
    const snap = buildClinicalHistorySnapshot(sampleRow);
    assert.equal(snap.priorGraftCount, 3200);
    assert.equal(snap.averageHairsPerGraft, 2);
    assert.equal(snap.punchSizeMm, 0.85);
    assert.equal(snap.extractionMethod, "motorised_punch");
    assert.equal(snap.singleHairGrafts, 600);
    assert.deepEqual(snap.recipientZones, ["frontal_hairline", "crown"]);
    assert.equal(snap.medicationHistory.finasteride, true);
  });

  it("hasMeaningfulClinicalHistory detects populated snapshot", () => {
    assert.equal(hasMeaningfulClinicalHistory(buildClinicalHistorySnapshot(sampleRow)), true);
    assert.equal(
      hasMeaningfulClinicalHistory(
        clinicalHistorySnapshotFromPayload({
          donorDepletionLevel: "unknown",
          visibleScarringLevel: "unknown",
        })
      ),
      false
    );
    assert.equal(
      hasMeaningfulClinicalHistory(
        clinicalHistorySnapshotFromPayload({ medicationHistory: { prp: true } })
      ),
      true
    );
    assert.equal(
      hasMeaningfulClinicalHistory(
        clinicalHistorySnapshotFromPayload({ punchSizeMm: 0.9 })
      ),
      true
    );
  });

  it("clinicalHistorySnapshotFromPayload mirrors upsert fields", () => {
    const payload = {
      priorGraftCount: 1500,
      averageHairsPerGraft: 2.1,
      punchSizeMm: 0.8,
      supportingDocumentNotes: "from PDF",
    };
    const snap = clinicalHistorySnapshotFromPayload(payload);
    assert.equal(snap.priorGraftCount, 1500);
    assert.equal(snap.averageHairsPerGraft, 2.1);
    assert.equal(snap.punchSizeMm, 0.8);
    assert.equal(snap.supportingDocumentNotes, "from PDF");
  });

  it("buildPatientSafeClinicalHistoryLines excludes internal notes", () => {
    const snap = buildClinicalHistorySnapshot(sampleRow);
    const lines = buildPatientSafeClinicalHistoryLines(snap);
    assert.ok(lines.some((l) => /3,?200.*grafts/i.test(l)));
    assert.ok(lines.some((l) => /2\.00/.test(l)));
    assert.ok(lines.some((l) => /0\.85 mm/i.test(l)));
    assert.ok(lines.some((l) => /finasteride/i.test(l)));
    assert.ok(!lines.some((l) => /Internal:/i.test(l)));
    assert.ok(!lines.some((l) => /clinician summary/i.test(l)));
  });
});

describe("clinical history AI prompt context", () => {
  it("formatClinicalHistoryForPrompt includes graft metrics, punch size, and priority wording", () => {
    const snap = buildClinicalHistorySnapshot(sampleRow);
    const block = formatClinicalHistoryForPrompt(snap);
    assert.match(block, /clinician\/operator-entered/i);
    assert.match(block, /3200/);
    assert.match(block, /0\.85/);
    assert.match(block, /DONOR MANAGEMENT/i);
    assert.match(block, /punch size/i);
    assert.match(block, /finasteride/i);
  });

  it("phrases approximate surgery timing when date missing", () => {
    const snap = clinicalHistorySnapshotFromPayload({
      priorSurgeryTimingNote: "Approx 2 years ago",
      priorGraftCount: 2000,
    });
    const block = formatClinicalHistoryForPrompt(snap);
    assert.match(block, /approximate/i);
    assert.match(block, /Approx 2 years ago/);
    assert.match(block, /DATE PHRASING/);
  });

  it("returns none placeholder when empty", () => {
    const block = formatClinicalHistoryForPrompt(null);
    assert.match(block, /\(none/);
  });
});

describe("patient-safe report clinical context", () => {
  it("buildPatientSafeReportSummary includes knownClinicalContext when clinical history provided", () => {
    const snap = buildClinicalHistorySnapshot(sampleRow);
    const summary = buildPatientSafeReportSummary({ key_findings: [], red_flags: [] }, { clinicalHistory: snap });
    assert.ok(summary.knownClinicalContext?.length);
    assert.ok(summary.knownClinicalContext!.some((l) => /graft count/i.test(l)));
  });
});

describe("regenerate pathway integration", () => {
  it("runAudit passes clinicalHistory into runAIAudit", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/inngest/functions.ts"), "utf8");
    assert.match(src, /loadCaseClinicalHistory\(caseId/);
    assert.match(src, /clinicalHistory,/);
  });

  it("AIAuditInput includes clinicalHistory in audit module", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/ai/audit.ts"), "utf8");
    assert.match(src, /clinicalHistory\?:/);
    assert.match(src, /formatClinicalHistoryForPrompt/);
  });
});

describe("CaseClinicalHistoryPanel wiring", () => {
  it("panel component exports Clinical Intelligence Editor and save actions", () => {
    const panel = readFileSync(
      join(process.cwd(), "src/components/hairaudit/admin/CaseClinicalHistoryPanel.tsx"),
      "utf8"
    );
    assert.match(panel, /Clinical Intelligence Editor/);
    assert.match(panel, /saveCaseClinicalHistoryAction/);
    assert.match(panel, /saveCaseClinicalHistoryAndRegenerateAction/);
    assert.match(panel, /saveCaseClinicalHistoryAndRegenerateImageLimitedAction/);
    assert.match(panel, /Quick extract \/ paste notes/);
    assert.match(panel, /Save \+ Regenerate Image-Limited Audit/);
    assert.match(panel, /Average hairs\/graft/);
    assert.match(panel, /Total grafts/);
  });

  it("server actions require auditor and queue regenerate paths", () => {
    const actions = readFileSync(
      join(process.cwd(), "src/app/cases/[caseId]/clinicalHistoryActions.ts"),
      "utf8"
    );
    assert.match(actions, /requireAuditor/);
    assert.match(actions, /queueAuditorRerunFromAdmin/);
    assert.match(actions, /regenerate_ai_audit/);
    assert.match(actions, /clinical_history_used_for_regeneration/);
    assert.match(actions, /saveCaseClinicalHistoryAndRegenerateImageLimitedAction/);
    assert.match(actions, /AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED/);
    assert.match(actions, /clinical_history_used_for_image_limited_regeneration/);
  });

  it("image-limited regenerate uses document_assisted_image_limited reason", () => {
    assert.equal(AUDITOR_RERUN_REASON_DOCUMENT_ASSISTED_IMAGE_LIMITED, "document_assisted_image_limited");
  });
});
