# HairAudit Future Integration Architecture

This document outlines how HairAudit remains a **standalone surgical audit platform** while preparing for future interoperability with:

1. **Hair Longevity Institute (HLI)** — patient portal for trichology, blood analysis, and longitudinal hair health tracking  
2. **Follicle Intelligence (FI)** — shared intelligence and analytics layer  

HairAudit **does not** depend on HLI’s data model and **does not** transfer operational data ownership to FI. All audit logic, report generation, and scoring pipelines stay unchanged.

---

## 1. Ownership and Boundaries

### HairAudit continues to own

| Domain | Ownership |
|--------|-----------|
| Audit cases | Full lifecycle in `cases`; HairAudit is source of truth |
| Surgical uploads | `uploads`, `audit_photos`, `doctor_case_uploads`; storage and metadata in HairAudit |
| Scoring rubrics | `doctor_answers`, `clinic_answers`, report `summary.forensic_audit`, domain scoring |
| Audit reports | `reports` table, PDF generation, HTML/print views |
| Doctor & clinic benchmarking | `clinic_profiles`, `doctor_profiles`, transparency metrics, awards |
| Certification & verification | Award tiers, provisional/validated states, auditor workflows |

### What stays isolated

- **HLI operational flows** — No patient health records, blood panels, or longitudinal trichology data in HairAudit. No foreign keys or required fields pointing at HLI.
- **FI as analytics consumer only** — FI may **receive** normalized events and optional canonical IDs for correlation. FI does **not** store or own HairAudit’s operational data; it does not run audits or generate reports.

---

## 2. Canonical Entity Mapping (Future)

When a shared “global” identity layer exists (e.g. under FI or a separate identity service), HairAudit entities can map as follows. **Today these IDs are not required;** they are reserved for future use.

| Canonical ID | HairAudit source | Notes |
|--------------|------------------|--------|
| **global_case_id** | `cases.id` (UUID) | HairAudit case UUID can serve as global_case_id, or be mapped via an optional `cases.external_case_id` / registry later. |
| **global_provider_id** | `profiles.id` (doctor) or `doctor_profiles.id` | Doctor = auth user or HairAudit doctor_profile. Optional `doctor_profiles.external_provider_id` for FI/HLI correlation. |
| **global_clinic_id** | `profiles.id` (clinic) or `clinic_profiles.id` | Clinic = auth user or HairAudit clinic_profile. Optional `clinic_profiles.external_clinic_id` for correlation. |
| **global_document_id** | `reports.id` or `uploads.id` | Report PDF or evidence file. Optional `reports.external_document_id` / `uploads.external_document_id` for cross-platform document references. |

**Implementation rule:** All canonical ID columns are **optional and nullable**. No foreign keys to external systems. Populated only when an integration is configured and identity resolution is implemented.

---

## 3. Event Catalog for Analytics / Intelligence

These are **candidate events** that HairAudit could emit (e.g. to FI or an event bus) as normalized signals. Emitting is **optional** and controlled by configuration; existing workflows do not depend on it.

### Case lifecycle

| Event name | When | Suggested payload (minimal) |
|------------|------|-----------------------------|
| `hairaudit.case.created` | New case created (`/api/cases/create`) | `case_id`, `audit_type`, `user_id`, `created_at` |
| `hairaudit.case.submitted` | Case submitted for audit (`/api/submit` → status `submitted`) | `case_id`, `user_id`, `audit_type`, `submission_channel`, `submitted_at` |
| `hairaudit.case.deleted` | Case soft/hard deleted (if implemented) | `case_id`, `deleted_at` |

### Audit pipeline

| Event name | When | Suggested payload |
|------------|------|-------------------|
| `hairaudit.audit.started` | RunAudit Inngest function starts | `case_id`, `report_version`, `started_at` |
| `hairaudit.audit.completed` | Report row inserted, status `audit_complete` (before PDF) | `case_id`, `report_id`, `version`, `audit_mode`, `completed_at` |
| `hairaudit.audit.failed` | Pipeline marks case/report as failed | `case_id`, `error`, `failed_at` |
| `hairaudit.report.released` | Report status → `pdf_ready`, case → `complete` | `case_id`, `report_id`, `version`, `pdf_path`, `released_at` |
| `hairaudit.report.rebuild_requested` | `case/pdf-rebuild-requested` | `case_id`, `version`, `requested_at` |

### Risk and quality (for FI analytics)

| Event name | When | Suggested payload |
|------------|------|-------------------|
| `hairaudit.risk_flags.generated` | After AI audit completes; red_flags / risk-related findings in report summary | `case_id`, `report_id`, `has_red_flags`, `flag_count`, `generated_at` |
| `hairaudit.clinic_metrics.updated` | After `refreshClinicTransparencyMetrics` | `clinic_profile_id`, `case_id` (optional), `reason`, `updated_at` |
| `hairaudit.doctor_metrics.updated` | After `refreshDoctorTransparencyMetrics` | `doctor_profile_id`, `case_id` (optional), `reason`, `updated_at` |

### Contribution and auditor

| Event name | When | Suggested payload |
|------------|------|-------------------|
| `hairaudit.contribution_request.created` | Contribution request created | `request_id`, `case_id`, `clinic_profile_id`, `doctor_profile_id`, `created_at` |
| `hairaudit.contribution_request.contribution_received` | Doctor/clinic submitted contribution | `request_id`, `case_id`, `received_at` |
| `hairaudit.auditor.report_validated` | Auditor approves final report | `case_id`, `report_id`, `auditor_id`, `validated_at` |
| `hairaudit.auditor.report_rejected` | Auditor rejects | `case_id`, `report_id`, `auditor_id`, `rejected_at` |
| `hairaudit.auditor.rerun` | Auditor triggers rerun | `case_id`, `auditor_id`, `requested_at` |

**Naming convention:** `hairaudit.<domain>.<action>` so FI/HLI can filter by source and topic without coupling to internal event names (e.g. `case/submitted`).

---

## 4. Minimal Architecture for Emitting Normalized Signals

Goal: allow HairAudit to emit the above events **later** without changing existing audit workflows.

### 4.1 Integration adapter (outbound only)

- **Placement:** Dedicated module, e.g. `src/lib/integrations/` or `src/lib/events/`.
- **Responsibility:** Turn internal state changes into normalized event payloads and send them to a configurable sink (e.g. webhook, message queue, or FI ingestion API).
- **Trigger:** Invoked from **existing** code paths at the same points where today we only update DB and (for audit) call Inngest. No change to Inngest event names or to report/audit logic.

### 4.2 Optional event bridge

- **Pattern:** Thin wrapper that:
  - Reads `INTEGRATION_EVENTS_ENABLED` (or similar) and optional sink URL.
  - If disabled or not configured: no-op.
  - If enabled: builds payload (case_id, report_id, timestamps, minimal context), calls adapter (e.g. `emitHairAuditEvent("hairaudit.case.submitted", payload)`).
- **Where to hook (examples):**
  - Case created: in `/api/cases/create` after successful insert.
  - Case submitted: in `/api/submit` after status update, alongside existing `inngest.send({ name: "case/submitted", ... })`.
  - Audit completed: in `runAudit` Inngest function after “insert-report-row” / “mark-audit-complete-phase”.
  - Report released: in `runAudit` after “finalize-pdf-ready-phase” and before/after `refreshTransparencyMetricsForCase`.
  - Clinic/doctor metrics: inside `refreshClinicTransparencyMetrics` / `refreshDoctorTransparencyMetrics` (or in `refreshTransparencyMetricsForCase` once per profile).
  - Contribution requests: in `/api/case-contribution-requests` and `/api/contribution-portal/submit`.
  - Auditor actions: in `/api/auditor/report-status` and `/api/auditor/rerun`.

### 4.3 No change to

- Inngest function IDs or event names used **inside** HairAudit.
- Scoring, AI audit, PDF generation, or report content.
- RLS, auth, or case/report access rules.
- HLI: no inbound calls from HairAudit to HLI for operational data; no dependency on HLI schema.

---

## 5. Optional Fields and Hooks to Add Now

These are additive only; they do not affect existing behavior.

### 5.1 Database (nullable, no FKs to external systems)

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `cases` | `external_case_id` | TEXT NULL | Future global_case_id or external system reference; set only when integration is active. |
| `reports` | `external_document_id` | TEXT NULL | Future global_document_id for report PDF. |
| `uploads` | `external_document_id` | TEXT NULL | Future global_document_id for evidence files (if desired). |
| `clinic_profiles` | `external_clinic_id` | TEXT NULL | Future global_clinic_id for correlation with FI/HLI. |
| `doctor_profiles` | `external_provider_id` | TEXT NULL | Future global_provider_id for correlation. |
| `profiles` | (optional) `external_identity_id` | TEXT NULL | If a global identity is introduced later. |

All columns added via migrations with `ADD COLUMN IF NOT EXISTS ... NULL` and no default. No indexes required initially; add later if FI query patterns need them.

### 5.2 Application hooks (no-op until used)

- **Event emitter interface:** Define a small interface, e.g. `HairAuditEventSink`, with a single method `emit(event: string, payload: Record<string, unknown>): Promise<void>`. Default implementation: no-op. Later, swap in an implementation that POSTs to FI or pushes to a queue.
- **Reserved hook points:** Document (in code or this doc) the list of “integration hook points” above so that when you enable the bridge, you only implement the adapter and flip the config.

### 5.3 Configuration

- `INTEGRATION_EVENTS_ENABLED=false` (default).
- Optional: `INTEGRATION_EVENTS_SINK_URL`, `INTEGRATION_EVENTS_HEADERS` (e.g. API key) for the adapter. Not read unless events are enabled.

---

## 6. Safe Migration Path

### Phase 1 — Add optional columns only

1. Add migrations for nullable `external_*` columns on `cases`, `reports`, `uploads`, `clinic_profiles`, `doctor_profiles` (and optionally `profiles`).
2. Do **not** add triggers or application code that depend on these columns.
3. Deploy; verify existing audits, report generation, and transparency refreshes unchanged. No backfill required.

### Phase 2 — Add event interface and no-op sink

1. Introduce `HairAuditEventSink` and a no-op implementation.
2. Add a small `emitHairAuditEvent(eventName, payload)` helper that checks `INTEGRATION_EVENTS_ENABLED` and calls the sink when true.
3. Do **not** call `emitHairAuditEvent` from any production path yet (or call it only from one low-risk path, e.g. case created, and verify no-op). This keeps behavior identical.

### Phase 3 — Wire hook points (feature-flagged)

1. At each hook point (submit, audit complete, report released, metrics refresh, contribution, auditor actions), call `emitHairAuditEvent` with the appropriate event name and minimal payload.
2. Keep `INTEGRATION_EVENTS_ENABLED=false` so no outbound calls are made.
3. Run full regression: create case → submit → run audit → report pdf_ready → contribution flow → auditor approve/rerun. Confirm no errors and no change in report content or scoring.

### Phase 4 — Enable and connect (when FI/HLI ready)

1. Implement a real `HairAuditEventSink` (e.g. HTTP to FI ingestion endpoint).
2. Set `INTEGRATION_EVENTS_ENABLED=true` and configure sink URL/headers in the environment.
3. Optionally backfill or map existing entities to `external_*` IDs if FI requires it; do this in a separate, idempotent job so it doesn’t block normal audits.

### What we avoid

- **No** schema or logic changes that require HLI or FI to be present.
- **No** moving ownership of cases, reports, or metrics to FI.
- **No** changes to Inngest steps, scoring, or PDF generation logic; only additive hooks and optional columns.
- **No** new required fields on `cases` or `reports` that would break existing rows or APIs.

---

## 7. Summary

| Item | Action |
|------|--------|
| **Canonical IDs** | Optional nullable `external_*` columns; map to global_* when a shared identity layer exists. |
| **Events** | Catalog defined; emission via optional adapter + config flag; no change to existing Inngest or audit flow. |
| **Architecture** | Minimal: outbound-only integration adapter and optional event bridge at existing hook points. |
| **HLI isolation** | No dependency on HLI data model; no operational data flow from HLI into HairAudit. |
| **FI role** | Consumer of normalized events and optional IDs only; no ownership of HairAudit operational data. |
| **Safety** | Additive migrations and feature-flagged hooks; no impact on current audits or reports. |

This keeps HairAudit fully independent and deployable as today, while making it straightforward to add integration later without refactoring core audit or report logic.

---

## 8. Implementation Notes (Current Repo)

- **Migration:** `supabase/migrations/20260316000001_external_ids_future_integration.sql` adds nullable `external_case_id`, `external_document_id` (reports), `external_clinic_id`, `external_provider_id` on the relevant tables. No backfill; safe to deploy.
- **Event layer:** `src/lib/integrations/` provides:
  - `emitHairAuditEvent(eventName, payload)` — call at hook points; no-op when `INTEGRATION_EVENTS_ENABLED` is not `true`.
  - `HairAuditEventSink` interface and `getEventSink()` / `setEventSink()` for swapping in a real sink later.
- **Hook points** are not wired in this pass; they are listed in §4.2 and §3 so you can add `emitHairAuditEvent(...)` at the right places when you enable the bridge.
