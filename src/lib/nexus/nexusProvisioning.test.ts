import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { signHaNexusRequestForTests } from "@/lib/nexus/haNexusWebhookAuth.server";
import {
  evaluateNexusGate,
  handleNexusProvisionHttp,
  handleNexusRollbackHttp,
  handleNexusStateHttp,
} from "@/lib/nexus/haNexusApi.server";
import { createHaNexusTestStore } from "@/lib/nexus/nexusProvisioningTestStore";
import { provisionExternalProfessionalFromNexus } from "@/lib/nexus/provisionExternalProfessional.server";
import { readExternalProfessionalState } from "@/lib/nexus/readExternalProfessionalState.server";
import { rollbackExternalProfessionalProvisioning } from "@/lib/nexus/rollbackExternalProfessionalProvisioning.server";

const SECRET = "ha-nexus-test-secret-value";

function basePayload(over: Record<string, unknown> = {}) {
  return {
    globalProfessionalId: "iiohr:prof:001",
    email: "surgeon@example.com",
    fullName: "Dr Example",
    professionalRole: "hair_surgeon",
    sourceSystem: "iiohr",
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

describe("haNexusApi gate and auth", () => {
  it("disabled endpoint rejects with 403", async () => {
    const rawBody = JSON.stringify(basePayload());
    const res = await handleNexusProvisionHttp(
      { headers: signedHeaders(rawBody) as unknown as Headers },
      rawBody,
      { enabled: false, secret: SECRET }
    );
    assert.equal(res.httpStatus, 403);
    assert.equal(res.body.ok, false);
  });

  it("invalid signature rejects with 401", async () => {
    const rawBody = JSON.stringify(basePayload());
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

  it("evaluateNexusGate returns 503 when secret missing", () => {
    const gate = evaluateNexusGate({ enabled: true, secret: null });
    assert.ok(gate);
    assert.equal(gate.httpStatus, 503);
  });
});

describe("ha nexus provisioning services", () => {
  let store: ReturnType<typeof createHaNexusTestStore>;

  beforeEach(() => {
    store = createHaNexusTestStore();
    process.env.HA_NEXUS_ALLOWED_SOURCES = "fi_os,iiohr";
  });

  it("provision is idempotent and links doctor by global id", async () => {
    const first = await provisionExternalProfessionalFromNexus(basePayload(), store.client);
    assert.equal(first.ok, true);
    const second = await provisionExternalProfessionalFromNexus(
      basePayload({ approvalStatus: "approved", email: "other@example.com" }),
      store.client
    );
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.state.professional?.global_professional_id, "iiohr:prof:001");
      assert.equal(second.state.membership?.approval_status, "approved");
      assert.equal(store.doctorProfiles.size, 1);
      const profile = [...store.doctorProfiles.values()][0];
      assert.equal(profile.external_provider_id, "iiohr:prof:001");
      assert.equal(first.ok && second.ok && first.state.doctorProfileId, second.state.doctorProfileId);
    }
  });

  it("does not link doctor by email alone", async () => {
    store.client.from("doctor_profiles").insert({
      linked_user_id: "user-legacy",
      doctor_name: "Legacy Doctor",
      doctor_email: "surgeon@example.com",
      external_provider_id: null,
      participation_approval_status: "approved",
      participation_status: "active",
    });

    const result = await provisionExternalProfessionalFromNexus(basePayload(), store.client);
    assert.equal(result.ok, true);
    assert.equal(store.doctorProfiles.size, 2);
    const linked = [...store.doctorProfiles.values()].find((p) => p.external_provider_id === "iiohr:prof:001");
    assert.ok(linked);
    assert.notEqual(linked?.linked_user_id, "user-legacy");
  });

  it("rollback revokes entitlements and membership", async () => {
    await provisionExternalProfessionalFromNexus(
      basePayload({ approvalStatus: "approved" }),
      store.client
    );
    const result = await rollbackExternalProfessionalProvisioning(
      { globalProfessionalId: "iiohr:prof:001", reason: "cert revoked" },
      store.client
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.state.membership?.approval_status, "revoked");
      assert.equal(result.state.activeEntitlements.length, 0);
    }
  });

  it("state endpoint reads signed query value", async () => {
    await provisionExternalProfessionalFromNexus(basePayload(), store.client);
    const gid = "iiohr:prof:001";
    const res = await handleNexusStateHttp(
      { headers: signedHeaders(gid) as unknown as Headers },
      gid,
      { enabled: true, secret: SECRET },
      { readState: (id) => readExternalProfessionalState(id, store.client) }
    );
    assert.equal(res.httpStatus, 200);
    assert.equal(res.body.ok, true);
  });
});
