# HA-QA-7B — Urgent Failed Case Recovery (Manual QA)

Manual verification for post-surgery cases that failed audit due to missing required patient photos but can be recovered via the auditor **image-limited** pathway.

Updated for **HA-PHOTO-ALLOCATION-UNIFICATION-1**: pathway slots and legacy audit buckets are logically equivalent for completion. Physical storage paths do **not** determine readiness.

## Scenario

- `patient_review_pathway = post_surgery`
- Missing required views (e.g. no Current Top and no Current Donor Rear / close-ups)
- At least one usable patient image uploaded
- Supporting document (e.g. `graft_count_board` or `surgical_report`)
- Structured clinical history entered by an auditor (graft count, hair count, hairs/graft, clinician summary)

## Accepted equivalent categories (logical only)

| Required clinical view | Accepted upload categories |
|------------------------|----------------------------|
| Current Front View | `preop_front`, `patient_current_front` (eligible `postop_month{N}_front` when months band matches) |
| Current Recipient Close-up | `current_recipient_closeup` only |
| Current Top View | `preop_top`, `patient_current_top` (eligible `postop_month{N}_top`) |
| Current Donor Rear | `preop_donor_rear`, `patient_current_donor_rear` (eligible `postop_month{N}_donor`) |
| Current Donor Close-up | `preop_donor_closeup` only |

**Wide vs close-up:** A wide front (`preop_front` / `patient_current_front`) never satisfies recipient close-up. A wide donor rear never satisfies donor close-up. One image instance fills at most one required slot.

**Milestones:** `postop_month3_*` … `postop_month12_*` satisfy corresponding wide views only when intake `months_since` matches that band (e.g. `6_9` → month-6 keys). Unrelated stages do not count.

**Storage:** Reassignment updates `uploads.type` / `metadata.category` only. Storage object paths are not moved and are ignored for readiness.

## Setup

1. Use a staging case matching the fixture in `tests/fixtures/hairauditFailedCaseRecovery.ts`, or create one:
   - Post-surgery intake with `months_since` filled (e.g. `6_9`)
   - Upload **only** one front view (`patient_current_front` **or** `preop_front` — either is fine)
   - Upload a document category such as `graft_count_board`
   - Leave top, donor rear, and both close-ups empty
2. Sign in as an auditor (`auditor@hairaudit.com` or any profile with `role = auditor`).
3. Open `/cases/[caseId]` for the case.

## Find the case

- Search admin/auditor case list for status `audit_failed` or `submitted` with incomplete photos.
- Optional deterministic external id for test seeds: `test:failed-case-recovery:01`.

## Sort / categorize images

1. In **Patient uploads** (auditor image manager), review uncategorized files.
2. Assign the front photo to **Current Front View** — either:
   - `preop_front` (pathway pin), or
   - `patient_current_front` (legacy bucket)
   
   Both satisfy the same Current Front requirement. Prefer the pathway pin (`preop_front`) for consistency with the guided wizard.
3. Assign the PDF/document to **Graft count board** (`graft_count_board`) or **Surgical report**.
4. Confirm the **Required photo checklist** still shows missing Current Top, Current Donor Rear, and both close-ups. Confirm the front slot remains **satisfied** after assigning `patient_current_front`.

## Enter structured clinical history from a PDF

1. Open **Structured Clinical History** on the case page.
2. From the operative PDF / graft board, enter:
   - **Prior graft count** (e.g. 3200)
   - **Estimated hair count** (e.g. 6400)
   - **Average hairs per graft** (e.g. 2.0)
   - **Supporting document notes** (brief PDF summary)
   - **Clinician summary** (internal operator note)
3. Save. Confirm the panel shows saved values.

## Trigger image-limited regeneration

1. Scroll to **Regenerate as Image-Limited Audit**.
2. Confirm the panel lists:
   - Missing required views (top, donor rear, close-ups as applicable)
   - Patient images present: **Yes**
   - Structured clinical history: **Present**
3. Click **Regenerate as Image-Limited Audit**.
4. Confirm the warning lists missing views and states the report will be labelled image-limited.
5. Click **Confirm image-limited regeneration**.
6. Expect: success message “Image-limited audit regeneration queued” and a new entry in auditor rerun history.

## Safe rerun procedure

1. Categorize existing images with equivalent keys above (do **not** re-upload solely to change folder paths).
2. Confirm checklist / readiness / missing labels agree on the same missing set.
3. If photos are still incomplete but recovery is intentional, use image-limited regeneration with clinical history.
4. If photos were corrected to a complete equivalent set, use a normal rerun (`corrected_patient_photos` or standard rerun) — the photo gate uses the same satisfaction resolver as submit.

## Expected success criteria

- Rerun queues/completes without photo-submit gate failure.
- Case produces a web report and PDF.
- Report shows **Image-limited audit** notice with copy similar to:

  > Image-limited audit: This report was generated using the available submitted images and clinician-entered supporting information. Some required photo views were not available, so image-based assessment is limited in those areas.

- AI audit context includes structured clinical history (graft count, hairs/graft, document notes).
- Audit event log includes `missing_photo_override_used`.

## Expected warning copy (confirmation step)

Before queueing, the auditor should see confirmation text that:

- The report will be labelled **image-limited**
- Visual assessment confidence is constrained for missing views
- The action is logged

The panel also shows **Missing required views:** with human-readable labels for absent slots (Current Top View, Current Donor Rear, etc.).

## Regression checks (must still hold)

| Check | Expected |
|-------|----------|
| Patient submit with missing photos | Blocked (strict gate unchanged) |
| Image-limited without image **and** without clinical history | Block button / API 400 |
| Non-auditor POST `/api/auditor/rerun` | 403 Forbidden |
| Normal completed case report | No image-limited notice |
| Reassign front → `patient_current_front` | Front requirement remains satisfied |
| Legacy 3 wide buckets only | Does **not** satisfy required close-ups |

## Automated coverage

- `tests/patientPhotoSatisfaction.test.ts` — canonical equivalence / milestones / close-up protection
- `tests/hairauditFailedCaseRecovery.test.ts` — deterministic fixture + gate/override/report assertions
- `tests/imageLimitedAuditOverride.test.ts` — override module wiring
- `tests/clinicalHistory.test.ts` — clinical history validation and prompt
- `tests/auditorImageSortingUx.test.ts` — auditor checklist and sorting UX

Run:

```bash
pnpm exec tsx --test tests/patientPhotoSatisfaction.test.ts tests/hairauditFailedCaseRecovery.test.ts
```
