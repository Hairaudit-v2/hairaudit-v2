/**
 * FI-OUTCOME-INTELLIGENCE-1A — HMAC identity tests.
 * Run: pnpm exec tsx --test tests/outcomeCohortIdentity.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CohortHmacSecretMissingError,
  COHORT_PROCEDURE_NAMESPACE,
  COHORT_SUBJECT_NAMESPACE,
  deriveCohortPartitionKey,
  deriveCohortProcedureKey,
  deriveCohortSubjectKey,
  hmacCohortKey,
} from "@/lib/outcomeIntelligence/cohortIdentity";
import {
  assertCohortMaterializationAllowed,
  resolveOutcomeCohortConfig,
} from "@/lib/outcomeIntelligence/cohortConfig";
import { TEST_HMAC_SECRET } from "./outcomeCohortTestHelpers";

describe("FI-OUTCOME-INTELLIGENCE-1A identity", () => {
  it("13. deterministic patient HMAC", () => {
    const a = deriveCohortSubjectKey({
      secret: TEST_HMAC_SECRET,
      patientId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    });
    const b = deriveCohortSubjectKey({
      secret: TEST_HMAC_SECRET,
      patientId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    });
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it("14. deterministic procedure HMAC", () => {
    const a = deriveCohortProcedureKey({
      secret: TEST_HMAC_SECRET,
      caseId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    const b = deriveCohortProcedureKey({
      secret: TEST_HMAC_SECRET,
      caseId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    assert.equal(a, b);
  });

  it("15. namespaces produce different keys", () => {
    const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const patientNs = hmacCohortKey({
      secret: TEST_HMAC_SECRET,
      namespace: COHORT_SUBJECT_NAMESPACE,
      stableIdentity: id,
    });
    const procedureNs = hmacCohortKey({
      secret: TEST_HMAC_SECRET,
      namespace: COHORT_PROCEDURE_NAMESPACE,
      stableIdentity: id,
    });
    assert.notEqual(patientNs, procedureNs);
    assert.notEqual(
      deriveCohortSubjectKey({ secret: TEST_HMAC_SECRET, patientId: id }),
      deriveCohortProcedureKey({ secret: TEST_HMAC_SECRET, caseId: id })
    );
  });

  it("raw ID not present in key; different identity → different key", () => {
    const caseId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const key = deriveCohortProcedureKey({
      secret: TEST_HMAC_SECRET,
      caseId,
    });
    assert.equal(key.includes(caseId), false);
    assert.equal(key.includes("aaaaaaaa"), false);
    const other = deriveCohortProcedureKey({
      secret: TEST_HMAC_SECRET,
      caseId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    });
    assert.notEqual(key, other);
    const partition = deriveCohortPartitionKey({ secret: TEST_HMAC_SECRET });
    assert.notEqual(partition, key);
  });

  it("16. missing secret fails closed when enabled", () => {
    assert.throws(
      () =>
        deriveCohortSubjectKey({
          secret: null,
          patientId: "x",
        }),
      (err: unknown) => err instanceof CohortHmacSecretMissingError
    );

    const gate = assertCohortMaterializationAllowed(
      resolveOutcomeCohortConfig(
        {},
        {
          enabled: true,
          hmacSecret: null,
          governanceApproved: true,
          minCohortSize: 10,
          isProduction: true,
        }
      )
    );
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.code, "MISSING_HMAC_SECRET");
  });

  it("17. disabled cohort does not pass gate", () => {
    const gate = assertCohortMaterializationAllowed({
      enabled: false,
      hmacSecret: TEST_HMAC_SECRET,
      governanceApproved: true,
      minCohortSize: 10,
      isProduction: false,
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.code, "FEATURE_DISABLED");
  });
});
