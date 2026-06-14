import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { buildAuditOsShadowSnapshot } from "@/lib/auditos/shadow/buildAuditOsShadowSnapshot.server";
import {
  sanitizeAuditOsShadowPersistPayload,
  persistAuditOsShadowSnapshot,
} from "@/lib/auditos/shadow/persistAuditOsShadowSnapshot.server";
import { isAuditOsShadowPersistEnabled } from "@/lib/auditos/shadow/auditOsShadowEnv.server";
import { canLoadAuditOsShadowSnapshotsForRole } from "@/lib/auditos/shadow/loadAuditOsShadowSnapshots.server";
import type { AuditOsShadowDiffResult } from "@/lib/auditos/shadow/diffAuditOsShadowSnapshot";

const __dirname = dirname(fileURLToPath(import.meta.url));

function okDiff(): AuditOsShadowDiffResult {
  return {
    status: "ok",
    warnings: [],
    metrics: {
      legacyOverallPresent: true,
      adaptedOverallPresent: true,
      legacyDomainCount: 0,
      adaptedDomainCount: 0,
      legacyEvidenceItemCount: 0,
      adaptedEvidenceItemCount: 0,
      legacyReportSectionCount: 0,
      adaptedReportSectionCount: 0,
      legacyLimitationsPresent: false,
      adaptedLimitationsPresent: false,
      legacyConfidencePresent: false,
      adaptedConfidencePresent: false,
    },
  };
}

test("sanitizeAuditOsShadowPersistPayload: strips rawLegacy, rawSummary, and evidence storage paths", () => {
  const snapshot = buildAuditOsShadowSnapshot({
    caseId: "11111111-1111-1111-1111-111111111111",
    reportRow: {
      id: "22222222-2222-2222-2222-222222222222",
      version: 1,
      created_at: "2026-01-01T00:00:00Z",
      summary: { score: 70, patient_answers: { patient_email: "leak@example.com" } },
    },
    legacyEvidenceManifest: null,
    uploads: [{ id: "u1", type: "patient_photo:front", storage_path: "cases/1111/secret.jpg", metadata: { email: "m@x.com" } }],
  });

  const sanitized = sanitizeAuditOsShadowPersistPayload({
    snapshot,
    structuralDiff: okDiff(),
  });

  assert.equal("rawLegacy" in (sanitized.normalized_scoring ?? {}), false);
  assert.equal("rawSummary" in (sanitized.normalized_report ?? {}), false);
  const img = (sanitized.evidence_manifest?.images as { storagePath?: unknown }[] | undefined)?.[0];
  assert.equal(img?.storagePath, null);
  const meta = img?.metadata as Record<string, unknown> | undefined;
  assert.equal(meta?.email, undefined);
  const json = JSON.stringify(sanitized);
  assert.equal(json.includes("leak@example.com"), false);
  assert.equal(json.includes("secret.jpg"), false);
});

test("isAuditOsShadowPersistEnabled: false by default in test env unless explicitly true", () => {
  const prev = process.env.HAIRAUDIT_AUDITOS_SHADOW_PERSIST_ENABLED;
  try {
    delete process.env.HAIRAUDIT_AUDITOS_SHADOW_PERSIST_ENABLED;
    assert.equal(isAuditOsShadowPersistEnabled(), false);
    process.env.HAIRAUDIT_AUDITOS_SHADOW_PERSIST_ENABLED = "true";
    assert.equal(isAuditOsShadowPersistEnabled(), true);
  } finally {
    if (prev !== undefined) process.env.HAIRAUDIT_AUDITOS_SHADOW_PERSIST_ENABLED = prev;
    else delete process.env.HAIRAUDIT_AUDITOS_SHADOW_PERSIST_ENABLED;
  }
});

test("persistAuditOsShadowSnapshot: returns service_role_unavailable when admin client cannot be created", async () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevUrl2 = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const snapshot = buildAuditOsShadowSnapshot({
      caseId: "c1",
      reportRow: { id: "r1", version: 1, summary: { score: 1 }, created_at: "2026-01-01T00:00:00Z" },
      legacyEvidenceManifest: null,
      uploads: [],
    });
    const res = await persistAuditOsShadowSnapshot({
      caseId: "c1",
      reportId: "r1",
      reportVersion: 1,
      snapshotKind: "audit_completed",
      sourceEventName: "t",
      snapshot,
      structuralDiff: okDiff(),
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error, "service_role_unavailable");
  } finally {
    if (prevUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (prevUrl2 !== undefined) process.env.SUPABASE_URL = prevUrl2;
    else delete process.env.SUPABASE_URL;
    if (prevKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});

test("canLoadAuditOsShadowSnapshotsForRole: auditor only", () => {
  assert.equal(canLoadAuditOsShadowSnapshotsForRole("auditor"), true);
  assert.equal(canLoadAuditOsShadowSnapshotsForRole("patient"), false);
  assert.equal(canLoadAuditOsShadowSnapshotsForRole(null), false);
});

test("migration hairaudit_auditos_shadow_snapshots defines RLS, indexes, and grants", () => {
  const sql = readFileSync(
    join(__dirname, "../supabase/migrations/20260615090000_hairaudit_auditos_shadow_snapshots.sql"),
    "utf8"
  );
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /hairaudit_auditos_shadow_snapshots/i);
  assert.match(sql, /idx_hairaudit_auditos_shadow_case_created/i);
  assert.match(sql, /uq_hairaudit_auditos_shadow_automated_dedupe/i);
  assert.match(sql, /GRANT ALL ON public\.hairaudit_auditos_shadow_snapshots TO service_role/i);
});
