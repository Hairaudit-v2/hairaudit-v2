import assert from "node:assert/strict";
import { beforeEach, afterEach, describe, it } from "node:test";

import { signHaNexusRequestForTests } from "@/lib/nexus/haNexusWebhookAuth.server";
import { handleNexusProvisionHttp } from "@/lib/nexus/haNexusApi.server";
import {
  claimAccountWithToken,
  createClaimTokenForClinicProfile,
  validateAccountClaimToken,
} from "@/lib/nexus/accountClaim.server";
import { createHaNexusTestStore } from "@/lib/nexus/nexusProvisioningTestStore";
import { provisionExternalClinicFromNexus } from "@/lib/nexus/provisionExternalClinic.server";
import { evaluateProfessionalAccess } from "@/lib/nexus/professionalAccess.server";

const SECRET = "ha-nexus-test-secret-value";
const GLOBAL_CLINIC_ID = "fi_os:clinic:001";
const CLINIC_USER = "clinic-user-1";
const OTHER_USER = "clinic-user-2";

function baseClinicPayload(over: Record<string, unknown> = {}) {
  return {
    entityType: "clinic" as const,
    globalClinicId: GLOBAL_CLINIC_ID,
    clinicName: "Network Clinic Istanbul",
    primaryContactEmail: "clinic@example.com",
    primaryContactName: "Clinic Admin",
    sourceSystem: "fi_os",
    entitlementKeys: ["clinical_audit_upload", "case_creation", "report_access"],
    approvalStatus: "pending",
    ...over,
  };
}

function signedHeaders(rawBody: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const { signature } = signHaNexusRequestForTests({ secret: SECRET, timestamp, rawBody });
  return {
    get(name: string) {
      if (name === "x-ha-nexus-webhook-timestamp") return timestamp;
      if (name === "x-ha-nexus-webhook-signature") return signature;
      return null;
    },
  };
}

describe("ha nexus clinic provisioning", () => {
  let store: ReturnType<typeof createHaNexusTestStore>;
  let envSnap: NodeJS.ProcessEnv;

  beforeEach(() => {
    store = createHaNexusTestStore();
    envSnap = { ...process.env };
    process.env.HA_NEXUS_ALLOWED_SOURCES = "fi_os,iiohr";
    process.env.HA_ACCOUNT_CLAIM_TOKEN_SECRET = "test-claim-secret-min-16-chars";
  });

  afterEach(() => {
    process.env = envSnap;
  });

  it("valid signed clinic provision succeeds", async () => {
    const result = await provisionExternalClinicFromNexus(baseClinicPayload(), store.client);
    assert.equal(result.ok, true);
  });

  it("invalid HMAC clinic provision fails", async () => {
    const rawBody = JSON.stringify(baseClinicPayload());
    const res = await handleNexusProvisionHttp(
      {
        headers: {
          get(name: string) {
            if (name === "x-ha-nexus-webhook-timestamp") return String(Math.floor(Date.now() / 1000));
            if (name === "x-ha-nexus-webhook-signature") return "00".repeat(32);
            return null;
          },
        } as unknown as Headers,
      },
      rawBody,
      { enabled: true, secret: SECRET }
    );
    assert.equal(res.httpStatus, 401);
  });

  it("disabled receiver fails closed for clinic provision", async () => {
    const rawBody = JSON.stringify(baseClinicPayload());
    const res = await handleNexusProvisionHttp(
      { headers: signedHeaders(rawBody) as unknown as Headers },
      rawBody,
      { enabled: false, secret: SECRET }
    );
    assert.equal(res.httpStatus, 403);
  });

  it("clinic provision is idempotent by global clinic id", async () => {
    const first = await provisionExternalClinicFromNexus(baseClinicPayload(), store.client);
    assert.equal(first.ok, true);
    const second = await provisionExternalClinicFromNexus(
      baseClinicPayload({ approvalStatus: "approved", primaryContactEmail: "other@example.com" }),
      store.client
    );
    assert.equal(second.ok, true);
    assert.equal(store.clinicProfiles.size, 1);
    const profile = [...store.clinicProfiles.values()][0];
    assert.equal(profile.external_clinic_id, GLOBAL_CLINIC_ID);
  });

  it("links clinic by external clinic anchor, not email alone", async () => {
    store.client.from("clinic_profiles").insert({
      linked_user_id: "legacy-user",
      clinic_name: "Legacy Clinic",
      clinic_email: "clinic@example.com",
      external_clinic_id: null,
      participation_approval_status: "approved",
      participation_status: "active",
    });

    const result = await provisionExternalClinicFromNexus(baseClinicPayload(), store.client);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.httpStatus, 409);
      assert.match(result.error, /email_only_profile_without_external_anchor/);
    }
    assert.equal(store.clinicProfiles.size, 1);
  });

  it("creates inactive clinic shell and claim token", async () => {
    const result = await provisionExternalClinicFromNexus(baseClinicPayload(), store.client);
    assert.equal(result.ok, true);
    const profile = [...store.clinicProfiles.values()][0];
    assert.equal(profile.linked_user_id, null);
    assert.ok([...store.claimTokens.values()].some((t) => t.clinic_profile_id === profile.id));
  });

  it("clinic claim token validates with safe metadata", async () => {
    const result = await provisionExternalClinicFromNexus(baseClinicPayload(), store.client);
    assert.equal(result.ok, true);
    const profile = [...store.clinicProfiles.values()][0];
    const created = await createClaimTokenForClinicProfile(store.client, {
      clinicProfileId: profile.id,
      globalClinicId: GLOBAL_CLINIC_ID,
      intendedEmail: "clinic@example.com",
      clinicName: "Network Clinic Istanbul",
    });
    const validation = await validateAccountClaimToken(store.client, created.plaintextToken);
    assert.equal(validation.valid, true);
    if (validation.valid) {
      assert.equal(validation.subjectType, "clinic");
      assert.equal(validation.displayName, "Network Clinic Istanbul");
      assert.match(validation.maskedEmail, /\*/);
    }
  });

  it("clinic claim links authenticated user and blocks hijack", async () => {
    const result = await provisionExternalClinicFromNexus(baseClinicPayload(), store.client);
    assert.equal(result.ok, true);
    const profile = [...store.clinicProfiles.values()][0];
    const created = await createClaimTokenForClinicProfile(store.client, {
      clinicProfileId: profile.id,
      globalClinicId: GLOBAL_CLINIC_ID,
      intendedEmail: "clinic@example.com",
    });

    const claim = await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: CLINIC_USER,
      userEmail: "clinic@example.com",
    });
    assert.equal(claim.ok, true);
    if (claim.ok) assert.equal(claim.subjectType, "clinic");

    const hijack = await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: OTHER_USER,
    });
    assert.equal(hijack.ok, false);
  });

  it("approved network clinic can access own actions; pending is blocked", async () => {
    await provisionExternalClinicFromNexus(baseClinicPayload({ approvalStatus: "pending" }), store.client);
    const profile = [...store.clinicProfiles.values()][0];
    const created = await createClaimTokenForClinicProfile(store.client, {
      clinicProfileId: profile.id,
      globalClinicId: GLOBAL_CLINIC_ID,
      intendedEmail: "clinic@example.com",
    });
    await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: CLINIC_USER,
    });
    store.profiles.set(CLINIC_USER, {
      id: CLINIC_USER,
      role: "clinic",
      email: "clinic@example.com",
      updated_at: new Date().toISOString(),
    });

    const pending = await evaluateProfessionalAccess({
      admin: store.client,
      userId: CLINIC_USER,
      userEmail: "clinic@example.com",
      profileRole: "clinic",
      action: "case_create",
    });
    assert.equal(pending.allowed, false);

    await provisionExternalClinicFromNexus(
      baseClinicPayload({ approvalStatus: "approved" }),
      store.client
    );

    const approved = await evaluateProfessionalAccess({
      admin: store.client,
      userId: CLINIC_USER,
      userEmail: "clinic@example.com",
      profileRole: "clinic",
      action: "case_create",
    });
    assert.equal(approved.allowed, true);
    if (approved.allowed) assert.equal(approved.mode, "nexus");
  });

  it("suspended network clinic is blocked", async () => {
    await provisionExternalClinicFromNexus(baseClinicPayload({ approvalStatus: "approved" }), store.client);
    const profile = [...store.clinicProfiles.values()][0];
    const created = await createClaimTokenForClinicProfile(store.client, {
      clinicProfileId: profile.id,
      globalClinicId: GLOBAL_CLINIC_ID,
      intendedEmail: "clinic@example.com",
    });
    await claimAccountWithToken(store.client, {
      token: created.plaintextToken,
      userId: CLINIC_USER,
    });
    store.profiles.set(CLINIC_USER, {
      id: CLINIC_USER,
      role: "clinic",
      email: "clinic@example.com",
      updated_at: new Date().toISOString(),
    });

    await provisionExternalClinicFromNexus(
      baseClinicPayload({ approvalStatus: "suspended" }),
      store.client
    );

    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: CLINIC_USER,
      userEmail: "clinic@example.com",
      profileRole: "clinic",
      action: "upload",
    });
    assert.equal(decision.allowed, false);
  });
});
