import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EMAIL_EXISTS_CLAIM_ERROR,
  PATIENT_SAFE_CLAIM_ERROR,
  claimAnonymousAccount,
  isExplicitAuthEmailConflictError,
  isOpaqueAuthUpdateFailure,
} from "../src/lib/audit/claimAnonymousAccount";

type RpcResult = { data: unknown; error: { message: string } | null };
type UpdateResult = {
  data: { user: { id: string; email: string | null; is_anonymous?: boolean } | null };
  error: { code?: string; message?: string } | null;
};

function makeAdmin(opts: {
  caseRow?: { id: string; user_id: string; patient_id: string } | null;
  caseError?: { message: string } | null;
  emailInUse?: boolean;
  emailProbeError?: string | null;
  updateError?: { code?: string; message?: string } | null;
  updateUser?: { id: string; email: string | null; is_anonymous?: boolean } | null;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onUpsert?: (row: Record<string, unknown>) => void;
  profileError?: { message: string } | null;
  rpcCalls?: Array<{ fn: string; args: Record<string, unknown> }>;
}) {
  const userId = opts.caseRow?.user_id ?? "user-1";
  const rpcCalls = opts.rpcCalls ?? [];

  return {
    from(table: string) {
      if (table === "cases") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({
            data: opts.caseRow === undefined
              ? { id: "case-1", user_id: userId, patient_id: userId }
              : opts.caseRow,
            error: opts.caseError ?? null,
          }),
        };
      }
      if (table === "profiles") {
        return {
          upsert: async (row: Record<string, unknown>) => {
            opts.onUpsert?.(row);
            return { error: opts.profileError ?? null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async (fn: string, args: Record<string, unknown>): Promise<RpcResult> => {
      rpcCalls.push({ fn, args });
      if (fn === "hairaudit_auth_email_in_use") {
        if (opts.emailProbeError) return { data: null, error: { message: opts.emailProbeError } };
        return { data: opts.emailInUse === true, error: null };
      }
      return { data: null, error: { message: `unknown rpc ${fn}` } };
    },
    auth: {
      admin: {
        updateUserById: async (id: string, payload: Record<string, unknown>): Promise<UpdateResult> => {
          opts.onUpdate?.(payload);
          if (opts.updateError) {
            return { data: { user: null }, error: opts.updateError };
          }
          return {
            data: {
              user:
                opts.updateUser ??
                ({
                  id,
                  email: String(payload.email ?? ""),
                  is_anonymous: false,
                } as { id: string; email: string | null; is_anonymous?: boolean }),
            },
            error: null,
          };
        },
      },
    },
  };
}

describe("isExplicitAuthEmailConflictError / isOpaqueAuthUpdateFailure", () => {
  it("detects explicit email_exists and postgres unique text", () => {
    assert.equal(isExplicitAuthEmailConflictError({ code: "email_exists", message: "x" }), true);
    assert.equal(
      isExplicitAuthEmailConflictError({
        message: 'duplicate key value violates unique constraint "users_email_partial_key"',
      }),
      true
    );
    assert.equal(isExplicitAuthEmailConflictError({ code: "unexpected_failure", message: "Error updating user" }), false);
  });

  it("detects GoTrue opaque wrapper separately", () => {
    assert.equal(
      isOpaqueAuthUpdateFailure({ code: "unexpected_failure", message: "Error updating user" }),
      true
    );
    assert.equal(isOpaqueAuthUpdateFailure({ code: "email_exists", message: "already" }), false);
  });
});

describe("claimAnonymousAccount", () => {
  const base = {
    userId: "d7698f54-5e0e-4ce4-9355-3910ece3ede1",
    caseId: "b7ea67d0-2e72-470a-b682-939eb3653caf",
    email: "patient@example.com",
    firstName: "Alex",
    correlationId: "corr-test-1",
  };

  it("converts anonymous account with same uid and upserts profile (no duplicate)", async () => {
    const upserts: Record<string, unknown>[] = [];
    let updatePayload: Record<string, unknown> | null = null;
    const admin = makeAdmin({
      caseRow: { id: base.caseId, user_id: base.userId, patient_id: base.userId },
      emailInUse: false,
      onUpdate: (p) => {
        updatePayload = p;
      },
      onUpsert: (row) => upserts.push(row),
      updateUser: { id: base.userId, email: base.email, is_anonymous: false },
    });

    const result = await claimAnonymousAccount({
      admin: admin as never,
      ...base,
      userMetadata: { anon: true },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.userId, base.userId);
    assert.equal(result.correlationId, "corr-test-1");
    assert.equal(updatePayload?.email, base.email);
    assert.deepEqual(updatePayload?.user_metadata, { anon: true, role: "patient", first_name: "Alex" });
    assert.equal(upserts.length, 1);
    assert.equal(upserts[0]?.id, base.userId);
    assert.equal(upserts[0]?.email, base.email);
    assert.equal(upserts[0]?.name, "Alex");
  });

  it("updates existing profile row idempotently on retry (same email)", async () => {
    const upserts: Record<string, unknown>[] = [];
    const admin = makeAdmin({
      caseRow: { id: base.caseId, user_id: base.userId, patient_id: base.userId },
      emailInUse: false,
      onUpsert: (row) => upserts.push(row),
    });

    const first = await claimAnonymousAccount({ admin: admin as never, ...base });
    const second = await claimAnonymousAccount({ admin: admin as never, ...base, correlationId: "corr-2" });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(upserts.length, 2);
    assert.equal(upserts[0]?.id, upserts[1]?.id);
    assert.equal(upserts[0]?.email, upserts[1]?.email);
  });

  it("returns email_exists when precheck finds email in use (null email → blocked)", async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const admin = makeAdmin({
      caseRow: { id: base.caseId, user_id: base.userId, patient_id: base.userId },
      emailInUse: true,
      rpcCalls,
    });

    const result = await claimAnonymousAccount({ admin: admin as never, ...base });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 409);
    assert.equal(result.code, "email_exists");
    assert.equal(result.error, EMAIL_EXISTS_CLAIM_ERROR);
    assert.equal(result.correlationId, "corr-test-1");
    assert.equal(rpcCalls[0]?.fn, "hairaudit_auth_email_in_use");
    assert.equal(rpcCalls[0]?.args.p_exclude_user_id, base.userId);
  });

  it("maps opaque unexpected_failure to email_exists only when re-probe confirms conflict", async () => {
    let probeCalls = 0;
    const admin = {
      ...makeAdmin({
        caseRow: { id: base.caseId, user_id: base.userId, patient_id: base.userId },
        emailInUse: false,
        updateError: { code: "unexpected_failure", message: "Error updating user" },
      }),
      rpc: async (fn: string, args: Record<string, unknown>) => {
        if (fn === "hairaudit_auth_email_in_use") {
          probeCalls += 1;
          // first precheck: free; second confirm after failure: in use
          return { data: probeCalls >= 2, error: null };
        }
        return { data: null, error: { message: `unknown ${fn}` } };
      },
    };

    const result = await claimAnonymousAccount({ admin: admin as never, ...base });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 409);
    assert.equal(result.code, "email_exists");
    assert.match(String(result.logContext.correlationId), /corr-test-1/);
    assert.equal(result.logContext.postgresHint, "users_email_partial_key (23505)");
    assert.equal(probeCalls, 2);
  });

  it("returns patient-safe 500 with correlation id when auth trigger/update fails without email conflict", async () => {
    const admin = makeAdmin({
      caseRow: { id: base.caseId, user_id: base.userId, patient_id: base.userId },
      emailInUse: false,
      updateError: { code: "unexpected_failure", message: "Error updating user" },
    });

    const result = await claimAnonymousAccount({ admin: admin as never, ...base });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 500);
    assert.equal(result.error, PATIENT_SAFE_CLAIM_ERROR);
    assert.equal(result.correlationId, "corr-test-1");
    assert.equal(result.logContext.correlationId, "corr-test-1");
    assert.equal(result.logContext.emailConflict, false);
    assert.doesNotMatch(result.error, /23505|users_email_partial_key|permission denied/i);
  });

  it("rejects non-owner case without mutating auth", async () => {
    let updated = false;
    const admin = makeAdmin({
      caseRow: { id: base.caseId, user_id: "other", patient_id: "other" },
      onUpdate: () => {
        updated = true;
      },
    });
    const result = await claimAnonymousAccount({ admin: admin as never, ...base });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 404);
    assert.equal(updated, false);
  });
});
