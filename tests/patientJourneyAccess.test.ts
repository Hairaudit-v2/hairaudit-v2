import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildPatientLoginHref,
  PATIENT_LOGIN_PATH,
} from "../src/lib/auth/patientLogin";
import { dashboardPathForRole, sanitizeNextPath } from "../src/lib/auth/redirects";
import {
  buildPatientRequiredPhotosSubmitError,
  PATHWAY_CHOOSER_HREF,
  PATHWAY_EVIDENCE_PACKS,
  parseExplicitPatientReviewPathway,
  isPathwayRequiredUploadComplete,
} from "../src/lib/patient/patientReviewPathway";
import { buildPatientResumeReviewViewModel } from "../src/lib/patient/patientResumeReview";

describe("patient journey access — login and redirects", () => {
  it("patient login href preserves internal return path", () => {
    assert.equal(
      buildPatientLoginHref("/cases/abc/patient/photos"),
      "/login?from=patient&next=%2Fcases%2Fabc%2Fpatient%2Fphotos"
    );
  });

  it("patient login href rejects external next paths", () => {
    assert.equal(buildPatientLoginHref("https://evil.com"), `${PATIENT_LOGIN_PATH}?from=patient`);
  });

  it("dashboardPathForRole sends patients to /dashboard/patient", () => {
    assert.equal(dashboardPathForRole("patient"), "/dashboard/patient");
    assert.equal(dashboardPathForRole(null), "/dashboard/patient");
  });

  it("pathway chooser is the canonical public entry", () => {
    assert.equal(PATHWAY_CHOOSER_HREF, "/request-review#choose-pathway");
  });

  it("sanitizeNextPath blocks auditor login hijack", () => {
    assert.equal(sanitizeNextPath("/login/auditor"), "/login/auditor");
    assert.equal(sanitizeNextPath("//evil.com"), null);
  });
});

describe("patient journey access — dual pathway uploads", () => {
  it("pre_surgery requires exactly 5 required views", () => {
    assert.equal(PATHWAY_EVIDENCE_PACKS.pre_surgery.requiredPhotoKeys.length, 5);
  });

  it("post_surgery requires exactly 5 required views", () => {
    assert.equal(PATHWAY_EVIDENCE_PACKS.post_surgery.requiredPhotoKeys.length, 5);
  });

  it("optional uploads do not block required completion", () => {
    const requiredOnly = PATHWAY_EVIDENCE_PACKS.pre_surgery.requiredPhotoKeys.map((key) => ({
      type: `patient_photo:${key}`,
    }));
    assert.equal(isPathwayRequiredUploadComplete("pre_surgery", requiredOnly), true);
  });

  it("submit error message references pathway required count", () => {
    const msg = buildPatientRequiredPhotosSubmitError("post_surgery");
    assert.match(msg, /5 required photos/);
    assert.doesNotMatch(msg, /Forensic|AI|GPT/i);
  });
});

describe("patient journey access — resume and pathway parsing", () => {
  it("rejects missing pathway at creation time", () => {
    assert.equal(parseExplicitPatientReviewPathway(undefined), null);
    assert.equal(parseExplicitPatientReviewPathway("pre_surgery"), "pre_surgery");
  });

  it("no open case does not invent a case id", () => {
    const model = buildPatientResumeReviewViewModel({ contexts: [] });
    assert.equal(model.step, "no_open_case");
    assert.equal(model.primaryCase, null);
  });
});

describe("patient journey access — env and client safety", () => {
  it("browser client does not reference service role key", () => {
    const clientSrc = fs.readFileSync(
      path.join(process.cwd(), "src/lib/supabase/client.ts"),
      "utf8"
    );
    assert.doesNotMatch(clientSrc, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(clientSrc, /createSupabaseAdminClient/);
  });

  it("validateAuthEnv module documents patient-critical public vars", () => {
    const envSrc = fs.readFileSync(
      path.join(process.cwd(), "src/lib/auth/validateAuthEnv.ts"),
      "utf8"
    );
    assert.match(envSrc, /NEXT_PUBLIC_SUPABASE_URL/);
    assert.match(envSrc, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    assert.match(envSrc, /SUPABASE_SERVICE_ROLE_KEY/);
  });
});
