import assert from "node:assert/strict";
import { beforeEach, afterEach, describe, it } from "node:test";

import { evaluateProfessionalAccess } from "@/lib/nexus/professionalAccess.server";
import { createHaNexusTestStore } from "@/lib/nexus/nexusProvisioningTestStore";
import { provisionExternalProfessionalFromNexus } from "@/lib/nexus/provisionExternalProfessional.server";

const DOCTOR_USER = "doctor-user-1";

function seedStandaloneDoctor(
  store: ReturnType<typeof createHaNexusTestStore>,
  status: string = "approved"
) {
  store.client.from("doctor_profiles").insert({
    linked_user_id: DOCTOR_USER,
    doctor_name: "Dr Standalone",
    doctor_email: "standalone@example.com",
    external_provider_id: null,
    participation_approval_status: status,
    participation_status: "active",
  });
}

function seedNetworkDoctor(store: ReturnType<typeof createHaNexusTestStore>) {
  store.client.from("doctor_profiles").insert({
    linked_user_id: DOCTOR_USER,
    doctor_name: "Dr Network",
    doctor_email: "network@example.com",
    external_provider_id: "iiohr:prof:network",
    participation_approval_status: "approved",
    participation_status: "active",
  });
}

describe("professionalAccess", () => {
  let store: ReturnType<typeof createHaNexusTestStore>;
  let envSnap: NodeJS.ProcessEnv;

  beforeEach(() => {
    store = createHaNexusTestStore();
    envSnap = { ...process.env };
    process.env.HA_NEXUS_ENABLED = "true";
    process.env.HA_NEXUS_ALLOWED_SOURCES = "fi_os,iiohr";
    process.env.HA_ALLOW_PUBLIC_PATIENT_AUDITS = "true";
    process.env.HA_ALLOW_STANDALONE_DOCTOR_SIGNUP = "true";
    process.env.HA_ALLOW_STANDALONE_CLINIC_SIGNUP = "true";
    process.env.HA_REQUIRE_NEXUS_FOR_PROFESSIONAL_UPLOAD = "false";
    process.env.HA_REQUIRE_LOCAL_APPROVAL_FOR_STANDALONE_PROFESSIONALS = "true";
  });

  afterEach(() => {
    process.env = envSnap;
  });

  it("allows locally approved standalone doctor when nexus receiver is enabled", async () => {
    seedStandaloneDoctor(store, "approved");
    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: DOCTOR_USER,
      userEmail: "standalone@example.com",
      profileRole: "doctor",
      action: "upload",
    });
    assert.equal(decision.allowed, true);
    if (decision.allowed) assert.equal(decision.mode, "standalone");
  });

  it("blocks standalone doctor pending local approval", async () => {
    seedStandaloneDoctor(store, "pending_review");
    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: DOCTOR_USER,
      userEmail: "standalone@example.com",
      profileRole: "doctor",
      action: "upload",
    });
    assert.equal(decision.allowed, false);
  });

  it("blocks standalone doctor when strict nexus-only mode is enabled", async () => {
    process.env.HA_REQUIRE_NEXUS_FOR_PROFESSIONAL_UPLOAD = "true";
    seedStandaloneDoctor(store, "approved");
    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: DOCTOR_USER,
      userEmail: "standalone@example.com",
      profileRole: "doctor",
      action: "upload",
    });
    assert.equal(decision.allowed, false);
  });

  it("blocks pending network doctor", async () => {
    seedNetworkDoctor(store);
    await provisionExternalProfessionalFromNexus(
      {
        globalProfessionalId: "iiohr:prof:network",
        email: "network@example.com",
        professionalRole: "hair_surgeon",
        sourceSystem: "iiohr",
        entitlementKeys: ["clinical_audit_upload"],
        approvalStatus: "pending",
      },
      store.client
    );

    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: DOCTOR_USER,
      userEmail: "network@example.com",
      profileRole: "doctor",
      action: "upload",
    });
    assert.equal(decision.allowed, false);
  });

  it("allows approved network doctor with entitlement", async () => {
    seedNetworkDoctor(store);
    await provisionExternalProfessionalFromNexus(
      {
        globalProfessionalId: "iiohr:prof:network",
        email: "network@example.com",
        professionalRole: "hair_surgeon",
        sourceSystem: "iiohr",
        entitlementKeys: ["clinical_audit_upload", "case_creation"],
        approvalStatus: "approved",
      },
      store.client
    );

    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: DOCTOR_USER,
      userEmail: "network@example.com",
      profileRole: "doctor",
      action: "upload",
    });
    assert.equal(decision.allowed, true);
    if (decision.allowed) assert.equal(decision.mode, "nexus");
  });

  it("blocks suspended network doctor", async () => {
    seedNetworkDoctor(store);
    await provisionExternalProfessionalFromNexus(
      {
        globalProfessionalId: "iiohr:prof:network",
        email: "network@example.com",
        professionalRole: "hair_surgeon",
        sourceSystem: "iiohr",
        entitlementKeys: ["clinical_audit_upload"],
        approvalStatus: "suspended",
      },
      store.client
    );

    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: DOCTOR_USER,
      userEmail: "network@example.com",
      profileRole: "doctor",
      action: "upload",
    });
    assert.equal(decision.allowed, false);
  });

  it("patient pathway remains allowed by default", async () => {
    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: "patient-user",
      userEmail: "patient@example.com",
      profileRole: "patient",
      action: "upload",
    });
    assert.equal(decision.allowed, true);
    if (decision.allowed) assert.equal(decision.mode, "patient");
  });

  it("blocks patient pathway when public audits disabled", async () => {
    process.env.HA_ALLOW_PUBLIC_PATIENT_AUDITS = "false";
    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: "patient-user",
      userEmail: "patient@example.com",
      profileRole: "patient",
      action: "case_create",
    });
    assert.equal(decision.allowed, false);
  });

  it("auditor pathway remains allowed", async () => {
    const decision = await evaluateProfessionalAccess({
      admin: store.client,
      userId: "auditor-user",
      userEmail: "auditor@example.com",
      profileRole: "auditor",
      action: "report_access",
    });
    assert.equal(decision.allowed, true);
    if (decision.allowed) assert.equal(decision.mode, "auditor");
  });
});
