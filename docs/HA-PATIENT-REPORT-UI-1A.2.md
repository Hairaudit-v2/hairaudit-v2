# HA-PATIENT-REPORT-UI-1A.2 — Donor PDF Parity

**Date:** 2026-07-30  
**Status:** TRACKED (not started)  
**Parent:** [HA-PATIENT-REPORT-UI-1A](./HA-PATIENT-REPORT-UI-1A.md)  
**Prerequisite:** [HA-PATIENT-REPORT-UI-1A.1](./HA-PATIENT-REPORT-UI-1A.1.md) GREEN  

---

## Why this exists

Patients can now see a polished **web** donor report (1A / 1A.1) while the **Post-Surgery PDF HTML** still lacks donor orientation. That structural mismatch must not be quietly absorbed into **HA-PATIENT-REPORT-UI-1B** (standard post-surgery web migration) unless 1B intentionally expands to PDF parity.

---

## Scope

- Add donor orientation to the patient PDF (same patient-safe title and narrative as the web shell).
- Preserve the existing immutable report snapshot (no remapping of orientation states or provenance).
- Include evidence limitations and next steps in the PDF.
- Exclude professional controls, internal IDs, and provenance history from PDF output.
- Add PDF text + screenshot regression tests.

---

## Non-goals

- Rewriting PDF snapshot storage contracts.
- Migrating non-donor Post-Surgery web UI (that is **1B**).
- Changing clinician Prepare / Confirm / Correct APIs.

---

## Acceptance sketch

- [ ] PDF HTML renders patient-safe donor orientation title + narrative
- [ ] Limitations + next steps present
- [ ] No Prepare / Confirm / Correct, actor IDs, or provenance history
- [ ] Snapshot / orientation state unchanged vs web
- [ ] Text + screenshot regression coverage
- [ ] Docs + evidence pack

---

## Sequencing

1. Complete 1A.2 before or in parallel with early 1B planning.  
2. Do **not** mark PDF parity “done” via 1B unless 1B’s charter explicitly includes it.  
3. After 1A.2, continue with **HA-PATIENT-REPORT-UI-1B — Standard Post-Surgery Audit Migration**.
