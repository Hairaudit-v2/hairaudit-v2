import { describe, it, after } from "node:test";
import assert from "node:assert";
import {
  buildAuditCaseInsertData,
  createAuditCase,
  effectiveAuditCaseCreationRole,
  resolveCaseCreationRole,
  type CaseCreationResolvedRole,
} from "../src/lib/cases/createCase";
import { emitHairAuditEvent } from "../src/lib/integrations/emit";
import type { HairAuditEventSink } from "../src/lib/integrations/types";
import { setEventSink } from "../src/lib/integrations/sink";

describe("effectiveAuditCaseCreationRole", () => {
  it("treats unknown roles as patient", () => {
    assert.strictEqual(effectiveAuditCaseCreationRole("nurse"), "patient");
    assert.strictEqual(effectiveAuditCaseCreationRole(""), "patient");
  });

  it("preserves doctor and clinic", () => {
    assert.strictEqual(effectiveAuditCaseCreationRole("doctor"), "doctor");
    assert.strictEqual(effectiveAuditCaseCreationRole("Clinic"), "clinic");
  });

  it("flags auditor", () => {
    assert.strictEqual(effectiveAuditCaseCreationRole("auditor"), "auditor");
  });
});

describe("buildAuditCaseInsertData", () => {
  const uid = "00000000-0000-4000-8000-000000000001";

  it("patient row has public visibility and patient_id", () => {
    const row = buildAuditCaseInsertData(uid, "patient", "post_surgery");
    assert.strictEqual(row.status, "draft");
    assert.strictEqual(row.user_id, uid);
    assert.strictEqual(row.patient_id, uid);
    assert.strictEqual(row.visibility_scope, "public");
    assert.strictEqual(row.audit_type, "patient");
    assert.strictEqual(row.submission_channel, "patient_submitted");
  });

  it("doctor row matches API semantics", () => {
    const row = buildAuditCaseInsertData(uid, "doctor");
    assert.strictEqual(row.doctor_id, uid);
    assert.strictEqual(row.visibility_scope, "internal");
    assert.strictEqual(row.audit_type, "doctor");
  });

  it("clinic row matches API semantics", () => {
    const row = buildAuditCaseInsertData(uid, "clinic");
    assert.strictEqual(row.clinic_id, uid);
    assert.strictEqual(row.audit_type, "clinic");
  });
});

describe("resolveCaseCreationRole", () => {
  it("prefers profiles.role over user_metadata.role", async () => {
    const admin = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: { role: "clinic" }, error: null }),
        };
      },
    };
    const r = await resolveCaseCreationRole({
      admin: admin as never,
      userId: "u1",
      userMetadata: { role: "patient" },
      devRoleCookieValue: null,
      nodeEnv: "production",
    });
    assert.strictEqual(r, "clinic");
  });

  it("applies dev_role cookie in development only", async () => {
    const admin = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: { role: "patient" }, error: null }),
        };
      },
    };
    const inProd = await resolveCaseCreationRole({
      admin: admin as never,
      userId: "u1",
      userMetadata: {},
      devRoleCookieValue: "doctor",
      nodeEnv: "production",
    });
    assert.strictEqual(inProd, "patient");

    const inDev = await resolveCaseCreationRole({
      admin: admin as never,
      userId: "u1",
      userMetadata: {},
      devRoleCookieValue: "doctor",
      nodeEnv: "development",
    });
    assert.strictEqual(inDev, "doctor");
  });
});

describe("duplicate entry points share insert shape", () => {
  it("API and legacy path both use buildAuditCaseInsertData via same role resolution contract", () => {
    const uid = "u";
    const roles: CaseCreationResolvedRole[] = ["patient", "doctor", "clinic"];
    for (const role of roles) {
      const a = buildAuditCaseInsertData(uid, role);
      const b = buildAuditCaseInsertData(uid, role);
      assert.deepStrictEqual(a, b);
    }
  });
});

describe("createAuditCase requires explicit patient pathway", () => {
  it("returns 400 without inserting when patient pathway is missing", async () => {
    let inserts = 0;
    const admin = {
      from(table: string) {
        if (table === "profiles") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: { role: "patient" }, error: null }),
          };
        }
        if (table === "cases") {
          return {
            insert() {
              inserts++;
              return {
                select() {
                  return { single: async () => ({ data: null, error: { message: "should not run" } }) };
                },
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    const r = await createAuditCase({
      admin: admin as never,
      userId: "u1",
      userMetadata: {},
      devRoleCookieValue: null,
      nodeEnv: "production",
    });
    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.strictEqual(r.status, 400);
      assert.match(r.error, /choose a review type/i);
    }
    assert.strictEqual(inserts, 0);
  });
});

describe("createAuditCase rejects auditor", () => {
  it("returns 403 without inserting", async () => {
    let inserts = 0;
    const admin = {
      from(table: string) {
        if (table === "profiles") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: { role: "auditor" }, error: null }),
          };
        }
        if (table === "cases") {
          return {
            insert() {
              inserts++;
              return { select() {
                return { single: async () => ({ data: null, error: { message: "should not run" } }) };
              } };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
    const r = await createAuditCase({
      admin: admin as never,
      userId: "u1",
      userMetadata: {},
      devRoleCookieValue: null,
      nodeEnv: "production",
    });
    assert.strictEqual(r.ok, false);
    if (!r.ok) assert.strictEqual(r.status, 403);
    assert.strictEqual(inserts, 0);
  });
});

describe("emitHairAuditEvent (case created hook)", () => {
  const noopSink: HairAuditEventSink = { async emit() {} };

  after(() => {
    setEventSink(noopSink);
    delete process.env.INTEGRATION_EVENTS_ENABLED;
  });

  it("does not call sink when INTEGRATION_EVENTS_ENABLED is not true", async () => {
    let calls = 0;
    setEventSink({
      async emit() {
        calls++;
      },
    });
    delete process.env.INTEGRATION_EVENTS_ENABLED;
    await emitHairAuditEvent("hairaudit.case.created", { case_id: "x" });
    assert.strictEqual(calls, 0);
  });

  it("calls sink when INTEGRATION_EVENTS_ENABLED=true", async () => {
    let calls = 0;
    setEventSink({
      async emit() {
        calls++;
      },
    });
    process.env.INTEGRATION_EVENTS_ENABLED = "true";
    await emitHairAuditEvent("hairaudit.case.created", { case_id: "x" });
    assert.strictEqual(calls, 1);
  });
});
