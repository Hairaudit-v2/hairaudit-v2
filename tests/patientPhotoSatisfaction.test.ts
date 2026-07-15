/**
 * HA-PHOTO-ALLOCATION-UNIFICATION-1 — Canonical patient photo satisfaction.
 * Run: pnpm exec tsx --test tests/patientPhotoSatisfaction.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canSubmit } from "@/lib/auditPhotoSchemas";
import {
  buildRequiredPhotoChecklist,
  POST_SURGERY_PINNED_CATEGORY_KEYS,
} from "@/lib/auditor/auditorImageSortingUx";
import { auditorPatientPhotoCategoryLabel } from "@/lib/auditor/auditorPatientPhotoCategories";
import {
  getMissingPathwayRequiredUploadKeys,
  isPathwayRequiredUploadComplete,
  requiredPhotoKeys,
} from "@/lib/patient/patientReviewPathway";
import {
  evaluatePatientPhotoSubmitGate,
  readMonthsSinceFromPatientAnswers,
} from "@/lib/patientPhoto/patientPhotoReadinessPolicy";
import { getMissingRequiredPatientPhotoKeys } from "@/lib/patient/patientPhotoImageLimitedOverride";
import { evaluateRunAuditPatientPhotoGate } from "@/lib/patient/runAuditPhotoGate";
import {
  areWideViewEquivalentCategories,
  extractUploadedPatientPhotoCategories,
  resolvePatientPhotoSatisfaction,
  resolvePatientPhotoSatisfactionFromUploads,
} from "@/lib/patient/patientPhotoSatisfaction";

const POST_REQUIRED = requiredPhotoKeys.post_surgery;

function photo(key: string) {
  return { type: `patient_photo:${key}` };
}

const FIVE_PATHWAY = [
  photo("preop_front"),
  photo("current_recipient_closeup"),
  photo("preop_top"),
  photo("preop_donor_rear"),
  photo("preop_donor_closeup"),
];

describe("HA-PHOTO-ALLOCATION-UNIFICATION-1 satisfaction", () => {
  it("1. five pathway wizard uploads pass submit, readiness, and Inngest gate", () => {
    assert.equal(isPathwayRequiredUploadComplete("post_surgery", FIVE_PATHWAY), true);
    assert.equal(canSubmit("patient", FIVE_PATHWAY, "post_surgery"), true);

    const gate = evaluatePatientPhotoSubmitGate({
      uploadRows: FIVE_PATHWAY,
      patientAnswers: { months_since: "6_9" },
      stageAwareSubmitEnabled: false,
      patientReviewPathway: "post_surgery",
    });
    assert.equal(gate.allowed, true);
    assert.equal(gate.viaBaseline, true);

    const runGate = evaluateRunAuditPatientPhotoGate({
      caseId: "sat-1",
      uploadRows: FIVE_PATHWAY,
      patientAnswers: { months_since: "6_9" },
      clinicalHistory: null,
      stageAwareSubmitEnabled: false,
      patientReviewPathway: "post_surgery",
      patientPhotosForAuditCount: FIVE_PATHWAY.length,
      auditorRerunReason: null,
    });
    assert.equal(runGate.allowed, true);
    assert.deepEqual(getMissingPathwayRequiredUploadKeys("post_surgery", FIVE_PATHWAY), []);
  });

  it("2. reassigning preop_front to patient_current_front keeps pathway complete", () => {
    const reassigned = [
      photo("patient_current_front"),
      photo("current_recipient_closeup"),
      photo("preop_top"),
      photo("preop_donor_rear"),
      photo("preop_donor_closeup"),
    ];
    assert.equal(isPathwayRequiredUploadComplete("post_surgery", reassigned), true);
    assert.equal(canSubmit("patient", reassigned, "post_surgery"), true);
    const checklist = buildRequiredPhotoChecklist("post_surgery", reassigned);
    const front = checklist.find((c) => c.key === "preop_front");
    assert.ok(front?.satisfied);
  });

  it("3. legacy three-bucket uploads do not falsely satisfy required close-up slots", () => {
    const legacyThree = [
      photo("patient_current_front"),
      photo("patient_current_top"),
      photo("patient_current_donor_rear"),
    ];
    const missing = getMissingPathwayRequiredUploadKeys("post_surgery", legacyThree);
    assert.ok(missing.includes("current_recipient_closeup"));
    assert.ok(missing.includes("preop_donor_closeup"));
    assert.equal(isPathwayRequiredUploadComplete("post_surgery", legacyThree), false);
  });

  it("4. patient_current_top satisfies the post-surgery top pathway view", () => {
    const result = resolvePatientPhotoSatisfaction(
      ["patient_current_top", "preop_front", "current_recipient_closeup", "preop_donor_rear", "preop_donor_closeup"],
      { pathway: "post_surgery", requiredKeys: POST_REQUIRED }
    );
    assert.ok(result.satisfiedKeys.has("preop_top"));
    assert.deepEqual(result.sourceKeysBySatisfiedKey.get("preop_top"), ["patient_current_top"]);
  });

  it("5. patient_current_donor_rear satisfies donor-rear but not donor-close-up", () => {
    const result = resolvePatientPhotoSatisfaction(
      ["patient_current_donor_rear"],
      { pathway: "post_surgery", requiredKeys: POST_REQUIRED }
    );
    assert.ok(result.satisfiedKeys.has("preop_donor_rear"));
    assert.ok(!result.satisfiedKeys.has("preop_donor_closeup"));
    assert.ok(result.missingKeys.includes("preop_donor_closeup"));
  });

  it("6. valid month-six milestone images satisfy corresponding current-result wide views", () => {
    const milestones = [
      "postop_month6_front",
      "postop_month6_top",
      "postop_month6_donor",
      "current_recipient_closeup",
      "preop_donor_closeup",
    ];
    const result = resolvePatientPhotoSatisfaction(milestones, {
      pathway: "post_surgery",
      requiredKeys: POST_REQUIRED,
      monthsSinceBand: "6_9",
    });
    assert.equal(result.isComplete, true);
    assert.ok(result.satisfiedKeys.has("preop_front"));
    assert.ok(result.satisfiedKeys.has("preop_top"));
    assert.ok(result.satisfiedKeys.has("preop_donor_rear"));

    assert.equal(
      isPathwayRequiredUploadComplete(
        "post_surgery",
        milestones.map((k) => photo(k)),
        { monthsSinceBand: "6_9" }
      ),
      true
    );
  });

  it("7. milestone images from an ineligible stage do not satisfy time-specific requirements", () => {
    const wrongStage = [
      photo("postop_month3_front"),
      photo("postop_month3_top"),
      photo("postop_month3_donor"),
      photo("current_recipient_closeup"),
      photo("preop_donor_closeup"),
    ];
    const missing = getMissingPathwayRequiredUploadKeys("post_surgery", wrongStage, {
      monthsSinceBand: "6_9",
    });
    assert.ok(missing.includes("preop_front"));
    assert.ok(missing.includes("preop_top"));
    assert.ok(missing.includes("preop_donor_rear"));
    assert.equal(isPathwayRequiredUploadComplete("post_surgery", wrongStage, { monthsSinceBand: "6_9" }), false);
  });

  it("8. case-page readiness and submit readiness return the same missing keys", () => {
    const uploads = [photo("patient_current_front"), photo("graft_count_board")];
    const answers = { months_since: "6_9" as const };
    const band = readMonthsSinceFromPatientAnswers(answers);

    const casePageMissing = getMissingPathwayRequiredUploadKeys("post_surgery", uploads, {
      monthsSinceBand: band,
    });
    const submitMissing = getMissingRequiredPatientPhotoKeys(uploads, {
      patientReviewPathway: "post_surgery",
      patientAnswers: answers,
    });
    assert.deepEqual([...casePageMissing].sort(), [...submitMissing].sort());

    const gate = evaluatePatientPhotoSubmitGate({
      uploadRows: uploads,
      patientAnswers: answers,
      stageAwareSubmitEnabled: false,
      patientReviewPathway: "post_surgery",
    });
    assert.equal(gate.allowed, false);
    assert.equal(casePageMissing.length > 0, true);
  });

  it("9. Inngest and synchronous submit use the same satisfaction result", () => {
    const uploads = [
      photo("patient_current_front"),
      photo("patient_current_top"),
      photo("patient_current_donor_rear"),
      photo("current_recipient_closeup"),
      photo("preop_donor_closeup"),
    ];
    const answers = { months_since: "6_9" };

    const submitGate = evaluatePatientPhotoSubmitGate({
      uploadRows: uploads,
      patientAnswers: answers,
      stageAwareSubmitEnabled: false,
      patientReviewPathway: "post_surgery",
    });
    const runGate = evaluateRunAuditPatientPhotoGate({
      caseId: "sat-9",
      uploadRows: uploads,
      patientAnswers: answers,
      clinicalHistory: null,
      stageAwareSubmitEnabled: false,
      patientReviewPathway: "post_surgery",
      patientPhotosForAuditCount: uploads.length,
      auditorRerunReason: null,
    });

    assert.equal(submitGate.allowed, runGate.photoSubmitGate.allowed);
    assert.equal(submitGate.viaBaseline, runGate.photoSubmitGate.viaBaseline);
    assert.equal(submitGate.allowed, true);
  });

  it("10. pre-surgery pathway behaviour remains unchanged (exact keys only)", () => {
    const preMinimal = [
      photo("preop_front"),
      photo("preop_left"),
      photo("preop_right"),
      photo("preop_top"),
      photo("preop_donor_rear"),
    ];
    assert.equal(isPathwayRequiredUploadComplete("pre_surgery", preMinimal), true);

    const withCurrentFrontInstead = [
      photo("patient_current_front"),
      photo("preop_left"),
      photo("preop_right"),
      photo("preop_top"),
      photo("preop_donor_rear"),
    ];
    // Bucket equivalence is post-surgery only — legacy current keys do not satisfy pre-surgery.
    assert.equal(isPathwayRequiredUploadComplete("pre_surgery", withCurrentFrontInstead), false);

    const missingLeft = preMinimal.filter((p) => !p.type.includes("preop_left"));
    assert.equal(isPathwayRequiredUploadComplete("pre_surgery", missingLeft), false);
  });

  it("11. unknown or miscellaneous categories do not satisfy required views", () => {
    const junk = [photo("any_preop"), photo("graft_count_board"), photo("other_misc")];
    const missing = getMissingPathwayRequiredUploadKeys("post_surgery", junk);
    assert.equal(missing.length, POST_REQUIRED.length);
    assert.equal(isPathwayRequiredUploadComplete("post_surgery", junk), false);
  });

  it("12. auditor reassignment does not require moving the storage object", () => {
    // Satisfaction uses type/category only — storage_path is irrelevant.
    const rows = [
      {
        type: "patient_photo:patient_current_front",
        storage_path: "cases/x/patient/preop_front/old-file.jpg",
      },
      {
        type: "patient_photo:current_recipient_closeup",
        storage_path: "cases/x/patient/uncategorized/a.jpg",
      },
      {
        type: "patient_photo:patient_current_top",
        storage_path: "cases/x/patient/preop_top/b.jpg",
      },
      {
        type: "patient_photo:patient_current_donor_rear",
        storage_path: "cases/x/patient/wrong_folder/c.jpg",
      },
      {
        type: "patient_photo:preop_donor_closeup",
        storage_path: "cases/x/patient/misc/d.jpg",
      },
    ];
    const categories = extractUploadedPatientPhotoCategories(rows);
    assert.ok(!categories.some((c) => c.includes("/")));
    assert.equal(
      resolvePatientPhotoSatisfactionFromUploads(rows, {
        pathway: "post_surgery",
        requiredKeys: POST_REQUIRED,
      }).isComplete,
      true
    );
  });

  it("close-up protection: single patient_current_front does not satisfy recipient close-up", () => {
    const result = resolvePatientPhotoSatisfaction(["patient_current_front"], {
      pathway: "post_surgery",
      requiredKeys: POST_REQUIRED,
    });
    assert.ok(result.satisfiedKeys.has("preop_front"));
    assert.ok(!result.satisfiedKeys.has("current_recipient_closeup"));
  });

  it("close-up protection: single close-up does not satisfy both front and close-up", () => {
    const result = resolvePatientPhotoSatisfaction(["current_recipient_closeup"], {
      pathway: "post_surgery",
      requiredKeys: POST_REQUIRED,
    });
    assert.ok(result.satisfiedKeys.has("current_recipient_closeup"));
    assert.ok(!result.satisfiedKeys.has("preop_front"));
  });

  it("surplus close-up may fill front after close-up is already exact-satisfied", () => {
    const result = resolvePatientPhotoSatisfaction(
      ["current_recipient_closeup", "current_recipient_closeup"],
      { pathway: "post_surgery", requiredKeys: POST_REQUIRED }
    );
    assert.ok(result.satisfiedKeys.has("current_recipient_closeup"));
    assert.ok(result.satisfiedKeys.has("preop_front"));
  });

  it("post-surgery labels use Current* wording for pathway and bucket keys", () => {
    assert.equal(auditorPatientPhotoCategoryLabel("preop_front", "post_surgery"), "Current Front View");
    assert.equal(
      auditorPatientPhotoCategoryLabel("current_recipient_closeup", "post_surgery"),
      "Current Recipient Close-up"
    );
    assert.equal(auditorPatientPhotoCategoryLabel("patient_current_top", "post_surgery"), "Current Top View");
    assert.match(auditorPatientPhotoCategoryLabel("preop_front", "pre_surgery"), /Before Surgery/i);
  });

  it("pinned auditor keys include legacy current buckets for post-surgery", () => {
    assert.ok(POST_SURGERY_PINNED_CATEGORY_KEYS.includes("patient_current_front"));
    assert.ok(POST_SURGERY_PINNED_CATEGORY_KEYS.includes("preop_front"));
  });

  it("wide-view equivalence helper is symmetric", () => {
    assert.equal(areWideViewEquivalentCategories("preop_front", "patient_current_front"), true);
    assert.equal(areWideViewEquivalentCategories("preop_front", "current_recipient_closeup"), false);
  });
});
