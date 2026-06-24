import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeClinicalHistoryPayload } from "@/lib/hairaudit/clinical-history/clinicalHistoryValidation";
import {
  buildClinicalHistorySnapshot,
  clinicalHistorySnapshotFromPayload,
  hasMeaningfulClinicalHistory,
} from "@/lib/hairaudit/clinical-history/clinicalHistoryUtils";
import { formatClinicalHistoryForPrompt } from "@/lib/hairaudit/clinical-history/clinicalHistory.server";
import type { CaseClinicalHistoryRow } from "@/lib/hairaudit/clinical-history/clinicalHistoryTypes";

const sampleRow: CaseClinicalHistoryRow = {
  id: "11111111-1111-4111-8111-111111111111",
  case_id: "22222222-2222-4222-8222-222222222222",
  prior_surgery_count: 1,
  prior_procedure_type: "FUE",
  prior_surgery_date: "2024-06-15",
  prior_clinic_name: "Prior Clinic",
  prior_surgeon_name: "Dr Smith",
  prior_graft_count: 3200,
  estimated_hair_count: 6400,
  average_hairs_per_graft: 2.0,
  donor_grafts_removed: 3100,
  recipient_zones: ["frontal_hairline", "crown"],
  donor_depletion_level: "mild",
  visible_scarring_level: "none",
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
      donorDepletionLevel: "moderate",
      visibleScarringLevel: "mild",
      recipientZones: ["temples", "invalid_zone", "crown"],
      medicationHistory: { dutasteride: true, other: "biotin" },
      priorSurgeryDate: "2023-01-10",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.dbRow.prior_graft_count, 2800);
    assert.equal(result.dbRow.estimated_hair_count, 5600);
    assert.equal(result.dbRow.average_hairs_per_graft, 2.25);
    assert.equal(result.dbRow.donor_depletion_level, "moderate");
    assert.deepEqual(result.dbRow.recipient_zones, ["temples", "crown"]);
    assert.equal((result.dbRow.medication_history as { other?: string }).other, "biotin");
  });

  it("rejects invalid average hairs per graft", () => {
    const result = normalizeClinicalHistoryPayload({ averageHairsPerGraft: 5.5 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /1\.0 and 4\.5/);
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
});

describe("clinical history utils", () => {
  it("buildClinicalHistorySnapshot maps row fields", () => {
    const snap = buildClinicalHistorySnapshot(sampleRow);
    assert.equal(snap.priorGraftCount, 3200);
    assert.equal(snap.averageHairsPerGraft, 2);
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
  });

  it("clinicalHistorySnapshotFromPayload mirrors upsert fields", () => {
    const payload = {
      priorGraftCount: 1500,
      averageHairsPerGraft: 2.1,
      supportingDocumentNotes: "from PDF",
    };
    const snap = clinicalHistorySnapshotFromPayload(payload);
    assert.equal(snap.priorGraftCount, 1500);
    assert.equal(snap.averageHairsPerGraft, 2.1);
    assert.equal(snap.supportingDocumentNotes, "from PDF");
  });
});

describe("clinical history AI prompt context", () => {
  it("formatClinicalHistoryForPrompt includes graft metrics and priority wording", () => {
    const snap = buildClinicalHistorySnapshot(sampleRow);
    const block = formatClinicalHistoryForPrompt(snap);
    assert.match(block, /clinician\/operator-entered/i);
    assert.match(block, /3200/);
    assert.match(block, /2/);
    assert.match(block, /DONOR MANAGEMENT/i);
    assert.match(block, /finasteride/i);
  });

  it("returns none placeholder when empty", () => {
    const block = formatClinicalHistoryForPrompt(null);
    assert.match(block, /\(none/);
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
  it("panel component exports save actions and graft fields", () => {
    const panel = readFileSync(
      join(process.cwd(), "src/components/hairaudit/admin/CaseClinicalHistoryPanel.tsx"),
      "utf8"
    );
    assert.match(panel, /Structured Clinical History/);
    assert.match(panel, /saveCaseClinicalHistoryAction/);
    assert.match(panel, /saveCaseClinicalHistoryAndRegenerateAction/);
    assert.match(panel, /Average hairs per graft/);
    assert.match(panel, /Total grafts/);
  });

  it("server actions require auditor and queue regenerate", () => {
    const actions = readFileSync(
      join(process.cwd(), "src/app/cases/[caseId]/clinicalHistoryActions.ts"),
      "utf8"
    );
    assert.match(actions, /requireAuditor/);
    assert.match(actions, /queueAuditorRerunFromAdmin/);
    assert.match(actions, /regenerate_ai_audit/);
    assert.match(actions, /clinical_history_used_for_regeneration/);
  });
});
