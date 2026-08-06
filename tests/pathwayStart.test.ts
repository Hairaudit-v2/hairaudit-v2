/**
 * HA-PATHWAY-START-403-FIX — pathway start classification + UI/API contract.
 * Run: pnpm tsx --test tests/pathwayStart.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  authReturnPathForPathway,
  classifyPathwayStartActor,
  photosStepForCase,
  professionalRoleBlock,
} from "@/lib/patient/pathwayStart";

const prevAuditorOverride = process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE;
const prevNodeEnv = process.env.NODE_ENV;

test("classifyPathwayStartActor: anonymous null user", () => {
  const r = classifyPathwayStartActor({ user: null, profileRole: null });
  assert.equal(r.authClass, "anonymous");
  assert.equal(r.resolvedRole, null);
  assert.equal(r.profilePresent, false);
});

test("classifyPathwayStartActor: anonymous draft session without profile", () => {
  const r = classifyPathwayStartActor({
    user: { id: "a1", is_anonymous: true, email: null },
    profileRole: null,
  });
  assert.equal(r.authClass, "anonymous");
  assert.equal(r.resolvedRole, null);
});

test("classifyPathwayStartActor: permanent user missing profile is not invented patient", () => {
  const r = classifyPathwayStartActor({
    user: { id: "u1", email: "a@b.com", is_anonymous: false, app_metadata: { provider: "google" } },
    profileRole: null,
  });
  assert.equal(r.authClass, "authenticated_no_profile");
  assert.equal(r.resolvedRole, null);
  assert.equal(r.profilePresent, false);
});

test("classifyPathwayStartActor: patient profile", () => {
  const r = classifyPathwayStartActor({
    user: { id: "u1", email: "a@b.com" },
    profileRole: "patient",
  });
  assert.equal(r.authClass, "patient");
  assert.equal(r.resolvedRole, "patient");
});

test("classifyPathwayStartActor: auditor profile cannot start patient pathway", () => {
  process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE = "false";
  process.env.NODE_ENV = "production";
  const r = classifyPathwayStartActor({
    user: { id: "u1", email: "someone@example.com" },
    profileRole: "auditor",
  });
  assert.equal(r.authClass, "auditor");
  const block = professionalRoleBlock({
    authClass: r.authClass,
    resolvedRole: r.resolvedRole,
    pathway: "pre_surgery",
  });
  assert.ok(block);
  assert.equal(block?.code, "ROLE_NOT_ALLOWED");
  assert.equal(block?.next, "/dashboard/auditor");
  assert.doesNotMatch(block?.next ?? "", /dashboard\/patient/);
  if (prevAuditorOverride === undefined) delete process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE;
  else process.env.ALLOW_AUDITOR_EMAIL_OVERRIDE = prevAuditorOverride;
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNodeEnv;
});

test("classifyPathwayStartActor: doctor is professional block", () => {
  const r = classifyPathwayStartActor({
    user: { id: "u1", email: "doc@example.com" },
    profileRole: "doctor",
  });
  assert.equal(r.authClass, "professional");
  const block = professionalRoleBlock({
    authClass: r.authClass,
    resolvedRole: r.resolvedRole,
    pathway: "pre_surgery",
  });
  assert.equal(block?.next, "/dashboard/doctor");
});

test("professionalRoleBlock: patients and anonymous are not blocked", () => {
  assert.equal(
    professionalRoleBlock({
      authClass: "patient",
      resolvedRole: "patient",
      pathway: "pre_surgery",
    }),
    null
  );
  assert.equal(
    professionalRoleBlock({
      authClass: "anonymous",
      resolvedRole: null,
      pathway: "pre_surgery",
    }),
    null
  );
  assert.equal(
    professionalRoleBlock({
      authClass: "authenticated_no_profile",
      resolvedRole: null,
      pathway: "pre_surgery",
    }),
    null
  );
});

test("photosStepForCase and authReturnPath preserve pathway", () => {
  assert.equal(photosStepForCase("c1", "pre_surgery"), "/cases/c1/patient/photos");
  assert.equal(
    photosStepForCase("c1", "post_surgery", "donor_healing"),
    "/cases/c1/patient/photos?entry_context=donor_healing"
  );
  assert.equal(authReturnPathForPathway("pre_surgery"), "/request-review?pathway=pre_surgery");
});

test("StartFreeAuditButton never surfaces raw Forbidden", () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), "src/components/audit/StartFreeAuditButton.tsx"),
    "utf8"
  );
  assert.match(src, /HA-PATHWAY-START-403-FIX/);
  assert.match(src, /ROLE_NOT_ALLOWED/);
  assert.match(src, /PROFILE_REQUIRED/);
  assert.match(src, /EXISTING_CASE/);
  assert.match(src, /UNAUTHORIZED/);
  assert.match(src, /cannot start a patient review/);
});

test("audit/start emits structured pathway-start diagnostics and codes", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src/app/api/audit/start/route.ts"), "utf8");
  assert.match(src, /logPathwayStart/);
  assert.match(src, /ROLE_NOT_ALLOWED/);
  assert.match(src, /PROFILE_REQUIRED/);
  assert.match(src, /EXISTING_CASE/);
  assert.match(src, /provisionPatientProfileForPathwayStart/);
  assert.match(src, /findResumablePatientDraft/);
  assert.match(src, /createResponseCookieSupabaseClient/);
  assert.match(src, /applyCookies/);
  assert.match(src, /signInAnonymously/);
  assert.doesNotMatch(src, /error:\s*"Forbidden"/);
});

test("createAuditCase auditor rejection uses ROLE_NOT_ALLOWED not Forbidden", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src/lib/cases/createCase.ts"), "utf8");
  assert.match(src, /ROLE_NOT_ALLOWED/);
  assert.doesNotMatch(src, /error:\s*"Forbidden"/);
});
