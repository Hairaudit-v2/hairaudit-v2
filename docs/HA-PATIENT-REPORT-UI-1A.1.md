# HA-PATIENT-REPORT-UI-1A.1 — Seeded E2E Validation

**Date:** 2026-07-30  
**Status:** GREEN  
**Parent:** [HA-PATIENT-REPORT-UI-1A](./HA-PATIENT-REPORT-UI-1A.md)  
**PDF gap:** tracked separately as [HA-PATIENT-REPORT-UI-1A.2](./HA-PATIENT-REPORT-UI-1A.2.md) — not absorbed into 1B.

---

## Objective

Turn 1A AMBER → GREEN by running Journeys A–E (plus extras) against deterministic donor-report fixtures.

---

## Fixture states (seeded)

| Fixture kind | External id pattern | Notes |
|--------------|---------------------|-------|
| `orientation_confirmed` | `demo-qa:donorhealing:01` | Clinician-confirmed orientation |
| `orientation_corrected` | `demo-qa:donorhealing:02` | Clinician-corrected orientation |
| `missing_orientation_fallback` | `demo-qa:donorhealing:03` | Stored orientation omitted; shell + fallback adapter |
| `partial_donor_evidence` | `demo-qa:donorhealing:04` | Incomplete donor photo set |
| `direct_clinical_assessment` | `demo-qa:donorhealing:05` | Escalation warning visible |

Also covered: legacy non-donor post-surgery (`demo-qa:postsurgery:*`), auditor role (`auditor-demo@hairaudit.test`).

Seed: `DEMO_SEED_INSECURE_TLS=true pnpm run seed:demo-qa`  
Catalog flags: `E2E_HAS_DEMO_CATALOG` + `E2E_HAS_DONOR_REPORT_CATALOG` via `tests/e2e/helpers/globalSetup.ts`.

---

## Playwright proof

Spec: `tests/e2e/hairaudit/patient-report-ui-1a.spec.ts`

| Journey | Result | Proof |
|---------|--------|-------|
| **A** Patient donor report | PASS | Orientation in summary; photos before supporting detail; next steps; no Prepare/Confirm; disclosure expands |
| **B** Mobile | PASS | No horizontal overflow; gallery + nav + disclosure usable at 390×844 |
| **C** Print | PASS | Nav/actions/professional controls hidden; orientation remains; no internal provenance |
| **D** Legacy + fallback | PASS | Non-donor `post-surgery-report-shell`; missing-orientation fixture mounts patient shell for own patient |
| **E** Professional separation | PASS | Auditor sees `professional-donor-orientation-workspace` + Prepare/Confirm; patient cannot; auditor API prepare succeeds |

### Additional checks

| Check | Result |
|-------|--------|
| Live signed photo URLs (mocked stable data URL) | PASS |
| Expired / failed signed URLs → “Photo unavailable” | PASS |
| `donor_report_viewed` fires once per session | PASS |
| Direct-clinical-assessment warning visible | PASS |
| Partial donor evidence still renders shell | PASS |
| Patient access control blocks another patient’s report | PASS |
| Unauthenticated access returns to report after sign-in | PASS |

**Run (2026-07-30):** `11 passed` (`--workers=1`, TLS insecure env for local seed/Supabase).

---

## Product fixes landed during 1A.1

1. **Auditor professional workspace was unreachable** — mount lived inside the non-auditor ternary arm of `/cases/[caseId]`. Moved onto the `isAuditor` branch beside `AuditorCasePageWorkflow`.
2. **`DonorHealingPatientReport` mount restored** — donor cases again use the canonical shell (not legacy `PostSurgeryAuditReportShell`).
3. **Donor orientation API `updated_at`** — removed nonexistent `reports.updated_at` write so Prepare/Confirm persist.
4. **Return-to-report after login** — case-scoped auth moved to `cases/[caseId]/layout.tsx` so `next=/cases/:id` is preserved when middleware `x-pathname` is missing (parent layout previously fell back to `/dashboard/patient`).
5. **Unauthenticated case redirect** — page uses `buildPatientLoginHref(`/cases/${caseId}`)`.

---

## Unit coverage

| Suite | Result |
|-------|--------|
| `tests/patientReportUi1a.test.ts` | pass |
| `tests/patientReportUi1a1Seed.test.ts` | pass |

---

## Explicitly out of scope

- Donor orientation in Post-Surgery PDF HTML → **1A.2**
- Standard (non-donor) Post-Surgery shell migration → **1B**

---

## Recommended next order

1. ~~1A.1 Seeded Playwright~~ — GREEN  
2. **1A.2 — Donor PDF Parity**  
3. Mark parent 1A GREEN (done once 1A.1 green)  
4. Begin **HA-PATIENT-REPORT-UI-1B — Standard Post-Surgery Audit Migration**
