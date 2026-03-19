# Contribution Portal Refactor Summary

Refactor of the Clinic/Doctor Contribution Portal (`/contribute/[token]`) for speed, structure, and audit quality. **No breaking changes**: existing field IDs, API contract, and submission payload shape are preserved; all changes are additive.

---

## Goals Met

- **Fast, intuitive input**: Dropdowns, radio groups (Yes/No/Unknown), quick-select ranges, checkboxes.
- **More structured data**: New optional structured fields stored in `contribution_payload` (JSONB).
- **Stronger audit signal**: Verification section includes documentation level, graft count verification, discrepancy detection, confidence level.
- **Conditional logic**: FUE-specific fields (extraction method, device, punch sizes) shown when procedure is FUE; repair-case hint when repair/corrective; FUT gets note to use free text.
- **Existing sections intact**: Planning, Donor mapping, Graft handling, Implantation, Verification, Images — same section titles and existing free-text keys unchanged.
- **Free-text preserved**: All original textareas remain as optional "Additional notes" after structured inputs.

---

## Components Updated

### 1. `src/app/contribute/[token]/ContributionPortalForm.tsx`

- **Shared UI**: `Select`, `RadioGroup`, `NumberInput`, `SectionCard`, `FieldRow` for consistent layout and low cognitive load.
- **Planning**: Procedure type (dropdown), Repair case (Yes/No/Unknown), Planned/actual graft count (number), Quick range (optional), Future loss planning (radio), Additional notes (unchanged `planningDetails`).
- **Donor & extraction**: Shown for FUE or when procedure not yet selected. Extraction method, primary device, punch sizes (multi-select), donor quality, safe donor zone (radio). FUT shows short note to use notes. Additional notes (unchanged `donorMappingDetails`).
- **Graft handling**: Holding solution, out-of-body time (dropdowns); Sorting performed, Grafts kept hydrated (Yes/No/Unknown). Additional notes (unchanged `graftHandlingDetails`).
- **Implantation**: Method, primary device, implanted by, site creation method (dropdowns); Dense packing (Yes/No/Unknown). Additional notes (unchanged `implantationDetails`).
- **Verification**: Documentation level, Graft count verification, Discrepancy detected, Confidence level (dropdowns). Verification notes textarea (unchanged `verificationFields`).
- **Images**: Unchanged; one URL/path per line (`optionalImages` → `contribution_images`).

### 2. `src/app/api/contribution-portal/submit/route.ts`

- **Unchanged**: Request body still accepts `token`, `planningDetails`, `donorMappingDetails`, `graftHandlingDetails`, `implantationDetails`, `verificationFields`, `optionalImages` (array). Response and status flow unchanged.
- **Additive payload keys** (only set when provided):  
  `procedure_type`, `repair_case_flag`, `graft_count_range`, `planned_graft_count`, `actual_graft_count`, `future_loss_planning`,  
  `extraction_method`, `primary_extraction_device`, `punch_sizes_used`, `donor_quality_rating`, `safe_donor_zone_assessed`,  
  `primary_holding_solution`, `sorting_performed`, `grafts_kept_hydrated`, `out_of_body_time_category`,  
  `implantation_method`, `primary_implantation_device`, `implanted_by`, `site_creation_method`, `dense_packing_attempted`,  
  `documentation_level`, `graft_count_verification`, `discrepancy_detected`, `confidence_level`.

---

## Field ID Mapping (Submit Body → Payload)

| Form / body (camelCase)     | Stored in `contribution_payload` (snake_case) |
|----------------------------|-----------------------------------------------|
| `planningDetails`          | `planning_details` (unchanged)                |
| `donorMappingDetails`     | `donor_mapping_details` (unchanged)           |
| `graftHandlingDetails`     | `graft_handling_details` (unchanged)           |
| `implantationDetails`      | `implantation_details` (unchanged)            |
| `verificationFields`      | `verification_fields` (unchanged)             |
| `procedureType`            | `procedure_type`                              |
| `repairCaseFlag`           | `repair_case_flag`                            |
| `plannedGraftCount`        | `planned_graft_count`                         |
| `actualGraftCount`         | `actual_graft_count`                          |
| `graftCountRange`          | `graft_count_range`                          |
| `futureLossPlanning`       | `future_loss_planning`                        |
| `extractionMethod`         | `extraction_method`                           |
| `primaryExtractionDevice`  | `primary_extraction_device`                   |
| `punchSizesUsed`           | `punch_sizes_used` (array)                    |
| `donorQualityRating`       | `donor_quality_rating`                        |
| `safeDonorZoneAssessed`    | `safe_donor_zone_assessed`                     |
| `primaryHoldingSolution`   | `primary_holding_solution`                     |
| `sortingPerformed`         | `sorting_performed`                           |
| `graftsKeptHydrated`       | `grafts_kept_hydrated`                        |
| `outOfBodyTimeCategory`    | `out_of_body_time_category`                   |
| `implantationMethod`       | `implantation_method`                         |
| `implantationDevice`       | `primary_implantation_device`                  |
| `implantedBy`              | `implanted_by`                                |
| `siteCreationMethod`       | `site_creation_method`                        |
| `densePackingAttempted`    | `dense_packing_attempted`                      |
| `documentationLevel`       | `documentation_level`                         |
| `graftCountVerification`   | `graft_count_verification`                    |
| `discrepancyDetected`      | `discrepancy_detected`                        |
| `confidenceLevel`          | `confidence_level`                            |

`optionalImages` continues to be sent as an array and stored in `contribution_images`; it is not part of `contribution_payload`.

---

## Constraints Verified

- **Existing field IDs**: `planning_details`, `donor_mapping_details`, `graft_handling_details`, `implantation_details`, `verification_fields` remain the same keys in the payload; only new keys were added.
- **API contract**: POST `/api/contribution-portal/submit` request/response and error handling unchanged; new body fields are optional and ignored if absent.
- **Patient audit flow**: No changes to patient-facing or audit-only flows; only the contribution form and submit handler were touched.
- **Additive only**: New structure wraps existing fields; no renames or removals.

---

## Options Source

Structured options (procedure type, extraction, punch sizes, holding solution, implantation method/device, etc.) come from `@/lib/audit/masterSurgicalMetadata.ts` so contribution data aligns with audit and scoring.

---

## Participation funnel (additive)

A non-intrusive funnel encourages clinics to save data and join the HairAudit ecosystem without blocking the main task.

### 1. Top-of-page

- One-line value statement under the header: *“Your contribution strengthens audit accuracy and helps build your clinic’s verified profile on HairAudit.”*

### 2. Mid-form awareness card

- After the first section (Planning details): **“Why contribute?”** card with bullets (improves audit accuracy, builds verified surgical profile, enables visibility in HairAudit search) and a secondary link: **“Learn about clinic participation”** → `/professionals/clinical-participation`.

### 3. Post-submission conversion panel

- After successful submit, the confirmation is replaced by a conversion panel:
  - **Title:** “You’re already halfway there”
  - Short copy on reusing structured data and building presence
  - **Reflection:** “What you completed” — summary of extraction, graft handling, and implantation (labels from options)
  - **Benefits:** Save protocols for future audits; appear in patient search; build credibility with verified documentation
  - **Primary CTA:** “Create / activate clinic profile” → `/professionals/apply`
  - **Secondary:** “Continue without saving” → dismisses panel and shows minimal “Thank you. Your contribution has been received.”

### 4. Optional save-as-defaults

- In the same post-submission panel: **“Save these selections as your clinic defaults?”** with short explanation (stored in this browser for future contributions).
- **Save defaults** writes current structured selections to `localStorage` under key `hairaudit_contribution_defaults` (no backend).
- **Skip** does nothing; “Continue without saving” still dismisses the panel.

### 5. Behaviour and constraints

- Form flow is not interrupted; no required fields added; submission payload and API unchanged; patient audit flow unaffected. All funnel elements are additive.
