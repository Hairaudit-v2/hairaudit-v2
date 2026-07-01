import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  claimAccountWithToken,
  createClaimTokenForDoctorProfile,
  getClaimStatusForDoctorProfile,
  revokeClaimTokensForDoctorProfile,
  validateAccountClaimToken,
} from "@/lib/nexus/accountClaim.server";
import {
  generateAccountClaimToken,
  hashAccountClaimToken,
} from "@/lib/nexus/accountClaimToken.server";
import { createHaNexusTestStore } from "@/lib/nexus/nexusProvisioningTestStore";
import { evaluateProfessionalAccess } from "@/lib/nexus/professionalAccess.server";
import { provisionExternalProfessionalFromNexus } from "@/lib/nexus/provisionExternalProfessional.server";

const GLOBAL_ID = "iiohr:prof:claim-test";
const USER_ID = "claim-user-1";
const OTHER_USER = "claim-user-2";

function basePayload(over: Record<string, unknown> = {}) {
  return {
    globalProfessionalId: GLOBAL_ID,
    email: "surgeon@example.com",
    fullName: "Dr Claim Test",
    professionalRole: "hair_surgeon",
    sourceSystem: "iiohr",
    entitlementKeys: ["clinical_audit_upload", "case_creation"],
    approvalStatus: "pending",
    ...over,
  };
}

async function provisionShell(store: ReturnType<typeof createHaNexusTestStore>, approvalStatus = "pending") {
  const result = await provisionExternalProfessionalFromNexus(
    basePayload({ approvalStatus }),
    store.client
  );
  assert.equal(result.ok, true);
  const profile = [...store.doctorProfiles.values()].find((p) => p.external_provider_id === GLOBAL_ID);
  assert.ok(profile);
  return profile!;
}

describe("accountClaimToken crypto", () => {
  it("stores hash only — plaintext differs from persisted hash", async () => {
    const store = createHaNexusTestStore();
    process.env.HA_ACCOUNT_CLAIM_TOKEN_SECRET = "test-claim-secret-min-16-chars";

    store.client.from("doctor_profiles").insert({
      linked_user_id: null,
      doctor_name: "Dr Shell",
      doctor_email: "surgeon@example.com",
      external_provider_id: GLOBAL_ID,
      participation_approval_status: "pending_review",
      participation_status: "not_started",
    });
    const doctorProfileId = [...store.doctorProfiles.values()][0].id;

    const created = await createClaimTokenForDoctorProfile(store.client, {
      doctorProfileId,
      globalProfessionalId: GLOBAL_ID,
      intendedEmail: "surgeon@example.com",
    });

    const token = generateAccountClaimToken();
    const hash = hashAccountClaimToken(token);
    assert.notEqual(token, hash);
    assert.match(hash, /^[a-f0-9]{64}$/);

    const stored = [...store.claimTokens.values()][0];
    assert.equal(stored.token_hash, hashAccountClaimToken(created.plaintextToken));
    assert.notEqual(stored.token_hash, created.plaintextToken);

    const validation = await validateAccountClaimToken(store.client, created.plaintextToken);
    assert.equal(validation.valid, true);
  });
});

describe("accountClaim lifecycle", () => {
  let store: ReturnType<typeof createHaNexusTestStore>;
  let envSnap: NodeJS.ProcessEnv;

  beforeEach(() => {
    store = createHaNexusTestStore();
    envSnap = { ...process.env };
    process.env.HA_ACCOUNT_CLAIM_TOKEN_SECRET = "test-claim-secret-min-16-chars";
    process.env.HA_NEXUS_ALLOWED_SOURCES = "fi_os,iiohr";
    process.env.HA_ALLOW_PUBLIC_PATIENT_AUDITS = "true";
    process.env.HA_REQUIRE_LOCAL_APPROVAL_FOR_STANDALONE_PROFESSIONALS = "true";
  });

  afterEach(() => {
    process.env = envSnap;
  });

  it("invalid token fails validation", async () => {
    const validation = await validateAccountClaimToken(store.client, "not-a-valid-token");
    assert.equal(validation.valid, false);
    if (!validation.valid) assert.equal(validation.reason, "malformed");
  });

  it("expired token fails validation and claim", async () => {
    const shell = await provisionShell(store);
    const created = await createClaimTokenForDoctorProfile(store.client, {
      doctorProfileId: shell.id,
      globalProfessionalId: GLOBAL_ID,
      intendedEmail: "surgeon@example.com",
      ttlMs: -1000,
    });

    const validation = await validateAccountClaimToken(store.client, created.plaintextToken);
    assert.equal(validation.valid, false);
    if (!validation.valid) assert.equal(validation.reason, "expired");

    const claim = await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: USER_ID,
      userEmail: "surgeon@example.com",
    });
    assert.equal(claim.ok, false);
  });

  it("revoked token fails", async () => {
    const shell = await provisionShell(store);
    const created = await createClaimTokenForDoctorProfile(store.client, {
      doctorProfileId: shell.id,
      globalProfessionalId: GLOBAL_ID,
      intendedEmail: "surgeon@example.com",
    });
    await revokeClaimTokensForDoctorProfile(store.client, shell.id);

    const validation = await validateAccountClaimToken(store.client, created.plaintextToken);
    assert.equal(validation.valid, false);
    if (!validation.valid) assert.equal(validation.reason, "revoked");
  });

  it("already claimed token fails", async () => {
    const shell = await provisionShell(store);
    const created = await createClaimTokenForDoctorProfile(store.client, {
      doctorProfileId: shell.id,
      globalProfessionalId: GLOBAL_ID,
      intendedEmail: "surgeon@example.com",
    });

    const first = await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: USER_ID,
      userEmail: "newdoctor@example.com",
    });
    assert.equal(first.ok, true);

    const second = await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: OTHER_USER,
      userEmail: "other@example.com",
    });
    assert.equal(second.ok, false);
  });

  it("links doctor shell to authenticated user by token/global_professional_id", async () => {
    const shell = await provisionShell(store, "approved");
    const created = await createClaimTokenForDoctorProfile(store.client, {
      doctorProfileId: shell.id,
      globalProfessionalId: GLOBAL_ID,
      intendedEmail: "surgeon@example.com",
    });

    const claim = await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: USER_ID,
      userEmail: "different@example.com",
    });
    assert.equal(claim.ok, true);

    const linked = store.doctorProfiles.get(shell.id);
    assert.equal(linked?.linked_user_id, USER_ID);
    assert.equal(store.profiles.get(USER_ID)?.role, "doctor");
  });

  it("cannot link by email alone — token required even when email matches", async () => {
    const shell = await provisionShell(store);
    assert.equal(shell.linked_user_id, null);

    const claim = await claimAccountWithToken(store.client, {
      token: "a".repeat(64),
      userId: USER_ID,
      userEmail: shell.doctor_email ?? "surgeon@example.com",
    });
    assert.equal(claim.ok, false);
    assert.equal(store.doctorProfiles.get(shell.id)?.linked_user_id, null);
  });

  it("already linked doctor profile cannot be hijacked", async () => {
    const shell = await provisionShell(store);
    store.doctorProfiles.set(shell.id, { ...shell, linked_user_id: "existing-owner" });

    const plaintextToken = generateAccountClaimToken();
    const tokenHash = hashAccountClaimToken(plaintextToken);
    store.claimTokens.set(tokenHash, {
      id: crypto.randomUUID(),
      token_hash: tokenHash,
      global_professional_id: GLOBAL_ID,
      doctor_profile_id: shell.id,
      external_professional_id: GLOBAL_ID,
      intended_email_snapshot: "surgeon@example.com",
      role_snapshot: "doctor",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      claimed_at: null,
      revoked_at: null,
      created_by_system: "nexus",
      created_by_user_id: null,
      consumed_by_user_id: null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const claim = await claimAccountWithToken(store.client, {
      token: plaintextToken,
      userId: USER_ID,
    });
    assert.equal(claim.ok, false);
  });

  it("user with existing unrelated doctor profile cannot claim another profile", async () => {
    const shell = await provisionShell(store);
    store.client.from("doctor_profiles").insert({
      linked_user_id: USER_ID,
      doctor_name: "Other Doctor",
      doctor_email: "other@example.com",
      external_provider_id: null,
      participation_approval_status: "approved",
      participation_status: "active",
    });

    const created = await createClaimTokenForDoctorProfile(store.client, {
      doctorProfileId: shell.id,
      globalProfessionalId: GLOBAL_ID,
      intendedEmail: "surgeon@example.com",
    });

    const claim = await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: USER_ID,
    });
    assert.equal(claim.ok, false);
  });

  it("patient profile cannot silently claim doctor access", async () => {
    const shell = await provisionShell(store);
    store.client.from("profiles").insert({ id: USER_ID, role: "patient", email: "patient@example.com" });

    const created = await createClaimTokenForDoctorProfile(store.client, {
      doctorProfileId: shell.id,
      globalProfessionalId: GLOBAL_ID,
      intendedEmail: "surgeon@example.com",
    });

    const claim = await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: USER_ID,
    });
    assert.equal(claim.ok, false);
    assert.equal(store.profiles.get(USER_ID)?.role, "patient");
  });

  it("supersedes prior active token when creating a new one", async () => {
    const shell = await provisionShell(store);
    const first = await createClaimTokenForDoctorProfile(store.client, {
      doctorProfileId: shell.id,
      globalProfessionalId: GLOBAL_ID,
      intendedEmail: "surgeon@example.com",
    });
    const second = await createClaimTokenForDoctorProfile(store.client, {
      doctorProfileId: shell.id,
      globalProfessionalId: GLOBAL_ID,
      intendedEmail: "surgeon@example.com",
      resend: true,
    });

    const firstValidation = await validateAccountClaimToken(store.client, first.plaintextToken);
    assert.equal(firstValidation.valid, false);
    const secondValidation = await validateAccountClaimToken(store.client, second.plaintextToken);
    assert.equal(secondValidation.valid, true);
  });

  it("provision creates claim token for inactive shell", async () => {
    await provisionShell(store);
    assert.equal(store.claimTokens.size, 1);
    const status = await getClaimStatusForDoctorProfile(
      store.client,
      [...store.doctorProfiles.values()][0].id
    );
    assert.ok(status?.hasActiveToken);
  });

  it("pending network doctor remains blocked after claim", async () => {
    const shell = await provisionShell(store, "pending");
    const created = await createClaimTokenForDoctorProfile(store.client, {
      doctorProfileId: shell.id,
      globalProfessionalId: GLOBAL_ID,
      intendedEmail: "surgeon@example.com",
    });
    await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: USER_ID,
      userEmail: "surgeon@example.com",
    });

    store.client.from("profiles").insert({ id: USER_ID, role: "doctor", email: "surgeon@example.com" });

    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: USER_ID,
      userEmail: "surgeon@example.com",
      profileRole: "doctor",
      action: "upload",
    });
    assert.equal(decision.allowed, false);
  });

  it("approved network doctor gains access after claim", async () => {
    const shell = await provisionShell(store, "approved");
    const created = await createClaimTokenForDoctorProfile(store.client, {
      doctorProfileId: shell.id,
      globalProfessionalId: GLOBAL_ID,
      intendedEmail: "surgeon@example.com",
    });
    await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: USER_ID,
      userEmail: "surgeon@example.com",
    });
    store.client.from("profiles").insert({ id: USER_ID, role: "doctor", email: "surgeon@example.com" });

    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: USER_ID,
      userEmail: "surgeon@example.com",
      profileRole: "doctor",
      action: "upload",
    });
    assert.equal(decision.allowed, true);
    if (decision.allowed) assert.equal(decision.mode, "nexus");
  });

  it("unlinked network shell remains blocked for doctor access", async () => {
    await provisionShell(store, "approved");

    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: USER_ID,
      userEmail: "surgeon@example.com",
      profileRole: "doctor",
      action: "upload",
    });
    assert.equal(decision.allowed, false);
  });

  it("writes audit events for create, claim, fail, and revoke", async () => {
    const shell = await provisionShell(store);
    assert.ok(store.linkAudits.some((a) => a.action === "token_created"));

    await revokeClaimTokensForDoctorProfile(store.client, shell.id);
    assert.ok(store.linkAudits.some((a) => a.action === "token_revoked"));

    const created = await createClaimTokenForDoctorProfile(store.client, {
      doctorProfileId: shell.id,
      globalProfessionalId: GLOBAL_ID,
      intendedEmail: "surgeon@example.com",
    });

    await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: USER_ID,
    });
    assert.ok(store.linkAudits.some((a) => a.action === "token_claimed"));

    await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: OTHER_USER,
    });
    assert.ok(store.linkAudits.some((a) => a.action === "claim_failed"));
  });
});

describe("standalone and patient paths unchanged", () => {
  let store: ReturnType<typeof createHaNexusTestStore>;
  let envSnap: NodeJS.ProcessEnv;

  beforeEach(() => {
    store = createHaNexusTestStore();
    envSnap = { ...process.env };
    process.env.HA_ALLOW_PUBLIC_PATIENT_AUDITS = "true";
    process.env.HA_REQUIRE_LOCAL_APPROVAL_FOR_STANDALONE_PROFESSIONALS = "true";
  });

  afterEach(() => {
    process.env = envSnap;
  });

  it("standalone doctors still work without Nexus token", async () => {
    store.client.from("doctor_profiles").insert({
      linked_user_id: USER_ID,
      doctor_name: "Dr Standalone",
      doctor_email: "standalone@example.com",
      external_provider_id: null,
      participation_approval_status: "approved",
      participation_status: "active",
    });

    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: USER_ID,
      userEmail: "standalone@example.com",
      profileRole: "doctor",
      action: "upload",
    });
    assert.equal(decision.allowed, true);
    if (decision.allowed) assert.equal(decision.mode, "standalone");
  });

  it("patient audit flow unchanged", async () => {
    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: "patient-user",
      userEmail: "patient@example.com",
      profileRole: "patient",
      action: "case_create",
    });
    assert.equal(decision.allowed, true);
    if (decision.allowed) assert.equal(decision.mode, "patient");
  });
});
