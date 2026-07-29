/**
 * HA-AUTH-HANDOFF-FIX — ownership, handoff, auth-state consistency, routing.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildPatientLoginHref,
  isPermanentLoginSessionUser,
} from "../src/lib/auth/patientLogin";
import { sanitizeNextPath } from "../src/lib/auth/redirects";
import {
  emailsMatch,
  generateIntakeHandoffToken,
  hashIntakeHandoffToken,
  isMalformedIntakeHandoffToken,
  maskPatientEmail,
  normalizeAuthEmail,
} from "../src/lib/patient/intakeCaseHandoffToken";
import {
  patientCaseDashboardPath,
  patientContactReturnPath,
  patientReviewPath,
} from "../src/lib/patient/intakeCasePaths";
import {
  createIntakeCaseHandoff,
  isAnonymousAuthUser,
  reconcileIntakeCaseOwnership,
  redeemIntakeCaseHandoff,
} from "../src/lib/patient/intakeCaseOwnership";
import {
  getPatientContactCopy,
  getPatientReviewSubmitCopy,
} from "../src/lib/patient/patientContactCopy";

type CaseRow = {
  id: string;
  user_id: string;
  patient_id: string;
  patient_review_pathway: string;
  status?: string;
  patient_email?: string | null;
};

type HandoffRow = {
  id: string;
  token_hash: string;
  case_id: string;
  from_owner_id: string;
  intended_email_snapshot: string;
  pathway_snapshot: string;
  return_path: string;
  expires_at: string;
  claimed_at: string | null;
  revoked_at: string | null;
  consumed_by_user_id: string | null;
};

function makeAdmin(state: {
  caseRow: CaseRow | null;
  handoffs?: HandoffRow[];
  audits?: Array<Record<string, unknown>>;
}) {
  const handoffs = state.handoffs ?? [];
  const audits = state.audits ?? [];

  return {
    from(table: string) {
      if (table === "cases") {
        const ctx: {
          filters: Record<string, string>;
          updating: boolean;
          patch: Record<string, unknown> | null;
        } = { filters: {}, updating: false, patch: null };
        const api = {
          select() {
            return api;
          },
          update(patch: Record<string, unknown>) {
            ctx.updating = true;
            ctx.patch = patch;
            return api;
          },
          eq(col: string, val: string) {
            ctx.filters[col] = val;
            return api;
          },
          maybeSingle: async () => {
            if (!state.caseRow) return { data: null, error: null };
            if (ctx.filters.id && state.caseRow.id !== ctx.filters.id) {
              return { data: null, error: null };
            }
            if (ctx.updating && ctx.patch) {
              if (ctx.filters.user_id && state.caseRow.user_id !== ctx.filters.user_id) {
                return { data: null, error: null };
              }
              Object.assign(state.caseRow, ctx.patch);
              return { data: { ...state.caseRow }, error: null };
            }
            return { data: { ...state.caseRow }, error: null };
          },
        };
        return api;
      }
      if (table === "hairaudit_intake_case_handoff_tokens") {
        const ctx: {
          filters: Record<string, unknown>;
          nullFilters: string[];
          updating: boolean;
          patch: Record<string, unknown> | null;
          inserting: Record<string, unknown> | null;
        } = { filters: {}, nullFilters: [], updating: false, patch: null, inserting: null };
        const api = {
          select() {
            return api;
          },
          insert(row: Record<string, unknown>) {
            ctx.inserting = row;
            const id = `tok-${handoffs.length + 1}`;
            handoffs.push({
              id,
              token_hash: String(row.token_hash),
              case_id: String(row.case_id),
              from_owner_id: String(row.from_owner_id),
              intended_email_snapshot: String(row.intended_email_snapshot),
              pathway_snapshot: String(row.pathway_snapshot),
              return_path: String(row.return_path),
              expires_at: String(row.expires_at),
              claimed_at: null,
              revoked_at: null,
              consumed_by_user_id: null,
            });
            return {
              then: undefined,
              // allow await insert without select
            };
          },
          update(patch: Record<string, unknown>) {
            ctx.updating = true;
            ctx.patch = patch;
            return api;
          },
          eq(col: string, val: unknown) {
            ctx.filters[col] = val;
            return api;
          },
          is(col: string, val: null) {
            if (val === null) ctx.nullFilters.push(col);
            return api;
          },
          maybeSingle: async () => {
            const row = handoffs.find((h) => {
              if (ctx.filters.token_hash && h.token_hash !== ctx.filters.token_hash) return false;
              if (ctx.filters.id && h.id !== ctx.filters.id) return false;
              return true;
            });
            return { data: row ? { ...row } : null, error: null };
          },
          then: async (resolve: (v: { error: null }) => void) => {
            if (ctx.inserting) {
              resolve({ error: null });
              return;
            }
            if (ctx.updating && ctx.patch) {
              for (const h of handoffs) {
                let match = true;
                if (ctx.filters.case_id && h.case_id !== ctx.filters.case_id) match = false;
                if (ctx.filters.id && h.id !== ctx.filters.id) match = false;
                for (const col of ctx.nullFilters) {
                  if ((h as Record<string, unknown>)[col] != null) match = false;
                }
                if (!match) continue;
                Object.assign(h, ctx.patch);
              }
            }
            resolve({ error: null });
          },
        };
        // Make insert awaitable
        const insertApi = {
          insert: (row: Record<string, unknown>) => {
            const id = `tok-${handoffs.length + 1}`;
            handoffs.push({
              id,
              token_hash: String(row.token_hash),
              case_id: String(row.case_id),
              from_owner_id: String(row.from_owner_id),
              intended_email_snapshot: String(row.intended_email_snapshot),
              pathway_snapshot: String(row.pathway_snapshot),
              return_path: String(row.return_path),
              expires_at: String(row.expires_at),
              claimed_at: null,
              revoked_at: null,
              consumed_by_user_id: null,
            });
            return Promise.resolve({ error: null });
          },
          select: () => api,
          update: (patch: Record<string, unknown>) => api.update(patch),
          eq: (col: string, val: unknown) => api.eq(col, val),
          is: (col: string, val: null) => api.is(col, val),
          maybeSingle: () => api.maybeSingle(),
        };
        return {
          select: () => insertApi,
          insert: insertApi.insert,
          update: (patch: Record<string, unknown>) => {
            const chain = {
              eq(col: string, val: unknown) {
                ctx.filters[col] = val;
                return chain;
              },
              is(col: string, val: null) {
                if (val === null) ctx.nullFilters.push(col);
                return chain;
              },
              then(resolve: (v: { error: null }) => void) {
                for (const h of handoffs) {
                  let match = true;
                  if (ctx.filters.case_id && h.case_id !== ctx.filters.case_id) match = false;
                  if (ctx.filters.id && h.id !== ctx.filters.id) match = false;
                  for (const col of ctx.nullFilters) {
                    if ((h as Record<string, unknown>)[col] != null) match = false;
                  }
                  if (!match) continue;
                  Object.assign(h, patch);
                }
                resolve({ error: null });
              },
            };
            return chain;
          },
        };
      }
      if (table === "hairaudit_intake_case_ownership_audit") {
        return {
          insert: async (row: Record<string, unknown>) => {
            audits.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("HA-AUTH-HANDOFF-FIX — A matching authenticated account", () => {
  it("does not treat matching session email as registration error (probe exclude)", () => {
    assert.equal(emailsMatch("Alex@Example.com", "alex@example.com"), true);
    assert.equal(normalizeAuthEmail("  Alex@Example.com "), "alex@example.com");
  });

  it("reconciles ownership idempotently when claimant already owns the case", async () => {
    const state = {
      caseRow: {
        id: "case-1",
        user_id: "user-a",
        patient_id: "user-a",
        patient_review_pathway: "pre_surgery",
      } satisfies CaseRow,
      audits: [] as Array<Record<string, unknown>>,
    };
    const admin = makeAdmin(state);
    const result = await reconcileIntakeCaseOwnership({
      admin: admin as never,
      caseId: "case-1",
      claimantUserId: "user-a",
      reason: "matching_authenticated_email",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.alreadyOwned, true);
    assert.equal(result.transferred, false);
    assert.equal(result.pathway, "pre_surgery");
    assert.equal(state.caseRow.patient_review_pathway, "pre_surgery");
  });

  it("pre_surgery contact copy never says Send My Report", () => {
    const copy = getPatientContactCopy("pre_surgery");
    assert.equal(copy.pageTitle, "Confirm Your Account");
    assert.match(copy.supportingText, /Pre-Surgery Review Report/);
    assert.match(copy.progressLabel, /Confirm your account/);
    assert.equal(copy.primaryButton, "Continue My Review");
    assert.doesNotMatch(copy.primaryButton, /Send My Report/i);
    const submit = getPatientReviewSubmitCopy("pre_surgery");
    assert.equal(submit.pageTitle, "Submit Your Pre-Surgery Review");
    assert.equal(submit.primaryButton, "Submit Pre-Surgery Review");
  });
});

describe("HA-AUTH-HANDOFF-FIX — B authenticated different account", () => {
  it("refuses ownership attach without handoff from a foreign owner", async () => {
    const state = {
      caseRow: {
        id: "case-1",
        user_id: "anon-1",
        patient_id: "anon-1",
        patient_review_pathway: "pre_surgery",
      } satisfies CaseRow,
    };
    const result = await reconcileIntakeCaseOwnership({
      admin: makeAdmin(state) as never,
      caseId: "case-1",
      claimantUserId: "user-b",
      reason: "mismatch_attempt",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "not_owner");
    assert.equal(state.caseRow.user_id, "anon-1");
  });

  it("masks emails for mismatch UI without leaking full addresses in helper", () => {
    const masked = maskPatientEmail("patient@example.com");
    assert.match(masked, /\*/);
    assert.doesNotMatch(masked, /^patient@example\.com$/);
  });
});

describe("HA-AUTH-HANDOFF-FIX — C existing account with no session / handoff", () => {
  it("creates sign-in href with sanitized case return path including handoff", async () => {
    const state = {
      caseRow: {
        id: "case-1",
        user_id: "anon-1",
        patient_id: "anon-1",
        patient_review_pathway: "pre_surgery",
      } satisfies CaseRow,
      handoffs: [] as HandoffRow[],
    };
    const handoff = await createIntakeCaseHandoff({
      admin: makeAdmin(state) as never,
      caseId: "case-1",
      fromOwnerId: "anon-1",
      intendedEmail: "existing@example.com",
      pathway: "pre_surgery",
    });
    assert.equal(handoff.ok, true);
    if (!handoff.ok) return;
    assert.ok(handoff.signInHref.startsWith("/login?"));
    assert.match(handoff.signInHref, /from=patient/);
    assert.match(handoff.signInHref, /next=/);
    const next = new URLSearchParams(handoff.signInHref.split("?")[1]).get("next");
    assert.ok(next);
    const decoded = decodeURIComponent(next);
    assert.ok(decoded.startsWith("/cases/case-1/patient/contact"));
    assert.match(decoded, /handoff=/);
    assert.equal(sanitizeNextPath(decoded)?.startsWith("/cases/"), true);
  });

  it("redeems handoff, transfers ownership, preserves pathway, returns to contact", async () => {
    const state = {
      caseRow: {
        id: "case-1",
        user_id: "anon-1",
        patient_id: "anon-1",
        patient_review_pathway: "pre_surgery",
      } satisfies CaseRow,
      handoffs: [] as HandoffRow[],
    };
    const created = await createIntakeCaseHandoff({
      admin: makeAdmin(state) as never,
      caseId: "case-1",
      fromOwnerId: "anon-1",
      intendedEmail: "existing@example.com",
      pathway: "pre_surgery",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const redeemed = await redeemIntakeCaseHandoff({
      admin: makeAdmin(state) as never,
      plaintextToken: created.plaintextToken,
      claimantUserId: "user-existing",
      claimantEmail: "existing@example.com",
    });
    assert.equal(redeemed.ok, true);
    if (!redeemed.ok) return;
    assert.equal(redeemed.transferred, true);
    assert.equal(redeemed.pathway, "pre_surgery");
    assert.equal(state.caseRow.user_id, "user-existing");
    assert.equal(state.caseRow.patient_id, "user-existing");
    assert.equal(state.caseRow.patient_review_pathway, "pre_surgery");
    assert.equal(redeemed.returnPath, patientContactReturnPath("case-1"));
  });
});

describe("HA-AUTH-HANDOFF-FIX — D/E session consistency", () => {
  it("treats anonymous sessions as non-permanent for login auto-redirect", () => {
    assert.equal(isPermanentLoginSessionUser({ is_anonymous: true, email: null, app_metadata: {} }), false);
    assert.equal(
      isPermanentLoginSessionUser({ is_anonymous: false, email: null, app_metadata: { provider: "anonymous" } }),
      false
    );
    assert.equal(isPermanentLoginSessionUser({ is_anonymous: false, email: "", app_metadata: {} }), false);
    assert.equal(
      isPermanentLoginSessionUser({ is_anonymous: false, email: "a@b.com", app_metadata: { provider: "email" } }),
      true
    );
    assert.equal(isAnonymousAuthUser({ is_anonymous: true, email: null }), true);
    assert.equal(isAnonymousAuthUser({ is_anonymous: false, email: "a@b.com" }), false);
  });

  it("login page skips auto-redirect for anonymous sessions (source check)", () => {
    const loginSrc = fs.readFileSync(path.join(process.cwd(), "src/app/login/page.tsx"), "utf8");
    assert.match(loginSrc, /isPermanentLoginSessionUser/);
    assert.match(loginSrc, /HA-AUTH-HANDOFF-FIX/);
  });

  it("cases layout uses server getUser and labels anonymous Exit not Sign out contradiction", () => {
    const layoutSrc = fs.readFileSync(path.join(process.cwd(), "src/app/cases/layout.tsx"), "utf8");
    assert.match(layoutSrc, /isAnonymousAuthUser/);
    assert.match(layoutSrc, /isAnonymousSession/);
    const headerSrc = fs.readFileSync(path.join(process.cwd(), "src/components/DashboardHeader.tsx"), "utf8");
    assert.match(headerSrc, /isAnonymousSession/);
    assert.match(headerSrc, /Exit/);
  });
});

describe("HA-AUTH-HANDOFF-FIX — F case-specific return", () => {
  it("post-auth and post-submit paths stay case-specific", () => {
    assert.equal(patientReviewPath("abc"), "/cases/abc/patient/review");
    assert.equal(patientCaseDashboardPath("abc"), "/cases/abc");
    assert.notEqual(patientCaseDashboardPath("abc"), "/dashboard/patient");
    const href = buildPatientLoginHref(patientContactReturnPath("abc", "deadbeef".repeat(8)));
    assert.match(href, /next=/);
    assert.doesNotMatch(href, /next=%2Fdashboard%2Fpatient$/);
  });

  it("contact client no longer links bare /login without next", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/app/cases/[caseId]/patient/contact/PatientContactClient.tsx"),
      "utf8"
    );
    assert.doesNotMatch(src, /href=\"\/login\"/);
    assert.match(src, /signInHref/);
    assert.match(src, /signOutAndSignIn/);
  });
});

describe("HA-AUTH-HANDOFF-FIX — G ownership protection", () => {
  it("another user cannot redeem handoff for a different email", async () => {
    const state = {
      caseRow: {
        id: "case-1",
        user_id: "anon-1",
        patient_id: "anon-1",
        patient_review_pathway: "pre_surgery",
      } satisfies CaseRow,
      handoffs: [] as HandoffRow[],
    };
    const created = await createIntakeCaseHandoff({
      admin: makeAdmin(state) as never,
      caseId: "case-1",
      fromOwnerId: "anon-1",
      intendedEmail: "owner@example.com",
      pathway: "pre_surgery",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const stolen = await redeemIntakeCaseHandoff({
      admin: makeAdmin(state) as never,
      plaintextToken: created.plaintextToken,
      claimantUserId: "attacker",
      claimantEmail: "attacker@example.com",
    });
    assert.equal(stolen.ok, false);
    if (stolen.ok) return;
    assert.equal(stolen.code, "email_mismatch");
    assert.equal(state.caseRow.user_id, "anon-1");
  });

  it("replay is idempotent for rightful owner and invalid token fails closed", async () => {
    const state = {
      caseRow: {
        id: "case-1",
        user_id: "anon-1",
        patient_id: "anon-1",
        patient_review_pathway: "pre_surgery",
      } satisfies CaseRow,
      handoffs: [] as HandoffRow[],
    };
    const created = await createIntakeCaseHandoff({
      admin: makeAdmin(state) as never,
      caseId: "case-1",
      fromOwnerId: "anon-1",
      intendedEmail: "owner@example.com",
      pathway: "pre_surgery",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const first = await redeemIntakeCaseHandoff({
      admin: makeAdmin(state) as never,
      plaintextToken: created.plaintextToken,
      claimantUserId: "owner",
      claimantEmail: "owner@example.com",
    });
    assert.equal(first.ok, true);

    const replay = await redeemIntakeCaseHandoff({
      admin: makeAdmin(state) as never,
      plaintextToken: created.plaintextToken,
      claimantUserId: "owner",
      claimantEmail: "owner@example.com",
    });
    assert.equal(replay.ok, true);
    if (replay.ok) {
      assert.equal(replay.alreadyOwned || replay.transferred === false, true);
    }

    const bad = await redeemIntakeCaseHandoff({
      admin: makeAdmin(state) as never,
      plaintextToken: "00".repeat(32),
      claimantUserId: "owner",
      claimantEmail: "owner@example.com",
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.code, "invalid_token");

    assert.equal(isMalformedIntakeHandoffToken("short"), true);
    assert.equal(hashIntakeHandoffToken(generateIntakeHandoffToken()).length, 64);
  });

  it("pathway cannot be modified during ownership transfer", async () => {
    const state = {
      caseRow: {
        id: "case-1",
        user_id: "anon-1",
        patient_id: "anon-1",
        patient_review_pathway: "pre_surgery",
      } satisfies CaseRow,
    };
    const result = await reconcileIntakeCaseOwnership({
      admin: makeAdmin(state) as never,
      caseId: "case-1",
      claimantUserId: "owner",
      expectedFromOwnerId: "anon-1",
      reason: "handoff_redeem",
    });
    assert.equal(result.ok, true);
    assert.equal(state.caseRow.patient_review_pathway, "pre_surgery");
    assert.equal(state.caseRow.user_id, "owner");
  });
});

describe("HA-AUTH-HANDOFF-FIX — H direct URL / refresh continuity", () => {
  it("contact and review pages preserve case id paths on refresh", () => {
    const contactPage = fs.readFileSync(
      path.join(process.cwd(), "src/app/cases/[caseId]/patient/contact/page.tsx"),
      "utf8"
    );
    assert.match(contactPage, /handoff/);
    assert.match(contactPage, /server_getUser/);
    const client = fs.readFileSync(
      path.join(process.cwd(), "src/app/cases/[caseId]/patient/contact/PatientContactClient.tsx"),
      "utf8"
    );
    assert.match(client, /Back to questions/);
    assert.match(client, /cases\/\$\{caseId\}\/patient\/questions/);
    const reviewPage = fs.readFileSync(
      path.join(process.cwd(), "src/app/cases/[caseId]/patient/review/page.tsx"),
      "utf8"
    );
    assert.match(reviewPage, /PatientReviewSubmitClient/);
  });

  it("migration for handoff tokens exists", () => {
    const mig = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260729120000_hairaudit_intake_case_handoff.sql"),
      "utf8"
    );
    assert.match(mig, /hairaudit_intake_case_handoff_tokens/);
    assert.match(mig, /hairaudit_intake_case_ownership_audit/);
    assert.match(mig, /service_role/);
  });
});
