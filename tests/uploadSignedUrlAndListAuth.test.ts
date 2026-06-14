import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseCaseIdFromCaseFilesPath,
  storagePathBelongsToCase,
  gateUploadSignedUrlStoragePath,
  filterUploadRowsToCaseStorageNamespace,
  isWellFormedCaseId,
} from "../src/lib/uploads/caseFilesPath";
import { uploadSignedUrlFetchPath } from "../src/lib/uploads/uploadSignedUrlClient";
import {
  isClinicCaseParticipant,
  isDoctorCaseParticipant,
  isPatientCaseParticipant,
  requireClinicCaseAccess,
  requireDoctorCaseAccess,
  requirePatientCaseAccess,
} from "../src/lib/auth/permissions";
import { isAuditor } from "../src/lib/auth/isAuditor";
import { resolveUploadTypePrefixForList } from "../src/lib/uploads/listTypePrefix";
import { canAccessCase } from "../src/lib/case-access";

const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("caseFilesPath", () => {
  it("parses audit_photos upload path", () => {
    const p = `audit_photos/${SAMPLE_CASE}/doctor/img_front/abc.png`;
    const r = parseCaseIdFromCaseFilesPath(p);
    assert.ok(r.ok);
    if (r.ok) {
      assert.strictEqual(r.caseId, SAMPLE_CASE);
      assert.strictEqual(r.normalizedPath, p);
    }
  });

  it("rejects audit_photos path traversal", () => {
    const r = parseCaseIdFromCaseFilesPath(`audit_photos/${SAMPLE_CASE}/../${SAMPLE_CASE}/x.png`);
    assert.strictEqual(r.ok, false);
  });

  it("parses a normal patient upload path", () => {
    const p = `cases/${SAMPLE_CASE}/patient/preop_front/1-photo.jpg`;
    const r = parseCaseIdFromCaseFilesPath(p);
    assert.ok(r.ok);
    if (r.ok) {
      assert.strictEqual(r.caseId, SAMPLE_CASE);
      assert.ok(r.normalizedPath.startsWith("cases/"));
    }
  });

  it("rejects path traversal segments", () => {
    const r = parseCaseIdFromCaseFilesPath(`cases/${SAMPLE_CASE}/../other/file.jpg`);
    assert.strictEqual(r.ok, false);
  });

  it("rejects encoded traversal", () => {
    const r = parseCaseIdFromCaseFilesPath(`cases/${SAMPLE_CASE}/%2e%2e/other/file.jpg`);
    assert.strictEqual(r.ok, false);
  });

  it("rejects non-case namespace", () => {
    const r = parseCaseIdFromCaseFilesPath(`other/${SAMPLE_CASE}/x.jpg`);
    assert.strictEqual(r.ok, false);
  });

  it("storagePathBelongsToCase rejects mismatched case id", () => {
    const other = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
    const p = `cases/${SAMPLE_CASE}/patient/x.jpg`;
    assert.strictEqual(storagePathBelongsToCase(other, p), false);
    assert.strictEqual(storagePathBelongsToCase(SAMPLE_CASE, p), true);
  });

  it("storagePathBelongsToCase accepts audit_photos namespace", () => {
    const p = `audit_photos/${SAMPLE_CASE}/patient/preop_front/uuid.jpg`;
    assert.strictEqual(storagePathBelongsToCase(SAMPLE_CASE, p), true);
  });
});

describe("uploadSignedUrlFetchPath (client helper)", () => {
  it("includes path and optional caseId query", () => {
    const p = `cases/${SAMPLE_CASE}/patient/x.jpg`;
    const u = new URL(uploadSignedUrlFetchPath(p), "http://example.test");
    assert.strictEqual(u.searchParams.get("path"), p);
    assert.strictEqual(u.searchParams.get("caseId"), null);
    const u2 = new URL(uploadSignedUrlFetchPath(p, SAMPLE_CASE), "http://example.test");
    assert.strictEqual(u2.searchParams.get("path"), p);
    assert.strictEqual(u2.searchParams.get("caseId"), SAMPLE_CASE);
  });
});

describe("gateUploadSignedUrlStoragePath", () => {
  it("rejects missing path", () => {
    const r = gateUploadSignedUrlStoragePath(null, null);
    assert.strictEqual(r.ok, false);
    if (!r.ok) assert.strictEqual(r.error, "Missing path");
  });

  it("rejects mismatched caseId query vs path", () => {
    const p = `cases/${SAMPLE_CASE}/patient/x.jpg`;
    const other = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
    const r = gateUploadSignedUrlStoragePath(p, other);
    assert.strictEqual(r.ok, false);
  });

  it("accepts path when optional caseId query matches", () => {
    const p = `cases/${SAMPLE_CASE}/patient/x.jpg`;
    const r = gateUploadSignedUrlStoragePath(p, SAMPLE_CASE);
    assert.ok(r.ok);
    if (r.ok) assert.strictEqual(r.caseId, SAMPLE_CASE);
  });

  it("accepts path when caseId query omitted", () => {
    const p = `cases/${SAMPLE_CASE}/patient/x.jpg`;
    const r = gateUploadSignedUrlStoragePath(p, null);
    assert.ok(r.ok);
  });
});

describe("filterUploadRowsToCaseStorageNamespace", () => {
  it("drops rows whose storage path targets another case namespace", () => {
    const other = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
    const rows = [
      { id: "1", storage_path: `cases/${SAMPLE_CASE}/patient/x.jpg`, type: "patient_photo:preop_front" },
      { id: "2", storage_path: `cases/${other}/patient/y.jpg`, type: "patient_photo:preop_front" },
    ];
    const out = filterUploadRowsToCaseStorageNamespace(SAMPLE_CASE, rows);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].id, "1");
  });
});

describe("isWellFormedCaseId", () => {
  it("accepts canonical uuid", () => {
    assert.strictEqual(isWellFormedCaseId(SAMPLE_CASE), true);
  });

  it("rejects invalid ids", () => {
    assert.strictEqual(isWellFormedCaseId("not-a-uuid"), false);
    assert.strictEqual(isWellFormedCaseId(""), false);
  });
});

describe("upload list auth primitives (sync)", () => {
  const caseRow = {
    id: SAMPLE_CASE,
    user_id: "owner-1",
    patient_id: "patient-1",
    doctor_id: "doc-1",
    clinic_id: "clinic-1",
  };

  it("patient participant matches owner or patient_id", () => {
    assert.strictEqual(isPatientCaseParticipant("owner-1", caseRow), true);
    assert.strictEqual(isPatientCaseParticipant("patient-1", caseRow), true);
    assert.strictEqual(isPatientCaseParticipant("stranger", caseRow), false);
  });

  it("doctor participant matches doctor_id only", () => {
    assert.strictEqual(isDoctorCaseParticipant("doc-1", caseRow), true);
    assert.strictEqual(isDoctorCaseParticipant("owner-1", caseRow), false);
  });

  it("clinic participant matches clinic_id only", () => {
    assert.strictEqual(isClinicCaseParticipant("clinic-1", caseRow), true);
    assert.strictEqual(isClinicCaseParticipant("doc-1", caseRow), false);
  });

  it("requirePatientCaseAccess denies unrelated user", () => {
    const r = requirePatientCaseAccess("stranger", caseRow);
    assert.strictEqual(r.ok, false);
  });

  it("requirePatientCaseAccess allows owner", () => {
    const r = requirePatientCaseAccess("owner-1", caseRow);
    assert.strictEqual(r.ok, true);
  });

  it("requireDoctorCaseAccess denies patient owner", () => {
    const r = requireDoctorCaseAccess("owner-1", caseRow);
    assert.strictEqual(r.ok, false);
  });

  it("requireDoctorCaseAccess allows assigned doctor", () => {
    const r = requireDoctorCaseAccess("doc-1", caseRow);
    assert.strictEqual(r.ok, true);
  });

  it("requireClinicCaseAccess allows assigned clinic", () => {
    const r = requireClinicCaseAccess("clinic-1", caseRow);
    assert.strictEqual(r.ok, true);
  });
});

describe("resolveUploadTypePrefixForList", () => {
  it("defaults to patient_photo colon prefix", () => {
    assert.strictEqual(resolveUploadTypePrefixForList(undefined), "patient_photo:");
    assert.strictEqual(resolveUploadTypePrefixForList(null), "patient_photo:");
    assert.strictEqual(resolveUploadTypePrefixForList("   "), "patient_photo:");
  });

  it("normalizes prefix without colon", () => {
    assert.strictEqual(resolveUploadTypePrefixForList("patient_photo"), "patient_photo:");
    assert.strictEqual(resolveUploadTypePrefixForList("surgery_photo"), "surgery_photo:");
  });

  it("preserves trailing colon", () => {
    assert.strictEqual(resolveUploadTypePrefixForList("patient_photo:"), "patient_photo:");
  });
});

describe("canAccessCase (portal-aligned)", () => {
  const row = {
    user_id: "owner-1",
    patient_id: "patient-1",
    doctor_id: "doc-1",
    clinic_id: "clinic-1",
  };

  it("denies unrelated user when role is not auditor", async () => {
    assert.strictEqual(await canAccessCase("stranger", row), false);
  });

  it("allows patient_id participant", async () => {
    assert.strictEqual(await canAccessCase("patient-1", row), true);
  });

  it("allows doctor_id participant", async () => {
    assert.strictEqual(await canAccessCase("doc-1", row), true);
  });
});

describe("isAuditor email fallback gating", () => {
  it("does not grant auditor via email alone when override is off and not development", () => {
    const prevNode = process.env.NODE_ENV;
    const prevOverride = process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE;
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE;
    assert.strictEqual(isAuditor({ profileRole: "patient", userEmail: "auditor@hairaudit.com" }), false);
    process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE = "true";
    assert.strictEqual(isAuditor({ profileRole: "patient", userEmail: "auditor@hairaudit.com" }), true);
    process.env.NODE_ENV = prevNode;
    if (prevOverride === undefined) delete process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE;
    else process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE = prevOverride;
  });
});
