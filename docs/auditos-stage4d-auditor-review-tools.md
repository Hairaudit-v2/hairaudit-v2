# AuditOS Stage 4D — Auditor review tools (internal)

Stage 4D adds **read-only, HairAudit-auditor-only** tooling on top of **persisted AuditOS shadow snapshots** (Stage 4C). It does **not** change patient-facing report output, scoring math, or legacy `reports.summary` authority. FI export is **not** enabled by default.

## Goals

- Structural alignment QA: legacy summary shape vs persisted normalized scoring / evidence / report JSON.
- Evidence completeness and domain normalization **view-models** (counts, keys, presence) — not clinical judgement.
- Safe behavior when **no** persisted snapshot exists for a case.

## UI placement

| Surface | Path | Who |
|---------|------|-----|
| **AuditOS review panel** | `src/app/cases/[caseId]/page.tsx` — same auditor-only block as rerun + shadow debug (below `AuditOsShadowDebugPanel`) | `profiles.role === "auditor"` only (HairAudit internal operators). |

Patients, doctors, and clinics never receive this panel. The case page already gates the surrounding block with `isAuditor && forensicReports.length > 0`.

## Server modules

| Module | Role |
|--------|------|
| `src/lib/auditos/review/compareLegacyAndNormalizedReport.ts` | Structural comparison: `ok` \| `warning` \| `missing` + metrics + warnings. |
| `src/lib/auditos/review/buildEvidenceCompletenessViewModel.ts` | Groups evidence items; missing list; `complete` \| `partial` \| `limited` \| `unknown`. |
| `src/lib/auditos/review/buildDomainNormalizationViewModel.ts` | Domain rows, overall, overrides, warnings for missing/unrecognized domains. |
| `src/lib/auditos/shadow/loadAuditOsShadowSnapshots.server.ts` | `loadLatestPersistedAuditOsShadowBlobForAuditor` (full JSON blobs after auditor role check). |
| `src/components/auditor/AuditOsReviewPanel.tsx` | Read-only presentation; no writes; no raw legacy summary dump. |

## Environment flags

| Variable | Meaning |
|----------|---------|
| `HAIRAUDIT_AUDITOS_REVIEW_PANEL` | When exactly `"true"`, the review panel is enabled **including in production**. |
| *(default)* | When unset: enabled in **non-production** (`NODE_ENV !== "production"`) for auditors; **production** requires the explicit flag above. |

Shadow **persistence** remains `HAIRAUDIT_AUDITOS_SHADOW_PERSIST_ENABLED` (Stage 4C). Shadow **debug** list remains `HAIRAUDIT_AUDITOS_DEBUG_PANEL` / non-production (Stage 4B). The review panel uses its **own** gate so production can show persisted metadata only when deliberately turned on.

## Privacy / PII

- Loaders require `resolvedRole === "auditor"` before any service-role read (see `canLoadAuditOsShadowSnapshotsForRole` / `canShowAuditOsReviewPanelForRole`).
- Persisted JSON is **sanitized** at write time (Stage 4C); the panel shows **aggregates and structural fields** only — not full legacy summaries, not storage paths, and not a dump of raw snapshot JSON beyond adapter version labels in a collapsible block.
- Avoid extending the panel to render unfiltered `normalized_report` narrative blobs without another privacy review.

## “Legacy remains authoritative”

The panel includes an explicit notice: **legacy `reports.summary` remains authoritative** for patients, PDFs, and awards logic. AuditOS JSON is shadow / alignment only.

## FI export readiness (design only — Stage 4D)

**No new schema** in Stage 4D. The following states describe a future **internal** workflow for deciding when a case/report is safe to include in an **optional** FI export pipeline (still off by default at the product level).

| State | Meaning (conceptual) |
|-------|----------------------|
| **ready** | Structural + policy checks pass; auditor comfortable that export payload would be complete and non-duplicative. |
| **blocked** | Hard stop (e.g. missing required evidence class, policy violation, unresolved data-quality flag). |
| **needs review** | Ambiguous or stale shadow snapshot vs current legacy report; human must look. |
| **exported** | A successful export was recorded for a given target system/version (audit trail). |
| **do not export** | Explicit exclusion (legal, patient request, training case, etc.). |

**Stage 4E** should implement this as additive internal metadata (or a small internal table), an export-safe payload builder, and **no automatic FI export** until product-level enablement is explicit.

## Tests

- `pnpm test:auditos-stage4d` — comparison statuses, evidence completeness, domain warnings, env gate, case-page wiring contract, panel source hygiene (no obvious PII key literals).

## Related

- Stage 4C persistence: [`auditos-stage4c-shadow-persistence.md`](./auditos-stage4c-shadow-persistence.md).
