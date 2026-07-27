# HA-PROJECTION-1D — Projection Persistence + Longitudinal Lineage

**Date:** 2026-07-27  
**Status:** GREEN  
**Scope:** Immutable surgery-day projection snapshots with checksums, semantic versions, supersession lineage, integrity verification, and minimal 1C historical-render integration  
**PHI:** None in this document or committed fixtures  

---

## Summary

HA-PROJECTION-1D persists approved 1A reconstruction + 1B projected outcome as an **immutable, auditable historical baseline**. Corrections create new snapshots linked by supersession; history is never rewritten. Future month-3/6/9/12 observations can attach to a frozen `projection_id` without contaminating day-0 content.

---

## PART A — Discovery (reuse decisions)

| Finding | Decision |
|---------|----------|
| HairAudit is **case-centric** (no `patients` / `procedures` / `tenant_id` on forensic cases) | Snapshot keys: `case_id` (= procedure key), `patient_id` (ownership subject from `cases.patient_id` / `cases.user_id`) |
| Closest persistence analogues | `hairaudit_intelligence_snapshots`, `hairaudit_auditos_shadow_snapshots` (JSONB + service-role RLS + idempotent keys) |
| Report lineage analogue | `reports.version` + `audit_rerun_log` (source→target) → modelled as `supersedes_projection_id` / `superseded_by_projection_id` |
| Ownership | Domain-layer case ownership checks (same pattern as `requireCaseAccess`); service-role DB policies |
| Checksums | **New** canonical JSON + SHA-256 helpers (no prior projection checksum utility) |
| 1A/1B | Remained derived until 1D; version constants added |

No generic versioning framework was introduced.

---

## Persistence model

**Tables** (additive migration `supabase/migrations/20260727120000_hairaudit_projection_snapshots.sql`):

1. `hairaudit_projection_snapshots` — immutable projection records  
2. `hairaudit_projection_snapshot_events` — bounded audit events  

**Service-role RLS only** (same pattern as intelligence snapshots).

### Identity mapping

| Spec concept | HairAudit field |
|--------------|-----------------|
| `projection_id` | `id` |
| `tenant_id` | N/A — isolation via case + patient ownership |
| `patient_id` | `patient_id` |
| `procedure_id` | `case_id` (also mirrored as domain `procedureId`) |
| assessment/report refs | `source_assessment_id`, `source_report_id` |

---

## Immutable / mutable field contract

### Frozen after commit (never UPDATE in place)

- `reconstruction_snapshot`, `projection_snapshot`
- `reconstruction_version`, `projection_engine_version`, `snapshot_schema_version`, `report_template_version`
- `reconstruction_input_checksum`, `projection_input_checksum`, `projection_output_checksum`
- `confidence_summary`, `evidence_summary`
- `case_id`, `patient_id`, `created_at`, `created_by`
- `supersedes_projection_id`, `lineage_root_id`, `supersession_reason_code` (set at create)

### Mutable metadata only

- `projection_status` (`active` → `superseded`)
- `superseded_by_projection_id` (pointer when a newer snapshot supersedes)

Domain service `attemptMutateFrozenProjection` always returns `MUTATION_FORBIDDEN`.

---

## Checksum contract

Helpers: `src/lib/projection/canonicalChecksum.ts`

| Rule | Behaviour |
|------|-----------|
| Same logical object | Same SHA-256 |
| Field ordering differences | Same checksum (recursive key sort) |
| Material content change | Different checksum |
| Volatile keys stripped | `generated_at` / `generatedAt`, `request_id` / `requestId`, signed/temporary URL keys |

Checksums stored:

1. **reconstruction_input_checksum** — canonical 1A snapshot  
2. **projection_input_checksum** — same as reconstruction (1B input)  
3. **projection_output_checksum** — canonical 1B outcome  

Integrity: `verifyProjectionSnapshotIntegrity` re-canonicalises and recomputes; mismatch → fail closed + audit `projection_snapshot_integrity_failed`. Checksums are **never auto-repaired**.

---

## Version contract

| Constant | Value |
|----------|-------|
| `RECONSTRUCTION_CONTRACT_VERSION` | `ha-projection-1a-v1` |
| `PROJECTION_ENGINE_VERSION` | `ha-projection-1b-v1` |
| `PROJECTION_SNAPSHOT_SCHEMA_VERSION` | `ha-projection-lineage-v1` |
| Report template version | `1` (aligned with `SURGERY_DAY_PROJECTION_REPORT_VERSION`) |

Semantic versions are authoritative for historical interpretation. Git/build identity is not used as a substitute.

---

## Creation / idempotency

Canonical service: `ProjectionSnapshotService.createProjectionSnapshot(...)`

Flow:

1. Validate 1A (surgery-day reconstruction + recipient evidence)  
2. Validate 1B (patient-safe + assessment-type agreement)  
3. Verify case/patient ownership  
4. Canonicalise + checksum  
5. Idempotency lookup on `(case_id, projection_type, reconstruction_version, projection_engine_version, reconstruction_input_checksum, projection_output_checksum)`  
6. Persist insert (or return existing)  
7. Emit audit event  

| Situation | Behaviour |
|-----------|-----------|
| Identical content repeated | Return existing (`projection_snapshot_reused`) — no duplicate |
| Materially different content | New snapshot; requires supersession reason when an active row exists |
| Never | Silent overwrite of frozen payloads |

---

## Supersession behaviour

Allowed reason codes only:

- `source_correction`
- `late_surgery_data`
- `projection_rule_revision`
- `manual_clinical_correction`

Rules:

- Patient/case must match  
- Prior snapshot remains readable  
- Old → `superseded`; `superseded_by_projection_id` set  
- New → `supersedes_projection_id` + shared `lineage_root_id`  

A superseded projection remains historical truth for: **“What was projected at that time?”**

---

## Current vs historical helpers

| Helper | Meaning |
|--------|---------|
| `getCurrentProjection` | Latest `active` snapshot for case (+ optional type) |
| `getProjectionById` | Historical read by id (ownership enforced) |
| `listProjectionLineage` | Ordered lineage by `lineage_root_id` or case |

Old projections are never deleted when superseded.

---

## Report integration (1C minimum)

- `resolveSurgeryDayProjectionReport` precedence:  
  1. **Frozen persisted snapshot**  
  2. Embedded summary 1A+1B  
  3. On-demand 1A→1B fallback  
- `buildSurgeryDayProjectionReportFromSnapshot` for exclusive historical render  
- Report DTO carries optional `projectionSnapshotId` (audit metadata, not patient-facing copy)  
- Print route accepts `projectionSnapshotId` query param; loads frozen row with case/patient ownership check; sets `X-Projection-Snapshot-Id` header  

Historical PDF re-render uses the frozen snapshot — **not** today’s recalculated projection.

---

## Longitudinal contract (deferred implementation)

`attachLongitudinalObservationReference` / `assertNoRetrospectiveContamination`:

```text
ProjectionSnapshot
   ↓ projection_id (frozen)
LongitudinalObservation (future)
   ├── month_3
   ├── month_6
   ├── month_9
   └── month_12
```

Month modelling / ImagingOS measurements are **out of scope**. Future comparisons must read historical snapshot vs later observation — never recalculate day-0 with later data.

---

## Tenant / patient / procedure isolation

- Create/read require `caseId` + `patientId` matching case ownership  
- Cross-patient / wrong case id → `OWNERSHIP_MISMATCH` + `projection_snapshot_read_denied`  
- Print-route snapshot load requires `case_id` match and patient membership when available  
- DB policies: service_role only; application layer still enforces ownership  

---

## Audit events

| Event | When |
|-------|------|
| `projection_snapshot_created` | New insert |
| `projection_snapshot_reused` | Idempotent hit |
| `projection_snapshot_superseded` | Prior marked superseded |
| `projection_snapshot_read` | Successful historical/current read |
| `projection_snapshot_read_denied` | Ownership failure |
| `projection_snapshot_integrity_failed` | Checksum mismatch |

Logged: identifiers, versions, checksums, outcome, actor.  
**Not** logged: full PHI bodies, image URLs, credentials, unrestricted projection text.

---

## Key files

| Path | Role |
|------|------|
| `supabase/migrations/20260727120000_hairaudit_projection_snapshots.sql` | Additive schema |
| `src/lib/projection/versions.ts` | Semantic versions |
| `src/lib/projection/canonicalChecksum.ts` | Checksum contract |
| `src/lib/projection/projectionSnapshotService.ts` | Domain creation/read/lineage |
| `src/lib/projection/projectionSnapshotPersist.server.ts` | Supabase adapter |
| `src/lib/projection/projectionSnapshotIntegrity.ts` | Tamper detection |
| `src/lib/projection/longitudinalObservationContract.ts` | Future observation refs |
| `src/lib/reports/surgeryDayProjectionReport.ts` | Snapshot-aware resolve |
| `src/app/api/print/report/route.ts` | Optional historical snapshot load |
| `tests/projectionSnapshotPersistence.test.ts` | Mandatory A–X coverage |

---

## Test evidence

| Suite | Result |
|-------|--------|
| `tests/projectionSnapshotPersistence.test.ts` (creation, checksums, immutability, idempotency, report, integrity, longitudinal, migration) | **PASS** (23) |
| HA-PROJECTION-1A tests | **PASS** |
| HA-PROJECTION-1B tests | **PASS** |
| HA-PROJECTION-1C tests | **PASS** |
| `pnpm typecheck` | **PASS** |
| ESLint on touched projection/report/test files | **PASS** |

Print route retains pre-existing `@typescript-eslint/no-explicit-any` findings unrelated to 1D changes (unchanged patterns).

### Historical render proof (R)

Persisted snapshot content wins over any later live projection mutation; report `summary` remains the frozen value.

### Integrity / tamper proof (T/U/V)

Valid snapshot → PASS. Tampered payload or forged checksum → FAIL / fail closed.

### Longitudinal safety (W/X)

Later outcome fields do not alter stored day-0 checksums. Comparison contract requires original `projection_id`.

---

## Deferred / out of scope

- Month-3/6/9/12 measurement implementation  
- Generated future-result images  
- ImagingOS measurements  
- Cohort modelling / survival prediction  
- Patient gateway projection APIs  
- Migrating every historical report into snapshots  
- Retrospective rewriting of old projections  

---

## Acceptance checklist

| Criterion | Met |
|-----------|-----|
| Canonical immutable snapshot persisted | Yes |
| Freezes approved 1A + 1B | Yes |
| Deterministic checksums stored | Yes |
| Explicit semantic versions stored | Yes |
| Duplicate creation idempotent | Yes |
| Corrections → new snapshot | Yes |
| Supersession lineage preserved | Yes |
| Current vs historical resolvable | Yes |
| Historical report can consume snapshot | Yes |
| Later data does not contaminate day-0 | Yes |
| Integrity detects tampering | Yes |
| Case/patient isolation enforced | Yes |
| 1A/1B/1C remain GREEN | Yes |
| Typecheck + touched lint GREEN | Yes |
| Evidence separate from implementation commit | Yes (this doc) |

**HA-PROJECTION-1D: GREEN**
