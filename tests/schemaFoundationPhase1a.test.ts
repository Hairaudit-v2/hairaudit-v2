import { describe, it } from "node:test";
import assert from "node:assert";
import { TRAINING_CASE_STATUSES as ACADEMY_TRAINING_CASE_STATUSES } from "../src/lib/academy/trainingCaseCorrections/constants";
import {
  CORE_TABLE_NAMES,
  CORE_TABLES_BASELINE_ONLY,
  CORE_TABLES_WITH_CREATE_DDL,
  caseStatusImplyingSubmitIsSubsetOfCatalog,
  contributionRequestStatusesAreDocumented,
  doctorCaseStatusesMatchMigrationEnum,
  isCoreTableName,
  trainingCaseStatusesMatchAcademyConstants,
} from "../src/lib/hairaudit/schemaRegistry";
import {
  CASE_STATUS_IMPLYING_SUBMIT_SET,
  CONTRIBUTION_REQUEST_STATUSES,
  DOCTOR_CASE_STATUSES,
  TRAINING_CASE_STATUSES,
} from "../src/lib/hairaudit/statusCatalog";
import { isCaseMarkedSuccessfullySubmitted } from "../src/lib/patient/caseSubmitStatus";

describe("schema foundation phase 1a", () => {
  it("registers all priority core tables", () => {
    assert.deepStrictEqual(CORE_TABLE_NAMES, [
      "cases",
      "reports",
      "uploads",
      "audit_photos",
      "case_evidence_manifests",
      "upload_audit_corrections",
      "doctor_cases",
      "community_cases",
      "training_cases",
      "profiles",
      "doctor_profiles",
      "clinic_profiles",
    ]);
    assert.strictEqual(CORE_TABLES_WITH_CREATE_DDL.length + CORE_TABLES_BASELINE_ONLY.length, CORE_TABLE_NAMES.length);
    for (const name of CORE_TABLE_NAMES) {
      assert.ok(isCoreTableName(name));
    }
  });

  it("keeps case post-submit statuses inside the central catalog", () => {
    assert.ok(caseStatusImplyingSubmitIsSubsetOfCatalog());
    for (const status of CASE_STATUS_IMPLYING_SUBMIT_SET) {
      assert.notEqual(status, "draft");
    }
  });

  it("aligns training case statuses with academy constants", () => {
    assert.ok(trainingCaseStatusesMatchAcademyConstants());
    assert.deepStrictEqual([...ACADEMY_TRAINING_CASE_STATUSES], [...TRAINING_CASE_STATUSES]);
  });

  it("documents contribution request statuses on cases inventory", () => {
    assert.ok(contributionRequestStatusesAreDocumented());
    for (const status of CONTRIBUTION_REQUEST_STATUSES) {
      assert.ok(status.startsWith("clinic_") || status.startsWith("doctor_") || status.startsWith("benchmark_"));
    }
  });

  it("matches doctor_case_status enum from migration", () => {
    assert.ok(doctorCaseStatusesMatchMigrationEnum());
    assert.strictEqual(DOCTOR_CASE_STATUSES.length, 6);
  });

  it("caseSubmitStatus uses central implying-submit set", () => {
    assert.ok(isCaseMarkedSuccessfullySubmitted({ status: "pdf_ready", submitted_at: null }));
    assert.ok(isCaseMarkedSuccessfullySubmitted({ status: "clinic_request_sent", submitted_at: null }));
    assert.equal(isCaseMarkedSuccessfullySubmitted({ status: "draft", submitted_at: null }), false);
  });
});
