import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { compareLegacyAndNormalizedReport } from "@/lib/auditos/review/compareLegacyAndNormalizedReport";
import { buildEvidenceCompletenessViewModel } from "@/lib/auditos/review/buildEvidenceCompletenessViewModel";
import { buildDomainNormalizationViewModel } from "@/lib/auditos/review/buildDomainNormalizationViewModel";
import { isAuditOsReviewPanelEnabled } from "@/lib/auditos/shadow/auditOsShadowEnv.server";
import { canShowAuditOsReviewPanelForRole } from "@/lib/auditos/shadow/loadAuditOsShadowSnapshots.server";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("compareLegacyAndNormalizedReport: missing when no snapshot", () => {
  const r = compareLegacyAndNormalizedReport({
    legacySummary: { score: 80, forensic_audit: { domain_scores_v1: { domains: [{ x: 1 }] } } },
    persistedSnapshot: null,
  });
  assert.equal(r.status, "missing");
  assert.equal(r.metrics.normalizedOverallScorePresent, false);
  assert.ok(r.warnings.some((w) => w.includes("no persisted")));
});

test("compareLegacyAndNormalizedReport: ok when legacy and normalized align", () => {
  const r = compareLegacyAndNormalizedReport({
    legacySummary: {
      score: 80,
      forensic_audit: {
        overall_scores_v1: { performance_score: 80 },
        domain_scores_v1: { domains: [{ domain_id: "SP" }, { domain_id: "DP" }] },
      },
    },
    persistedSnapshot: {
      normalized_scoring: {
        overallScore: 80,
        domainScores: [{ domainId: "SP" }, { domainId: "DP" }],
      },
      evidence_manifest: { images: [], documents: [], missingEvidence: [] },
      normalized_report: { findings: [], recommendations: [], limitations: [] },
    },
  });
  assert.equal(r.status, "ok");
  assert.equal(r.metrics.legacyDomainCount, 2);
  assert.equal(r.metrics.normalizedDomainCount, 2);
});

test("compareLegacyAndNormalizedReport: warning on domain count mismatch", () => {
  const r = compareLegacyAndNormalizedReport({
    legacySummary: {
      forensic_audit: {
        overall_scores_v1: { performance_score: 70 },
        domain_scores_v1: { domains: [{ domain_id: "SP" }] },
      },
    },
    persistedSnapshot: {
      normalized_scoring: {
        overallScore: 70,
        domainScores: [{ domainId: "SP" }, { domainId: "DP" }],
      },
      evidence_manifest: { images: [{}], missingEvidence: [] },
    },
  });
  assert.equal(r.status, "warning");
  assert.ok(r.warnings.some((w) => w.includes("domain row count mismatch")));
});

test("buildEvidenceCompletenessViewModel: complete vs partial vs limited vs unknown", () => {
  assert.equal(buildEvidenceCompletenessViewModel(null).completenessStatus, "unknown");
  assert.equal(
    buildEvidenceCompletenessViewModel({
      images: [{ category: "a", sourceRole: "patient", phase: "pre" }],
      missingEvidence: [],
    }).completenessStatus,
    "complete"
  );
  const partial = buildEvidenceCompletenessViewModel({
    images: [{ category: "a", sourceRole: "patient", phase: "pre" }],
    missingEvidence: ["need lateral"],
  });
  assert.equal(partial.completenessStatus, "partial");
  assert.ok(partial.missingEvidence.includes("need lateral"));
  const limited = buildEvidenceCompletenessViewModel({
    images: [],
    missingEvidence: ["everything"],
  });
  assert.equal(limited.completenessStatus, "limited");
});

test("buildDomainNormalizationViewModel: unknown domain and missing scoring", () => {
  const empty = buildDomainNormalizationViewModel(null);
  assert.ok(empty.warnings.some((w) => w.includes("missing or invalid")));
  const badKey = buildDomainNormalizationViewModel({
    domainScores: [{ domainId: "ZZ", rawScore: 1, weightedScore: 1, confidence: 0.5 }],
  });
  assert.ok(badKey.warnings.some((w) => w.includes("unrecognized domain key")));
  assert.equal(badKey.domains[0]?.domainId, "ZZ");
});

test("isAuditOsReviewPanelEnabled: true in test env without explicit prod flag", () => {
  const prevNode = process.env.NODE_ENV;
  const prevFlag = process.env.HAIRAUDIT_AUDITOS_REVIEW_PANEL;
  try {
    process.env.NODE_ENV = "test";
    delete process.env.HAIRAUDIT_AUDITOS_REVIEW_PANEL;
    assert.equal(isAuditOsReviewPanelEnabled(), true);
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevFlag !== undefined) process.env.HAIRAUDIT_AUDITOS_REVIEW_PANEL = prevFlag;
    else delete process.env.HAIRAUDIT_AUDITOS_REVIEW_PANEL;
  }
});

test("isAuditOsReviewPanelEnabled: production requires explicit flag", () => {
  const prevNode = process.env.NODE_ENV;
  const prevFlag = process.env.HAIRAUDIT_AUDITOS_REVIEW_PANEL;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.HAIRAUDIT_AUDITOS_REVIEW_PANEL;
    assert.equal(isAuditOsReviewPanelEnabled(), false);
    process.env.HAIRAUDIT_AUDITOS_REVIEW_PANEL = "true";
    assert.equal(isAuditOsReviewPanelEnabled(), true);
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevFlag !== undefined) process.env.HAIRAUDIT_AUDITOS_REVIEW_PANEL = prevFlag;
    else delete process.env.HAIRAUDIT_AUDITOS_REVIEW_PANEL;
  }
});

test("canShowAuditOsReviewPanelForRole: auditor only", () => {
  assert.equal(canShowAuditOsReviewPanelForRole("auditor"), true);
  assert.equal(canShowAuditOsReviewPanelForRole("patient"), false);
  assert.equal(canShowAuditOsReviewPanelForRole("doctor"), false);
});

test("case page: AuditOS review panel wired only for auditors behind review env gate", () => {
  const pagePath = join(__dirname, "../src/app/cases/[caseId]/page.tsx");
  const src = readFileSync(pagePath, "utf8");
  assert.match(src, /isAuditor && isAuditOsReviewPanelEnabled\(\) && forensicReports\.length > 0 && latestReport/);
  assert.match(src, /\{auditOsReviewPanel \? <AuditOsReviewPanel/);
  assert.match(src, /loadLatestPersistedAuditOsShadowBlobForAuditor/);
});

test("AuditOsReviewPanel source: no obvious PII key literals for rendering", () => {
  const panelPath = join(__dirname, "../src/components/auditor/AuditOsReviewPanel.tsx");
  const src = readFileSync(panelPath, "utf8");
  const banned = ["patient_email", "patientEmail", "phone_number", "phoneNumber", "street_address", "date_of_birth"];
  for (const b of banned) {
    assert.equal(
      src.includes(b),
      false,
      `panel source should not contain literal ${b} (avoid accidental PII field echo)`
    );
  }
});
